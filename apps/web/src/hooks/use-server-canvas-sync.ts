import { createCanvasYjsFrameSync } from "@/hooks/canvas-yjs-frame-sync";
import { restorePendingCanvasUpdates } from "@/hooks/restore-pending-canvas-updates";
import {
	CANVAS_LIVE_REFETCH_OPTIONS,
	createSyncPayloadTooLargeError,
	getCanvasUpdatePollInterval,
	getCompactionRetryDelayMs,
	shouldCompactCanvasUpdateLog,
} from "@/lib/canvas-sync-policy";
import { createCanvasUpdateFlusher } from "@/lib/canvas-update-flusher";
import { applySkedraFileToYDoc } from "@/lib/canvas/skedra-file-utils";
import {
	yjsApplyCanvasMutationPlan,
	yjsCreateElement,
	yjsCreateView,
	yjsDeleteElement,
	yjsDeleteElements,
	yjsDeleteView,
	yjsUpdateElement,
	yjsUpdateElements,
	yjsUpdateView,
} from "@/lib/canvas/yjs-canvas-mutations";
import { setCanvasBackgroundInYDoc } from "@/lib/canvas/yjs-document-helpers";
import { base64ToBytes, bytesToBase64 } from "@/lib/e2ee";
import {
	deletePendingServerUpdates,
	enqueuePendingServerUpdate,
	listPendingServerUpdates,
} from "@/lib/e2ee-update-queue";
import {
	SERVER_UPDATE_BATCH_DELAY_MS,
	SERVER_UPDATE_BATCH_MAX_RAW_BYTES,
	createPendingServerUpdateBatch,
} from "@/lib/server-update-batching";
import { trpc } from "@/lib/trpc";
import type {
	CanvasElement,
	CanvasMutationPlan,
	SavedCanvasView,
} from "@skedra/canvas-core";
import { CanvasScene } from "@skedra/canvas-core";
import type { CanvasSkedraFile as SkedraFile } from "@skedra/canvas-io/file";
import type { CanvasRole } from "@skedra/shared";
import { BOARD_SYNC_UPDATE_MAX_CHARS } from "@skedra/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import type { LocalCanvasPresence } from "./canvas-sync-types";
import { useBoardLiveChannel } from "./use-board-live-channel";
import { type PresenceIdentity, useBoardPresence } from "./use-board-presence";

const REMOTE_SERVER_ORIGIN = "skedra-server-remote";
const PENDING_SERVER_ORIGIN = "skedra-server-pending";
const SERVER_UPDATE_PAGE_SIZE = 500;

type ServerUpdateCursor = { id: string; createdAt: string };

interface UseServerCanvasSyncOptions {
	enabled?: boolean;
	readonly?: boolean;
	presentationShareToken?: string;
	presenceEnabled?: boolean;
	collabShareToken?: string;
	embedShareToken?: string;
	presence?: PresenceIdentity;
}

function createClientId() {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function getErrorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

export function useServerCanvasSync(
	whiteboardId: string,
	options: UseServerCanvasSyncOptions = {},
) {
	const {
		enabled = true,
		readonly = false,
		presentationShareToken,
		presenceEnabled = true,
		collabShareToken,
		embedShareToken,
		presence,
	} = options;
	const ydocRef = useRef<Y.Doc | null>(null);
	const frameSyncRef = useRef<ReturnType<
		typeof createCanvasYjsFrameSync
	> | null>(null);
	const appliedUpdateIdsRef = useRef<Set<string>>(new Set());
	const compactableUpdateBytesRef = useRef(0);
	const appliedPendingUpdateIdsRef = useRef<Set<string>>(new Set());
	const flushTimerRef = useRef<number | null>(null);
	const clientIdRef = useRef(createClientId());
	const syncReadyRef = useRef(false);
	const compactionInFlightRef = useRef(false);
	// Backoff-Zustand der Komprimierung: Fehlschläge in Folge und frühester
	// Zeitpunkt (ms seit Epoch) für den nächsten Versuch.
	const compactionFailuresRef = useRef(0);
	const compactionRetryAtRef = useRef(0);
	const [scene, setScene] = useState(() => CanvasScene.empty());
	const elements = scene.getElementsMap();
	const [views, setViews] = useState<Map<string, SavedCanvasView>>(new Map());
	const [canvasBg, setCanvasBgState] = useState("");
	const [isConnected, setIsConnected] = useState(false);
	const [sendError, setSendError] = useState<string | null>(null);
	const [connectionError, setConnectionError] = useState<string | null>(null);
	const [updateCursor, setUpdateCursor] = useState<ServerUpdateCursor | null>(
		null,
	);

	const accessInput = useMemo(
		() => ({
			whiteboardId,
			presentationShareToken,
			collabShareToken,
			embedShareToken,
		}),
		[collabShareToken, embedShareToken, presentationShareToken, whiteboardId],
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: Queue lifetime follows board access and encryption key.
	const sendQueueRef = useMemo(
		() => ({ current: Promise.resolve() }),
		[accessInput],
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: A different board must never wait for the old board network request.
	const flushQueue = useMemo(() => createCanvasUpdateFlusher(), [accessInput]);
	const activeFlushQueueRef = useRef(flushQueue);
	activeFlushQueueRef.current = flushQueue;
	const listInput = useMemo(
		() => ({
			...accessInput,
			afterId: updateCursor?.id,
			afterCreatedAt: updateCursor?.createdAt,
			limit: SERVER_UPDATE_PAGE_SIZE,
		}),
		[accessInput, updateCursor],
	);

	const appendUpdate = trpc.whiteboard.appendServerUpdate.useMutation();
	const compactUpdates = trpc.whiteboard.compactServerUpdates.useMutation();
	const liveConnectedRef = useRef(false);
	// Größenbegrenzte Seiten: Ein großes, unkomprimiertes Log wird in mehreren
	// Requests geladen statt in einem, der über langsame Proxys abbricht.
	const {
		data: updatePage,
		error: updatesError,
		refetch: refetchUpdates,
	} = trpc.whiteboard.listServerUpdatePage.useQuery(listInput, {
		enabled: enabled && !!whiteboardId,
		refetchInterval: () =>
			getCanvasUpdatePollInterval({
				liveConnected: liveConnectedRef.current,
				hidden: document.visibilityState === "hidden",
			}),
		refetchIntervalInBackground: true,
		retry: 1,
	});
	const updates = updatePage?.updates;
	const hasMoreUpdates = updatePage?.hasMore ?? false;

	const isSessionUser =
		!presentationShareToken && !collabShareToken && !embedShareToken;
	const canUsePresentationPresence =
		presenceEnabled && !!presentationShareToken;
	useBoardLiveChannel(whiteboardId, {
		enabled: enabled && !!whiteboardId && isSessionUser,
		onEvent: () => void refetchUpdates(CANVAS_LIVE_REFETCH_OPTIONS),
		onCompaction: () => {
			appliedUpdateIdsRef.current = new Set();
			compactableUpdateBytesRef.current = 0;
		},
		onConnectedChange: (connected) => {
			liveConnectedRef.current = connected;
		},
	});

	const presenceIdentity = useMemo<PresenceIdentity>(
		() =>
			presence ?? {
				id: `self-${clientIdRef.current}`,
				name: "Ich",
				image: null,
				color: "#14b8a6",
				role: readonly ? "viewer" : "editor",
				canWrite: !readonly,
			},
		[presence, readonly],
	);
	const presenceApi = useBoardPresence(whiteboardId, {
		enabled:
			enabled &&
			!!whiteboardId &&
			presenceEnabled &&
			(isSessionUser || canUsePresentationPresence),
		encryptionMode: "server",
		e2eeKey: null,
		identity: presenceIdentity,
		presentationShareToken,
	});
	const syncFromYjs = useCallback(() => {
		frameSyncRef.current?.syncAll();
	}, []);

	const flushPendingUpdates = useCallback(() => {
		if (!enabled || readonly || !whiteboardId) return Promise.resolve();
		if (flushTimerRef.current != null) {
			window.clearTimeout(flushTimerRef.current);
			flushTimerRef.current = null;
		}

		return flushQueue(async () => {
			for (;;) {
				const pending = await listPendingServerUpdates(whiteboardId);
				const batch = createPendingServerUpdateBatch(pending);
				const first = batch?.records[0];
				if (!batch || !first) break;
				// Nicht hochladen, was die API sicher ablehnt: Das würde bei jedem
				// Retry (alle 5 s) erneut MB-weise Upload erzeugen.
				if (batch.update.length > BOARD_SYNC_UPDATE_MAX_CHARS) {
					throw createSyncPayloadTooLargeError(
						batch.update.length,
						BOARD_SYNC_UPDATE_MAX_CHARS,
					);
				}
				await appendUpdate.mutateAsync({
					...accessInput,
					clientId: first.clientId,
					update: batch.update,
				});
				await deletePendingServerUpdates(
					batch.records.map((record) => record.id),
				);
			}
			if (activeFlushQueueRef.current === flushQueue) setSendError(null);
		}).catch((error) => {
			if (activeFlushQueueRef.current !== flushQueue) return;
			setSendError(
				getErrorMessage(
					error,
					"Aenderungen sind lokal gespeichert und werden erneut gesendet.",
				),
			);
		});
	}, [
		accessInput,
		appendUpdate.mutateAsync,
		enabled,
		flushQueue,
		readonly,
		whiteboardId,
	]);

	const schedulePendingUpdateFlush = useCallback(() => {
		if (flushTimerRef.current != null) return;
		flushTimerRef.current = window.setTimeout(() => {
			flushTimerRef.current = null;
			void flushPendingUpdates();
		}, SERVER_UPDATE_BATCH_DELAY_MS);
	}, [flushPendingUpdates]);

	const applyPendingQueuedUpdates = useCallback(async () => {
		const ydoc = ydocRef.current;
		if (readonly || !ydoc) return;
		await restorePendingCanvasUpdates({
			ydoc,
			isCurrent: () => ydocRef.current === ydoc,
			load: () => listPendingServerUpdates(whiteboardId),
			decode: (queued) => base64ToBytes(queued.update),
			appliedIds: appliedPendingUpdateIdsRef.current,
			origin: PENDING_SERVER_ORIGIN,
			onRestored: syncFromYjs,
		});
	}, [readonly, syncFromYjs, whiteboardId]);

	useEffect(() => {
		if (!enabled) {
			syncReadyRef.current = false;
			setIsConnected(false);
			return;
		}

		// Standard-GC von Yjs: Überschriebene Werte (jeder Drag-Frame, jeder
		// Tastendruck im Textfeld) werden aus dem Zustand entfernt. Mit
		// `gc: false` blieb jede Zwischenversion für immer im Board-Zustand und
		// in jedem Komprimierungs-Snapshot. Nichts liest diese Historie; Undo/Redo
		// arbeitet mit eigenen Deltas (canvas-undo), und der MCP-Server nutzt für
		// dieselben Dokumente ebenfalls die Standard-GC.
		const ydoc = new Y.Doc();
		ydocRef.current = ydoc;
		appliedUpdateIdsRef.current = new Set();
		compactableUpdateBytesRef.current = 0;
		appliedPendingUpdateIdsRef.current = new Set();
		compactionInFlightRef.current = false;
		compactionFailuresRef.current = 0;
		compactionRetryAtRef.current = 0;
		syncReadyRef.current = false;
		setUpdateCursor(null);
		setSendError(null);
		setScene(CanvasScene.empty());
		setViews(new Map());
		setCanvasBgState("");
		setIsConnected(false);
		setConnectionError(null);

		const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
		const yViews = ydoc.getMap<Y.Map<unknown>>("viewsMap");
		const yAppState = ydoc.getMap<unknown>("appStateMap");
		const frameSync = createCanvasYjsFrameSync({
			ydoc,
			setScene,
			setViews,
			setCanvasBg: setCanvasBgState,
		});
		frameSyncRef.current = frameSync;
		const elementsObserver: Parameters<typeof yElements.observeDeep>[0] = (
			events,
		) => frameSync.elementsObserver(events);
		const viewsObserver = () => frameSync.viewsObserver();
		const appStateObserver = () => frameSync.appStateObserver();
		yElements.observeDeep(elementsObserver);
		yViews.observeDeep(viewsObserver);
		yAppState.observeDeep(appStateObserver);

		const updateObserver = (update: Uint8Array, origin: unknown) => {
			if (
				origin === REMOTE_SERVER_ORIGIN ||
				origin === PENDING_SERVER_ORIGIN ||
				readonly ||
				!syncReadyRef.current
			) {
				return;
			}
			const copy = new Uint8Array(update.byteLength);
			copy.set(update);
			sendQueueRef.current = sendQueueRef.current
				.catch(() => undefined)
				.then(async () => {
					try {
						const pending = await enqueuePendingServerUpdate({
							whiteboardId,
							clientId: clientIdRef.current,
							update: bytesToBase64(copy),
						});
						if (ydocRef.current !== ydoc) {
							void flushPendingUpdates();
							return;
						}
						appliedPendingUpdateIdsRef.current.add(pending.id);
						if (copy.byteLength >= SERVER_UPDATE_BATCH_MAX_RAW_BYTES) {
							void flushPendingUpdates();
						} else {
							schedulePendingUpdateFlush();
						}
					} catch (error) {
						try {
							await appendUpdate.mutateAsync({
								...accessInput,
								clientId: clientIdRef.current,
								update: bytesToBase64(copy),
							});
							return;
						} catch {
							// Report the queueing error; without IndexedDB the update
							// could not be made durable before the network attempt.
						}
						if (ydocRef.current !== ydoc) return;
						setSendError(
							getErrorMessage(
								error,
								"Aenderung konnte weder lokal noch auf dem Server gespeichert werden.",
							),
						);
					}
				});
		};
		ydoc.on("update", updateObserver);

		return () => {
			if (flushTimerRef.current != null) {
				window.clearTimeout(flushTimerRef.current);
				flushTimerRef.current = null;
			}
			void sendQueueRef.current.then(() => flushPendingUpdates());
			frameSync.dispose();
			if (frameSyncRef.current === frameSync) frameSyncRef.current = null;
			ydoc.off("update", updateObserver);
			yElements.unobserveDeep(elementsObserver);
			yViews.unobserveDeep(viewsObserver);
			yAppState.unobserveDeep(appStateObserver);
			ydoc.destroy();
			ydocRef.current = null;
			syncReadyRef.current = false;
			setIsConnected(false);
		};
	}, [
		enabled,
		flushPendingUpdates,
		readonly,
		accessInput,
		appendUpdate.mutateAsync,
		schedulePendingUpdateFlush,
		sendQueueRef,
		whiteboardId,
	]);

	useEffect(() => {
		if (!enabled || readonly) return;
		const retry = () => void sendQueueRef.current.then(flushPendingUpdates);
		const retryWhenVisible = () => {
			if (document.visibilityState === "visible") retry();
		};
		window.addEventListener("online", retry);
		window.addEventListener("pagehide", retry);
		document.addEventListener("visibilitychange", retryWhenVisible);
		const interval = window.setInterval(retry, 5_000);
		return () => {
			window.removeEventListener("online", retry);
			window.removeEventListener("pagehide", retry);
			document.removeEventListener("visibilitychange", retryWhenVisible);
			window.clearInterval(interval);
		};
	}, [enabled, flushPendingUpdates, readonly, sendQueueRef]);

	useEffect(() => {
		if (!updates || !ydocRef.current) return;
		const ydoc = ydocRef.current;
		let cancelled = false;
		const isCurrent = () =>
			!cancelled && ydocRef.current === ydoc && !ydoc.isDestroyed;

		const applyUpdates = async () => {
			let lastAppliedCursor: ServerUpdateCursor | null = null;
			try {
				for (const update of updates) {
					if (!isCurrent()) return;
					const cursor = {
						id: update.id,
						createdAt:
							update.cursorCreatedAt ??
							new Date(update.createdAt).toISOString(),
					};
					if (appliedUpdateIdsRef.current.has(update.id)) {
						// Auch bereits bekannte Zeilen schieben den Cursor weiter,
						// sonst könnte eine Seite aus lauter bekannten Zeilen das
						// Weiterblättern dauerhaft blockieren.
						lastAppliedCursor = cursor;
						continue;
					}
					Y.applyUpdate(
						ydoc,
						base64ToBytes(update.update),
						REMOTE_SERVER_ORIGIN,
					);
					const hasBaseUpdate = appliedUpdateIdsRef.current.size > 0;
					appliedUpdateIdsRef.current.add(update.id);
					// The first base/snapshot row is irreducible. Only later base64
					// update payload contributes to the byte compaction threshold.
					if (hasBaseUpdate) {
						compactableUpdateBytesRef.current += update.update.length;
					}
					lastAppliedCursor = cursor;
				}
			} catch (error) {
				if (!isCurrent()) return;
				syncReadyRef.current = false;
				setIsConnected(false);
				setConnectionError(
					error instanceof Error
						? error.message
						: "Board-Update konnte nicht geladen werden.",
				);
				return;
			}

			if (!isCurrent()) return;
			if (lastAppliedCursor) setUpdateCursor(lastAppliedCursor);
			// Weitere Seiten folgen: Der geänderte Cursor lädt sie sofort nach.
			if (hasMoreUpdates) {
				syncReadyRef.current = false;
				setIsConnected(false);
				return;
			}
			try {
				await applyPendingQueuedUpdates();
			} catch (error) {
				if (!isCurrent()) return;
				syncReadyRef.current = false;
				setIsConnected(false);
				setConnectionError(
					getErrorMessage(
						error,
						"Lokal gespeicherte Aenderungen konnten nicht wiederhergestellt werden.",
					),
				);
				return;
			}

			if (!isCurrent()) return;
			syncReadyRef.current = true;
			setIsConnected(true);
			setConnectionError(null);
			syncFromYjs();
			void flushPendingUpdates();

			const compactionCursor = lastAppliedCursor ?? updateCursor;
			if (
				!readonly &&
				compactionCursor &&
				ydocRef.current &&
				shouldCompactCanvasUpdateLog({
					updateCount: appliedUpdateIdsRef.current.size,
					compactableBytes: compactableUpdateBytesRef.current,
				}) &&
				!compactionInFlightRef.current &&
				// Nach Fehlschlägen erst nach Ablauf des Backoffs erneut versuchen.
				Date.now() >= compactionRetryAtRef.current
			) {
				await sendQueueRef.current.catch(() => undefined);
				if (!isCurrent()) return;
				const pendingBeforeCompaction = await listPendingServerUpdates(
					whiteboardId,
				).catch(() => []);
				if (!isCurrent() || pendingBeforeCompaction.length > 0) return;
				const snapshot = bytesToBase64(Y.encodeStateAsUpdate(ydoc));
				if (snapshot.length > BOARD_SYNC_UPDATE_MAX_CHARS) {
					// Der Snapshot würde abgelehnt. Das Log bleibt dann unkomprimiert,
					// wird aber weiterhin in größenbegrenzten Seiten geladen.
					compactionRetryAtRef.current =
						Date.now() + getCompactionRetryDelayMs(Number.POSITIVE_INFINITY);
					return;
				}
				compactionInFlightRef.current = true;
				try {
					await compactUpdates.mutateAsync({
						...accessInput,
						clientId: clientIdRef.current,
						update: snapshot,
						upToId: compactionCursor.id,
					});
					if (!isCurrent()) return;
					appliedUpdateIdsRef.current = new Set();
					compactableUpdateBytesRef.current = 0;
					compactionFailuresRef.current = 0;
					compactionRetryAtRef.current = 0;
				} catch (error) {
					if (!isCurrent()) return;
					compactionFailuresRef.current += 1;
					compactionRetryAtRef.current =
						Date.now() +
						getCompactionRetryDelayMs(compactionFailuresRef.current);
					setConnectionError(
						error instanceof Error
							? error.message
							: "Board-Log konnte nicht komprimiert werden.",
					);
				} finally {
					if (ydocRef.current === ydoc) compactionInFlightRef.current = false;
				}
			}
		};

		void applyUpdates();
		return () => {
			cancelled = true;
		};
	}, [
		accessInput,
		applyPendingQueuedUpdates,
		compactUpdates.mutateAsync,
		flushPendingUpdates,
		readonly,
		syncFromYjs,
		sendQueueRef,
		hasMoreUpdates,
		updateCursor,
		updates,
		whiteboardId,
	]);

	const guardWrite = useCallback(() => {
		if (!ydocRef.current || readonly || !syncReadyRef.current) return null;
		return ydocRef.current;
	}, [readonly]);

	const createElement = useCallback(
		(element: CanvasElement) => {
			const doc = guardWrite();
			if (doc) yjsCreateElement(doc, element);
		},
		[guardWrite],
	);
	const updateElement = useCallback(
		(id: string, changes: Partial<CanvasElement>) => {
			const doc = guardWrite();
			if (doc) yjsUpdateElement(doc, id, changes);
		},
		[guardWrite],
	);
	const updateElements = useCallback(
		(updates: Array<{ id: string; changes: Partial<CanvasElement> }>) => {
			const doc = guardWrite();
			if (doc) yjsUpdateElements(doc, updates);
		},
		[guardWrite],
	);
	const deleteElement = useCallback(
		(id: string) => {
			const doc = guardWrite();
			if (doc) yjsDeleteElement(doc, id);
		},
		[guardWrite],
	);
	const deleteElements = useCallback(
		(ids: string[]) => {
			const doc = guardWrite();
			if (doc) yjsDeleteElements(doc, ids);
		},
		[guardWrite],
	);
	const applyMutationPlan = useCallback(
		(plan: CanvasMutationPlan) => {
			const doc = guardWrite();
			if (!doc) return;
			yjsApplyCanvasMutationPlan(doc, plan);
		},
		[guardWrite],
	);
	const createView = useCallback(
		(view: SavedCanvasView) => {
			const doc = guardWrite();
			if (doc) yjsCreateView(doc, view);
		},
		[guardWrite],
	);
	const updateView = useCallback(
		(id: string, changes: Partial<SavedCanvasView>) => {
			const doc = guardWrite();
			if (doc) yjsUpdateView(doc, id, changes);
		},
		[guardWrite],
	);
	const deleteView = useCallback(
		(id: string) => {
			const doc = guardWrite();
			if (doc) yjsDeleteView(doc, id);
		},
		[guardWrite],
	);
	const setCanvasBg = useCallback(
		(value: string) => {
			const doc = guardWrite();
			if (doc) setCanvasBackgroundInYDoc(doc, value);
		},
		[guardWrite],
	);
	const loadSkedraFile = useCallback(
		(file: SkedraFile) => {
			const doc = guardWrite();
			if (doc) applySkedraFileToYDoc(doc, file);
		},
		[guardWrite],
	);
	const getYDoc = useCallback(() => ydocRef.current, []);

	return useMemo(
		() => ({
			isReady: isConnected,
			isConnected: isConnected && !updatesError && !sendError,
			isReadonly: readonly || !isConnected,
			role: (readonly || !isConnected ? "viewer" : "editor") as CanvasRole,
			scene,
			elements,
			views,
			canvasBg,
			connectionError: updatesError?.message ?? sendError ?? connectionError,
			remotePresence: presenceApi.remotePresence,
			localPresence: null as LocalCanvasPresence | null,
			createElement,
			updateElement,
			updateElements,
			deleteElement,
			deleteElements,
			applyMutationPlan,
			createView,
			updateView,
			deleteView,
			setCanvasBg,
			loadSkedraFile,
			setPresenceSelection: presenceApi.setPresenceSelection,
			setPresenceCursor: presenceApi.setPresenceCursor,
			setPresenceViewport: presenceApi.setPresenceViewport,
			setPresenceActiveView: presenceApi.setPresenceActiveView,
			getYDoc,
		}),
		[
			applyMutationPlan,
			canvasBg,
			connectionError,
			updatesError,
			sendError,
			createElement,
			createView,
			deleteElement,
			deleteElements,
			deleteView,
			elements,
			getYDoc,
			isConnected,
			loadSkedraFile,
			presenceApi.remotePresence,
			presenceApi.setPresenceActiveView,
			presenceApi.setPresenceCursor,
			presenceApi.setPresenceSelection,
			presenceApi.setPresenceViewport,
			readonly,
			scene,
			setCanvasBg,
			updateElement,
			updateElements,
			updateView,
			views,
		],
	);
}
