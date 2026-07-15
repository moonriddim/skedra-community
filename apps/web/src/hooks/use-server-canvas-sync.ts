import { shouldCompactCanvasUpdateLog } from "@/lib/canvas-sync-policy";
import { applySkedraFileToYDoc } from "@/lib/canvas/skedra-file-utils";
import {
	yjsCreateElement,
	yjsCreateView,
	yjsDeleteElement,
	yjsDeleteElements,
	yjsDeleteView,
	yjsUpdateElement,
	yjsUpdateElements,
	yjsUpdateView,
} from "@/lib/canvas/yjs-canvas-mutations";
import {
	readCanvasMapsFromYDoc,
	setCanvasBackgroundInYDoc,
} from "@/lib/canvas/yjs-document-helpers";
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
import type { CanvasElement, SavedCanvasView } from "@skedra/canvas-core";
import { CanvasScene } from "@skedra/canvas-core";
import type { CanvasSkedraFile as SkedraFile } from "@skedra/canvas-io/file";
import type { CanvasRole } from "@skedra/shared";
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
	const syncFrameRef = useRef<number | null>(null);
	const appliedUpdateIdsRef = useRef<Set<string>>(new Set());
	const compactableUpdateBytesRef = useRef(0);
	const appliedPendingUpdateIdsRef = useRef<Set<string>>(new Set());
	const sendQueueRef = useRef(Promise.resolve());
	const flushQueueRef = useRef(Promise.resolve());
	const flushTimerRef = useRef<number | null>(null);
	const clientIdRef = useRef(createClientId());
	const syncReadyRef = useRef(false);
	const compactionInFlightRef = useRef(false);
	const [scene, setScene] = useState(() => CanvasScene.empty());
	const elements = scene.getElementsMap();
	const [views, setViews] = useState<Map<string, SavedCanvasView>>(new Map());
	const [canvasBg, setCanvasBgState] = useState("");
	const [isConnected, setIsConnected] = useState(false);
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
	const { data: updates, refetch: refetchUpdates } =
		trpc.whiteboard.listServerUpdates.useQuery(listInput, {
			enabled: enabled && !!whiteboardId,
			refetchInterval: () => (liveConnectedRef.current ? 8000 : 1500),
			refetchIntervalInBackground: true,
			retry: 1,
		});

	const isSessionUser =
		!presentationShareToken && !collabShareToken && !embedShareToken;
	const canUsePresentationPresence =
		presenceEnabled && !!presentationShareToken;
	useBoardLiveChannel(whiteboardId, {
		enabled: enabled && !!whiteboardId && isSessionUser,
		onEvent: () => void refetchUpdates(),
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
			(isSessionUser || canUsePresentationPresence),
		encryptionMode: "server",
		e2eeKey: null,
		identity: presenceIdentity,
		presentationShareToken,
	});

	const syncFromYjs = useCallback(() => {
		const ydoc = ydocRef.current;
		if (!ydoc) return;
		const next = readCanvasMapsFromYDoc(ydoc);
		setScene(CanvasScene.from(next.elements));
		setViews(next.views);
		setCanvasBgState(next.canvasBg);
	}, []);

	const scheduleSyncFromYjs = useCallback(() => {
		if (syncFrameRef.current != null) return;
		syncFrameRef.current = window.requestAnimationFrame(() => {
			syncFrameRef.current = null;
			syncFromYjs();
		});
	}, [syncFromYjs]);

	const flushPendingUpdates = useCallback(() => {
		if (!enabled || readonly || !whiteboardId) return Promise.resolve();
		if (flushTimerRef.current != null) {
			window.clearTimeout(flushTimerRef.current);
			flushTimerRef.current = null;
		}

		const run = flushQueueRef.current
			.catch(() => undefined)
			.then(async () => {
				let flushedAny = false;
				for (;;) {
					const pending = await listPendingServerUpdates(whiteboardId);
					const batch = createPendingServerUpdateBatch(pending);
					const first = batch?.records[0];
					if (!batch || !first) break;
					await appendUpdate.mutateAsync({
						...accessInput,
						clientId: first.clientId,
						update: batch.update,
					});
					await deletePendingServerUpdates(
						batch.records.map((record) => record.id),
					);
					flushedAny = true;
				}
				if (flushedAny) setConnectionError(null);
			})
			.catch((error) => {
				setConnectionError(
					getErrorMessage(
						error,
						"Aenderungen sind lokal gespeichert und werden erneut gesendet.",
					),
				);
			});
		flushQueueRef.current = run;
		return run;
	}, [accessInput, appendUpdate.mutateAsync, enabled, readonly, whiteboardId]);

	const schedulePendingUpdateFlush = useCallback(() => {
		if (flushTimerRef.current != null) return;
		flushTimerRef.current = window.setTimeout(() => {
			flushTimerRef.current = null;
			void flushPendingUpdates();
		}, SERVER_UPDATE_BATCH_DELAY_MS);
	}, [flushPendingUpdates]);

	const applyPendingQueuedUpdates = useCallback(async () => {
		if (readonly || !ydocRef.current) return;
		const pending = await listPendingServerUpdates(whiteboardId);
		for (const queued of pending) {
			if (appliedPendingUpdateIdsRef.current.has(queued.id)) continue;
			Y.applyUpdate(
				ydocRef.current,
				base64ToBytes(queued.update),
				PENDING_SERVER_ORIGIN,
			);
			appliedPendingUpdateIdsRef.current.add(queued.id);
		}
		if (pending.length > 0) syncFromYjs();
	}, [readonly, syncFromYjs, whiteboardId]);

	useEffect(() => {
		if (!enabled) {
			syncReadyRef.current = false;
			setIsConnected(false);
			return;
		}

		const ydoc = new Y.Doc({ gc: false });
		ydocRef.current = ydoc;
		appliedUpdateIdsRef.current = new Set();
		compactableUpdateBytesRef.current = 0;
		appliedPendingUpdateIdsRef.current = new Set();
		syncReadyRef.current = false;
		setUpdateCursor(null);
		setScene(CanvasScene.empty());
		setViews(new Map());
		setCanvasBgState("");
		setIsConnected(false);
		setConnectionError(null);

		const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
		const yViews = ydoc.getMap<Y.Map<unknown>>("viewsMap");
		const yAppState = ydoc.getMap<unknown>("appStateMap");
		yElements.observeDeep(scheduleSyncFromYjs);
		yViews.observeDeep(scheduleSyncFromYjs);
		yAppState.observeDeep(scheduleSyncFromYjs);

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
						setConnectionError(
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
			if (syncFrameRef.current != null) {
				window.cancelAnimationFrame(syncFrameRef.current);
				syncFrameRef.current = null;
			}
			ydoc.off("update", updateObserver);
			yElements.unobserveDeep(scheduleSyncFromYjs);
			yViews.unobserveDeep(scheduleSyncFromYjs);
			yAppState.unobserveDeep(scheduleSyncFromYjs);
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
		scheduleSyncFromYjs,
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
	}, [enabled, flushPendingUpdates, readonly]);

	useEffect(() => {
		if (!updates || !ydocRef.current) return;
		let cancelled = false;

		const applyUpdates = async () => {
			let lastAppliedCursor: ServerUpdateCursor | null = null;
			try {
				for (const update of updates) {
					if (cancelled || appliedUpdateIdsRef.current.has(update.id)) continue;
					Y.applyUpdate(
						ydocRef.current as Y.Doc,
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
					lastAppliedCursor = {
						id: update.id,
						createdAt: new Date(update.createdAt).toISOString(),
					};
				}
			} catch (error) {
				syncReadyRef.current = false;
				setIsConnected(false);
				setConnectionError(
					error instanceof Error
						? error.message
						: "Board-Update konnte nicht geladen werden.",
				);
				return;
			}

			if (cancelled) return;
			if (lastAppliedCursor) setUpdateCursor(lastAppliedCursor);
			if (updates.length >= SERVER_UPDATE_PAGE_SIZE) {
				syncReadyRef.current = false;
				setIsConnected(false);
				return;
			}
			try {
				await applyPendingQueuedUpdates();
			} catch (error) {
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
				!compactionInFlightRef.current
			) {
				await sendQueueRef.current.catch(() => undefined);
				const pendingBeforeCompaction = await listPendingServerUpdates(
					whiteboardId,
				).catch(() => []);
				if (pendingBeforeCompaction.length > 0) return;
				compactionInFlightRef.current = true;
				try {
					await compactUpdates.mutateAsync({
						...accessInput,
						clientId: clientIdRef.current,
						update: bytesToBase64(Y.encodeStateAsUpdate(ydocRef.current)),
						upToId: compactionCursor.id,
					});
					appliedUpdateIdsRef.current = new Set();
					compactableUpdateBytesRef.current = 0;
				} catch (error) {
					setConnectionError(
						error instanceof Error
							? error.message
							: "Board-Log konnte nicht komprimiert werden.",
					);
				} finally {
					compactionInFlightRef.current = false;
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

	return {
		isConnected,
		isReadonly: readonly || !isConnected,
		role: (readonly || !isConnected ? "viewer" : "editor") as CanvasRole,
		scene,
		elements,
		views,
		canvasBg,
		connectionError,
		remotePresence: presenceApi.remotePresence,
		localPresence: null as LocalCanvasPresence | null,
		createElement,
		updateElement,
		updateElements,
		deleteElement,
		deleteElements,
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
	};
}
