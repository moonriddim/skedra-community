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
import { base64ToBytes } from "@/lib/e2ee";
import { trpc } from "@/lib/trpc";
import type { CanvasElement, SavedCanvasView } from "@skedra/canvas-core";
import { CanvasScene } from "@skedra/canvas-core";
import type { CanvasRole, SkedraFile } from "@skedra/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import type { LocalCanvasPresence } from "./canvas-sync-types";
import { useBoardLiveChannel } from "./use-board-live-channel";
import { type PresenceIdentity, useBoardPresence } from "./use-board-presence";

const REMOTE_SERVER_ORIGIN = "skedra-server-remote";
const SERVER_UPDATE_PAGE_SIZE = 500;
const SERVER_COMPACT_AFTER_UPDATES = 2000;

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

function bytesToBase64(bytes: Uint8Array) {
	let binary = "";
	const chunkSize = 0x8000;
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binary += String.fromCharCode(
			...bytes.subarray(offset, offset + chunkSize),
		);
	}
	return btoa(binary);
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
	const pendingUpdatesRef = useRef<Uint8Array[]>([]);
	const flushInFlightRef = useRef<Promise<void> | null>(null);
	const clientIdRef = useRef(createClientId());
	const syncReadyRef = useRef(false);
	const compactionInFlightRef = useRef(false);
	const [scene, setScene] = useState(() => CanvasScene.empty());
	const elements = scene.getElementsMap();
	const [views, setViews] = useState<Map<string, SavedCanvasView>>(new Map());
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
		if (flushInFlightRef.current) return flushInFlightRef.current;

		const run = (async () => {
			while (pendingUpdatesRef.current.length > 0) {
				const update = pendingUpdatesRef.current[0];
				await appendUpdate.mutateAsync({
					...accessInput,
					clientId: clientIdRef.current,
					update: bytesToBase64(update),
				});
				pendingUpdatesRef.current.shift();
			}
			setConnectionError(null);
		})()
			.catch((error) => {
				setConnectionError(
					error instanceof Error
						? error.message
						: "Aenderungen konnten nicht gespeichert werden.",
				);
			})
			.finally(() => {
				flushInFlightRef.current = null;
			});
		flushInFlightRef.current = run;
		return run;
	}, [accessInput, appendUpdate.mutateAsync, enabled, readonly, whiteboardId]);

	useEffect(() => {
		if (!enabled) {
			syncReadyRef.current = false;
			setIsConnected(false);
			return;
		}

		const ydoc = new Y.Doc({ gc: false });
		ydocRef.current = ydoc;
		appliedUpdateIdsRef.current = new Set();
		syncReadyRef.current = false;
		setUpdateCursor(null);
		setScene(CanvasScene.empty());
		setViews(new Map());
		setIsConnected(false);
		setConnectionError(null);

		const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
		const yViews = ydoc.getMap<Y.Map<unknown>>("viewsMap");
		yElements.observeDeep(scheduleSyncFromYjs);
		yViews.observeDeep(scheduleSyncFromYjs);

		const updateObserver = (update: Uint8Array, origin: unknown) => {
			if (origin === REMOTE_SERVER_ORIGIN || readonly || !syncReadyRef.current)
				return;
			const copy = new Uint8Array(update.byteLength);
			copy.set(update);
			pendingUpdatesRef.current.push(copy);
			void flushPendingUpdates();
		};
		ydoc.on("update", updateObserver);

		return () => {
			if (syncFrameRef.current != null) {
				window.cancelAnimationFrame(syncFrameRef.current);
				syncFrameRef.current = null;
			}
			ydoc.off("update", updateObserver);
			yElements.unobserveDeep(scheduleSyncFromYjs);
			yViews.unobserveDeep(scheduleSyncFromYjs);
			ydoc.destroy();
			ydocRef.current = null;
			syncReadyRef.current = false;
			setIsConnected(false);
		};
	}, [enabled, flushPendingUpdates, readonly, scheduleSyncFromYjs]);

	useEffect(() => {
		if (!enabled || readonly) return;
		const retry = () => void flushPendingUpdates();
		window.addEventListener("online", retry);
		const interval = window.setInterval(retry, 5_000);
		return () => {
			window.removeEventListener("online", retry);
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
					appliedUpdateIdsRef.current.add(update.id);
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
				appliedUpdateIdsRef.current.size >= SERVER_COMPACT_AFTER_UPDATES &&
				pendingUpdatesRef.current.length === 0 &&
				!compactionInFlightRef.current
			) {
				compactionInFlightRef.current = true;
				try {
					await compactUpdates.mutateAsync({
						...accessInput,
						clientId: clientIdRef.current,
						update: bytesToBase64(Y.encodeStateAsUpdate(ydocRef.current)),
						upToId: compactionCursor.id,
					});
					appliedUpdateIdsRef.current = new Set();
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
		compactUpdates.mutateAsync,
		flushPendingUpdates,
		readonly,
		syncFromYjs,
		updateCursor,
		updates,
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
		loadSkedraFile,
		setPresenceSelection: presenceApi.setPresenceSelection,
		setPresenceCursor: presenceApi.setPresenceCursor,
		setPresenceViewport: presenceApi.setPresenceViewport,
		setPresenceActiveView: presenceApi.setPresenceActiveView,
		getYDoc,
	};
}
