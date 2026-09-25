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
import {
	createE2eeKeyHash,
	decryptYjsUpdate,
	encryptYjsUpdate,
} from "@/lib/e2ee";
import {
	E2EE_UPDATE_BATCH_DELAY_MS,
	createPendingE2eeUpdateBatch,
} from "@/lib/e2ee-update-batching";
import {
	deletePendingE2eeUpdates,
	enqueuePendingE2eeUpdate,
	listPendingE2eeUpdates,
} from "@/lib/e2ee-update-queue";
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

const REMOTE_E2EE_ORIGIN = "skedra-e2ee-remote";
const PENDING_E2EE_ORIGIN = "skedra-e2ee-pending";
const E2EE_UPDATE_PAGE_SIZE = 500;

type E2eeUpdateCursor = { id: string; createdAt: string };

interface UseE2eeCanvasSyncOptions {
	e2eeKey: string | null | undefined;
	enabled?: boolean;
	readonly?: boolean;
	presentationShareToken?: string;
	presenceEnabled?: boolean;
	collabShareToken?: string;
	embedShareToken?: string;
	/**
	 * Identität für Live-Presence (Name/Farbe/Rolle). Optional — ohne Angabe wird
	 * eine minimale Standard-Identität verwendet, damit Cursor trotzdem funktionieren.
	 */
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

export function useE2eeCanvasSync(
	whiteboardId: string,
	options: UseE2eeCanvasSyncOptions,
) {
	const {
		e2eeKey,
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
	const decryptionReadyRef = useRef(false);
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
	const [updateCursor, setUpdateCursor] = useState<E2eeUpdateCursor | null>(
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
		[accessInput, e2eeKey],
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: A different board must never wait for the old board network request.
	const flushQueue = useMemo(
		() => createCanvasUpdateFlusher(),
		[accessInput, e2eeKey],
	);
	const activeFlushQueueRef = useRef(flushQueue);
	activeFlushQueueRef.current = flushQueue;
	const listInput = useMemo(
		() => ({
			...accessInput,
			afterId: updateCursor?.id,
			afterCreatedAt: updateCursor?.createdAt,
			limit: E2EE_UPDATE_PAGE_SIZE,
		}),
		[accessInput, updateCursor],
	);

	const appendUpdate = trpc.whiteboard.appendE2eeUpdate.useMutation();
	const compactUpdates = trpc.whiteboard.compactE2eeUpdates.useMutation();

	// Realtime: Wenn der SSE-Live-Kanal verbunden ist, reicht ein langsames
	// Fallback-Polling; ohne Live-Kanal (z. B. Gäste) bleibt es beim engen Poll.
	const liveConnectedRef = useRef(false);

	// Größenbegrenzte Seiten: Ein großes, unkomprimiertes Log wird in mehreren
	// Requests geladen statt in einem, der über langsame Proxys abbricht.
	const {
		data: updatePage,
		error: updatesError,
		refetch: refetchUpdates,
	} = trpc.whiteboard.listE2eeUpdatePage.useQuery(listInput, {
		enabled: enabled && !!e2eeKey && !!whiteboardId,
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

	// Nur eingeloggte Nutzer bekommen den SSE-Live-Kanal; Share-Links bleiben
	// für Dokument-Updates beim Polling. Presentation-Viewer dürfen separat in
	// den flüchtigen Presence-Kanal, wenn dies für den Link aktiviert ist.
	const isSessionUser =
		!presentationShareToken && !collabShareToken && !embedShareToken;
	const canUsePresentationPresence =
		presenceEnabled && !!presentationShareToken;

	// SSE: sofortiges Nachladen bei neuen verschlüsselten Updates.
	useBoardLiveChannel(whiteboardId, {
		enabled: enabled && !!e2eeKey && !!whiteboardId && isSessionUser,
		onEvent: () => {
			void refetchUpdates(CANVAS_LIVE_REFETCH_OPTIONS);
		},
		onCompaction: () => {
			appliedUpdateIdsRef.current = new Set();
			compactableUpdateBytesRef.current = 0;
		},
		onConnectedChange: (connected) => {
			liveConnectedRef.current = connected;
		},
	});

	// WebSocket-Presence: Live-Cursor/Auswahl, verschlüsselt relayt.
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
			!!e2eeKey &&
			!!whiteboardId &&
			presenceEnabled &&
			(isSessionUser || canUsePresentationPresence),
		encryptionMode: "e2ee",
		e2eeKey,
		identity: presenceIdentity,
		presentationShareToken,
	});
	const syncFromYjs = useCallback(() => {
		frameSyncRef.current?.syncAll();
	}, []);

	const flushPendingUpdates = useCallback(() => {
		if (!enabled || readonly || !e2eeKey || !whiteboardId) {
			return Promise.resolve();
		}
		if (flushTimerRef.current != null) {
			window.clearTimeout(flushTimerRef.current);
			flushTimerRef.current = null;
		}

		return flushQueue(async () => {
			for (;;) {
				const pending = await listPendingE2eeUpdates(whiteboardId);
				const batch = await createPendingE2eeUpdateBatch(pending, e2eeKey);
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
					keyHash: first.keyHash,
					update: batch.update,
				});
				await deletePendingE2eeUpdates(
					batch.records.map((record) => record.id),
				);
			}
			if (activeFlushQueueRef.current === flushQueue) setSendError(null);
		}).catch((error) => {
			if (activeFlushQueueRef.current !== flushQueue) return;
			setSendError(
				getErrorMessage(
					error,
					"Encrypted changes are saved locally and will be retried.",
				),
			);
		});
	}, [
		accessInput,
		appendUpdate.mutateAsync,
		e2eeKey,
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
		}, E2EE_UPDATE_BATCH_DELAY_MS);
	}, [flushPendingUpdates]);

	const applyPendingQueuedUpdates = useCallback(async () => {
		const ydoc = ydocRef.current;
		if (!e2eeKey || !ydoc) return;
		await restorePendingCanvasUpdates({
			ydoc,
			isCurrent: () => ydocRef.current === ydoc,
			load: () => listPendingE2eeUpdates(whiteboardId),
			decode: (queued) => decryptYjsUpdate(queued.update, e2eeKey),
			appliedIds: appliedPendingUpdateIdsRef.current,
			origin: PENDING_E2EE_ORIGIN,
			onRestored: syncFromYjs,
		});
	}, [e2eeKey, syncFromYjs, whiteboardId]);

	useEffect(() => {
		if (!enabled || !e2eeKey) {
			decryptionReadyRef.current = false;
			setUpdateCursor(null);
			setIsConnected(false);
			setConnectionError(
				enabled ? "E2EE key missing for this encrypted board." : null,
			);
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
		decryptionReadyRef.current = false;
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
				origin === REMOTE_E2EE_ORIGIN ||
				origin === PENDING_E2EE_ORIGIN ||
				readonly ||
				!decryptionReadyRef.current
			) {
				return;
			}
			sendQueueRef.current = sendQueueRef.current.then(async () => {
				try {
					const keyHash = await createE2eeKeyHash(e2eeKey);
					const encrypted = await encryptYjsUpdate(update, e2eeKey);
					const pending = await enqueuePendingE2eeUpdate({
						whiteboardId,
						clientId: clientIdRef.current,
						keyHash,
						update: encrypted,
					});
					if (ydocRef.current !== ydoc) {
						void flushPendingUpdates();
						return;
					}
					appliedPendingUpdateIdsRef.current.add(pending.id);
					schedulePendingUpdateFlush();
				} catch (error) {
					const keyHash = await createE2eeKeyHash(e2eeKey).catch(() => null);
					const encrypted = await encryptYjsUpdate(update, e2eeKey).catch(
						() => null,
					);
					if (keyHash && encrypted) {
						try {
							await appendUpdate.mutateAsync({
								...accessInput,
								clientId: clientIdRef.current,
								keyHash,
								update: encrypted,
							});
							return;
						} catch {
							// Report the original queueing error below.
						}
					}
					if (ydocRef.current !== ydoc) return;
					setSendError(
						getErrorMessage(error, "Encrypted update could not be saved."),
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
			decryptionReadyRef.current = false;
			setIsConnected(false);
			setSendError(null);
			setScene(CanvasScene.empty());
			setViews(new Map());
		};
	}, [
		accessInput,
		appendUpdate.mutateAsync,
		e2eeKey,
		enabled,
		flushPendingUpdates,
		readonly,
		schedulePendingUpdateFlush,
		sendQueueRef,
		whiteboardId,
	]);

	useEffect(() => {
		if (!enabled || !e2eeKey || !whiteboardId) return;
		let cancelled = false;

		const restorePendingUpdates = async () => {
			try {
				await applyPendingQueuedUpdates();
				if (!cancelled) {
					void flushPendingUpdates();
				}
			} catch (error) {
				if (cancelled) return;
				setConnectionError(
					getErrorMessage(
						error,
						"Pending encrypted updates could not be restored.",
					),
				);
			}
		};

		void restorePendingUpdates();
		return () => {
			cancelled = true;
		};
	}, [
		applyPendingQueuedUpdates,
		e2eeKey,
		enabled,
		flushPendingUpdates,
		whiteboardId,
	]);

	useEffect(() => {
		if (!enabled || readonly || !e2eeKey) return;
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
	}, [e2eeKey, enabled, flushPendingUpdates, readonly, sendQueueRef]);

	useEffect(() => {
		if (!updates || !e2eeKey || !ydocRef.current) return;
		const ydoc = ydocRef.current;

		let cancelled = false;
		const isCurrent = () =>
			!cancelled && ydocRef.current === ydoc && !ydoc.isDestroyed;
		const applyUpdates = async () => {
			let lastAppliedCursor: E2eeUpdateCursor | null = null;
			for (const update of updates) {
				if (!isCurrent()) return;
				const cursor = {
					id: update.id,
					createdAt:
						update.cursorCreatedAt ?? new Date(update.createdAt).toISOString(),
				};
				if (appliedUpdateIdsRef.current.has(update.id)) {
					// Auch bereits bekannte Zeilen schieben den Cursor weiter, sonst
					// könnte eine Seite aus lauter bekannten Zeilen das Weiterblättern
					// dauerhaft blockieren.
					lastAppliedCursor = cursor;
					continue;
				}
				try {
					const decrypted = await decryptYjsUpdate(update.update, e2eeKey);
					if (!isCurrent()) return;
					Y.applyUpdate(ydoc, decrypted, REMOTE_E2EE_ORIGIN);
					const hasBaseUpdate = appliedUpdateIdsRef.current.size > 0;
					appliedUpdateIdsRef.current.add(update.id);
					// The first row is the irreducible base/snapshot. Only subsequent
					// ASCII JSON/base64url payload can be reduced by compaction.
					if (hasBaseUpdate) {
						compactableUpdateBytesRef.current += update.update.length;
					}
					lastAppliedCursor = cursor;
				} catch {
					if (!isCurrent()) return;
					decryptionReadyRef.current = false;
					setIsConnected(false);
					setConnectionError(
						"Encrypted board update could not be decrypted. Check the E2EE key.",
					);
					return;
				}
			}
			if (!isCurrent()) return;
			if (lastAppliedCursor) {
				setUpdateCursor(lastAppliedCursor);
			}
			// Weitere Seiten folgen: Der geänderte Cursor lädt sie sofort nach.
			if (hasMoreUpdates) {
				decryptionReadyRef.current = false;
				setIsConnected(false);
				setConnectionError(null);
				return;
			}
			try {
				await applyPendingQueuedUpdates();
			} catch (error) {
				if (!isCurrent()) return;
				decryptionReadyRef.current = false;
				setIsConnected(false);
				setConnectionError(
					getErrorMessage(
						error,
						"Pending encrypted updates could not be restored.",
					),
				);
				return;
			}
			if (!isCurrent()) return;
			decryptionReadyRef.current = true;
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
				const pendingBeforeCompaction = await listPendingE2eeUpdates(
					whiteboardId,
				).catch(() => []);
				if (!isCurrent() || pendingBeforeCompaction.length > 0) return;
				compactionInFlightRef.current = true;
				try {
					const snapshotUpdate = Y.encodeStateAsUpdate(ydoc);
					const keyHash = await createE2eeKeyHash(e2eeKey);
					const encrypted = await encryptYjsUpdate(snapshotUpdate, e2eeKey);
					if (!isCurrent()) return;
					if (encrypted.length > BOARD_SYNC_UPDATE_MAX_CHARS) {
						// Der Snapshot würde abgelehnt. Das Log bleibt unkomprimiert,
						// wird aber weiterhin in größenbegrenzten Seiten geladen.
						compactionRetryAtRef.current =
							Date.now() + getCompactionRetryDelayMs(Number.POSITIVE_INFINITY);
						return;
					}
					await compactUpdates.mutateAsync({
						...accessInput,
						clientId: clientIdRef.current,
						keyHash,
						update: encrypted,
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
							: "Encrypted update log could not be compacted.",
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
		e2eeKey,
		flushPendingUpdates,
		readonly,
		syncFromYjs,
		sendQueueRef,
		hasMoreUpdates,
		updateCursor,
		updates,
		whiteboardId,
	]);

	const guardWrite = useCallback((): Y.Doc | null => {
		if (!ydocRef.current || readonly || !decryptionReadyRef.current)
			return null;
		return ydocRef.current;
	}, [readonly]);

	const createElement = useCallback(
		(element: CanvasElement) => {
			const ydoc = guardWrite();
			if (!ydoc) return;
			yjsCreateElement(ydoc, element);
		},
		[guardWrite],
	);

	const updateElement = useCallback(
		(id: string, changes: Partial<CanvasElement>) => {
			const ydoc = guardWrite();
			if (!ydoc) return;
			yjsUpdateElement(ydoc, id, changes);
		},
		[guardWrite],
	);

	const updateElements = useCallback(
		(updates: Array<{ id: string; changes: Partial<CanvasElement> }>) => {
			const ydoc = guardWrite();
			if (!ydoc) return;
			yjsUpdateElements(ydoc, updates);
		},
		[guardWrite],
	);

	const deleteElement = useCallback(
		(id: string) => {
			const ydoc = guardWrite();
			if (!ydoc) return;
			yjsDeleteElement(ydoc, id);
		},
		[guardWrite],
	);

	const deleteElements = useCallback(
		(ids: string[]) => {
			const ydoc = guardWrite();
			if (!ydoc) return;
			yjsDeleteElements(ydoc, ids);
		},
		[guardWrite],
	);

	const applyMutationPlan = useCallback(
		(plan: CanvasMutationPlan) => {
			const ydoc = guardWrite();
			if (!ydoc) return;
			yjsApplyCanvasMutationPlan(ydoc, plan);
		},
		[guardWrite],
	);

	const createView = useCallback(
		(view: SavedCanvasView) => {
			const ydoc = guardWrite();
			if (!ydoc) return;
			yjsCreateView(ydoc, view);
		},
		[guardWrite],
	);

	const updateView = useCallback(
		(id: string, changes: Partial<SavedCanvasView>) => {
			const ydoc = guardWrite();
			if (!ydoc) return;
			yjsUpdateView(ydoc, id, changes);
		},
		[guardWrite],
	);

	const deleteView = useCallback(
		(id: string) => {
			const ydoc = guardWrite();
			if (!ydoc) return;
			yjsDeleteView(ydoc, id);
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
			const ydoc = guardWrite();
			if (!ydoc) return;
			applySkedraFileToYDoc(ydoc, file);
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
			// Realtime-Presence (ersetzt den bisherigen No-op).
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
