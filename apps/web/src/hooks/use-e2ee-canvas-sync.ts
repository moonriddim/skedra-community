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
import { readCanvasMapsFromYDoc } from "@/lib/canvas/yjs-document-helpers";
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
import type { CanvasElement, SavedCanvasView } from "@skedra/canvas-core";
import { CanvasScene } from "@skedra/canvas-core";
import type { CanvasSkedraFile as SkedraFile } from "@skedra/canvas-io/file";
import type { CanvasRole } from "@skedra/shared";
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
	const syncFrameRef = useRef<number | null>(null);
	const appliedUpdateIdsRef = useRef<Set<string>>(new Set());
	const compactableUpdateBytesRef = useRef(0);
	const appliedPendingUpdateIdsRef = useRef<Set<string>>(new Set());
	const sendQueueRef = useRef(Promise.resolve());
	const flushQueueRef = useRef(Promise.resolve());
	const flushTimerRef = useRef<number | null>(null);
	const clientIdRef = useRef(createClientId());
	const decryptionReadyRef = useRef(false);
	const compactionInFlightRef = useRef(false);
	const [scene, setScene] = useState(() => CanvasScene.empty());
	const elements = scene.getElementsMap();
	const [views, setViews] = useState<Map<string, SavedCanvasView>>(new Map());
	const [isConnected, setIsConnected] = useState(false);
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
	const listInput = useMemo(
		() => ({
			...accessInput,
			afterId: updateCursor?.id,
			afterCreatedAt: updateCursor?.createdAt,
			limit: E2EE_UPDATE_PAGE_SIZE,
		}),
		[accessInput, updateCursor],
	);

	const appendUpdate = trpc.whiteboard.appendE2eeUpdate.useMutation({
		onError(error) {
			setConnectionError(error.message);
		},
	});
	const compactUpdates = trpc.whiteboard.compactE2eeUpdates.useMutation({
		onError(error) {
			setConnectionError(error.message);
		},
	});

	// Realtime: Wenn der SSE-Live-Kanal verbunden ist, reicht ein langsames
	// Fallback-Polling; ohne Live-Kanal (z. B. Gäste) bleibt es beim engen Poll.
	const liveConnectedRef = useRef(false);

	const { data: updates, refetch: refetchUpdates } =
		trpc.whiteboard.listE2eeUpdates.useQuery(listInput, {
			enabled: enabled && !!e2eeKey && !!whiteboardId,
			refetchInterval: () => (liveConnectedRef.current ? 8000 : 1500),
			refetchIntervalInBackground: true,
			retry: 1,
		});

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
			void refetchUpdates();
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
			(isSessionUser || canUsePresentationPresence),
		encryptionMode: "e2ee",
		e2eeKey,
		identity: presenceIdentity,
		presentationShareToken,
	});

	const syncFromYjs = useCallback(() => {
		const ydoc = ydocRef.current;
		if (!ydoc) return;
		const next = readCanvasMapsFromYDoc(ydoc);
		setScene(CanvasScene.from(next.elements));
		setViews(next.views);
	}, []);

	const scheduleSyncFromYjs = useCallback(() => {
		if (syncFrameRef.current != null) return;
		syncFrameRef.current = window.requestAnimationFrame(() => {
			syncFrameRef.current = null;
			syncFromYjs();
		});
	}, [syncFromYjs]);

	const flushPendingUpdates = useCallback(() => {
		if (!enabled || readonly || !e2eeKey || !whiteboardId) {
			return Promise.resolve();
		}
		if (flushTimerRef.current != null) {
			window.clearTimeout(flushTimerRef.current);
			flushTimerRef.current = null;
		}

		const run = flushQueueRef.current
			.catch(() => undefined)
			.then(async () => {
				let flushedAny = false;
				for (;;) {
					const pending = await listPendingE2eeUpdates(whiteboardId);
					const batch = await createPendingE2eeUpdateBatch(pending, e2eeKey);
					const first = batch?.records[0];
					if (!batch || !first) break;
					await appendUpdate.mutateAsync({
						...accessInput,
						clientId: first.clientId,
						keyHash: first.keyHash,
						update: batch.update,
					});
					await deletePendingE2eeUpdates(
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
						"Encrypted changes are saved locally and will be retried.",
					),
				);
			});

		flushQueueRef.current = run;
		return run;
	}, [
		accessInput,
		appendUpdate.mutateAsync,
		e2eeKey,
		enabled,
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
		if (!e2eeKey || !ydocRef.current) return;
		const pending = await listPendingE2eeUpdates(whiteboardId);
		for (const queued of pending) {
			if (appliedPendingUpdateIdsRef.current.has(queued.id)) continue;
			const decrypted = await decryptYjsUpdate(queued.update, e2eeKey);
			if (!ydocRef.current) return;
			Y.applyUpdate(ydocRef.current, decrypted, PENDING_E2EE_ORIGIN);
			appliedPendingUpdateIdsRef.current.add(queued.id);
		}
		if (pending.length > 0) {
			syncFromYjs();
		}
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

		const ydoc = new Y.Doc({ gc: false });
		ydocRef.current = ydoc;
		appliedUpdateIdsRef.current = new Set();
		compactableUpdateBytesRef.current = 0;
		appliedPendingUpdateIdsRef.current = new Set();
		decryptionReadyRef.current = false;
		setUpdateCursor(null);
		setScene(CanvasScene.empty());
		setViews(new Map());
		setIsConnected(false);
		setConnectionError(null);

		const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
		const yViews = ydoc.getMap<Y.Map<unknown>>("viewsMap");

		const deepObserver = scheduleSyncFromYjs;
		yElements.observeDeep(deepObserver);
		yViews.observeDeep(deepObserver);

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
					setConnectionError(
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
			if (syncFrameRef.current != null) {
				window.cancelAnimationFrame(syncFrameRef.current);
				syncFrameRef.current = null;
			}
			ydoc.off("update", updateObserver);
			yElements.unobserveDeep(deepObserver);
			yViews.unobserveDeep(deepObserver);
			ydoc.destroy();
			ydocRef.current = null;
			decryptionReadyRef.current = false;
			setIsConnected(false);
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
		scheduleSyncFromYjs,
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
	}, [e2eeKey, enabled, flushPendingUpdates, readonly]);

	useEffect(() => {
		if (!updates || !e2eeKey || !ydocRef.current) return;

		let cancelled = false;
		const applyUpdates = async () => {
			let lastAppliedCursor: E2eeUpdateCursor | null = null;
			for (const update of updates) {
				if (cancelled || appliedUpdateIdsRef.current.has(update.id)) continue;
				try {
					const decrypted = await decryptYjsUpdate(update.update, e2eeKey);
					Y.applyUpdate(
						ydocRef.current as Y.Doc,
						decrypted,
						REMOTE_E2EE_ORIGIN,
					);
					const hasBaseUpdate = appliedUpdateIdsRef.current.size > 0;
					appliedUpdateIdsRef.current.add(update.id);
					// The first row is the irreducible base/snapshot. Only subsequent
					// ASCII JSON/base64url payload can be reduced by compaction.
					if (hasBaseUpdate) {
						compactableUpdateBytesRef.current += update.update.length;
					}
					lastAppliedCursor = {
						id: update.id,
						createdAt: new Date(update.createdAt).toISOString(),
					};
				} catch {
					decryptionReadyRef.current = false;
					setIsConnected(false);
					setConnectionError(
						"Encrypted board update could not be decrypted. Check the E2EE key.",
					);
					return;
				}
			}
			if (cancelled) return;
			if (lastAppliedCursor) {
				setUpdateCursor(lastAppliedCursor);
			}
			if (updates.length >= E2EE_UPDATE_PAGE_SIZE) {
				decryptionReadyRef.current = false;
				setIsConnected(false);
				setConnectionError(null);
				return;
			}
			try {
				await applyPendingQueuedUpdates();
			} catch (error) {
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
				!compactionInFlightRef.current
			) {
				const pendingBeforeCompaction = await listPendingE2eeUpdates(
					whiteboardId,
				).catch(() => []);
				if (pendingBeforeCompaction.length > 0) return;
				compactionInFlightRef.current = true;
				try {
					const snapshotUpdate = Y.encodeStateAsUpdate(ydocRef.current);
					const keyHash = await createE2eeKeyHash(e2eeKey);
					const encrypted = await encryptYjsUpdate(snapshotUpdate, e2eeKey);
					await compactUpdates.mutateAsync({
						...accessInput,
						clientId: clientIdRef.current,
						keyHash,
						update: encrypted,
						upToId: compactionCursor.id,
					});
					appliedUpdateIdsRef.current = new Set();
					compactableUpdateBytesRef.current = 0;
				} catch (error) {
					setConnectionError(
						error instanceof Error
							? error.message
							: "Encrypted update log could not be compacted.",
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
		e2eeKey,
		flushPendingUpdates,
		readonly,
		syncFromYjs,
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

	const loadSkedraFile = useCallback(
		(file: SkedraFile) => {
			const ydoc = guardWrite();
			if (!ydoc) return;
			applySkedraFileToYDoc(ydoc, file);
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
		connectionError,
		// Realtime-Presence (ersetzt den bisherigen No-op).
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
		loadSkedraFile,
		setPresenceSelection: presenceApi.setPresenceSelection,
		setPresenceCursor: presenceApi.setPresenceCursor,
		setPresenceViewport: presenceApi.setPresenceViewport,
		setPresenceActiveView: presenceApi.setPresenceActiveView,
		getYDoc,
	};
}
