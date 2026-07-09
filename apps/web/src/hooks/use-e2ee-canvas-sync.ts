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
import { decryptYjsUpdate, encryptYjsUpdate } from "@/lib/e2ee";
import { trpc } from "@/lib/trpc";
import type {
	CanvasElement,
	SavedCanvasView,
	Viewport,
} from "@skedra/canvas-core";
import { CanvasScene } from "@skedra/canvas-core";
import type { RealtimeRole, SkedraFile } from "@skedra/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import type {
	LocalCanvasPresence,
	RemoteCanvasPresence,
} from "./use-canvas-sync";

const REMOTE_E2EE_ORIGIN = "skedra-e2ee-remote";

interface UseE2eeCanvasSyncOptions {
	e2eeKey: string | null | undefined;
	enabled?: boolean;
	readonly?: boolean;
	presentationShareToken?: string;
	collabShareToken?: string;
	embedShareToken?: string;
}

function createClientId() {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
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
		collabShareToken,
		embedShareToken,
	} = options;
	const ydocRef = useRef<Y.Doc | null>(null);
	const syncFrameRef = useRef<number | null>(null);
	const appliedUpdateIdsRef = useRef<Set<string>>(new Set());
	const sendQueueRef = useRef(Promise.resolve());
	const clientIdRef = useRef(createClientId());
	const [scene, setScene] = useState(() => CanvasScene.empty());
	const elements = scene.getElementsMap();
	const [views, setViews] = useState<Map<string, SavedCanvasView>>(new Map());
	const [isConnected, setIsConnected] = useState(false);
	const [connectionError, setConnectionError] = useState<string | null>(null);
	const accessInput = useMemo(
		() => ({
			whiteboardId,
			presentationShareToken,
			collabShareToken,
			embedShareToken,
		}),
		[collabShareToken, embedShareToken, presentationShareToken, whiteboardId],
	);

	const appendUpdate = trpc.whiteboard.appendE2eeUpdate.useMutation({
		onError(error) {
			setConnectionError(error.message);
		},
	});

	const { data: updates } = trpc.whiteboard.listE2eeUpdates.useQuery(
		accessInput,
		{
			enabled: enabled && !!e2eeKey && !!whiteboardId,
			refetchInterval: 1500,
			refetchIntervalInBackground: true,
			retry: 1,
		},
	);

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

	useEffect(() => {
		if (!enabled || !e2eeKey) {
			setIsConnected(false);
			setConnectionError(
				enabled ? "E2EE key missing for this encrypted board." : null,
			);
			return;
		}

		const ydoc = new Y.Doc({ gc: false });
		ydocRef.current = ydoc;
		appliedUpdateIdsRef.current = new Set();
		setScene(CanvasScene.empty());
		setViews(new Map());
		setIsConnected(true);
		setConnectionError(null);

		const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
		const yViews = ydoc.getMap<Y.Map<unknown>>("viewsMap");

		const deepObserver = scheduleSyncFromYjs;
		yElements.observeDeep(deepObserver);
		yViews.observeDeep(deepObserver);

		const updateObserver = (update: Uint8Array, origin: unknown) => {
			if (origin === REMOTE_E2EE_ORIGIN || readonly) return;
			sendQueueRef.current = sendQueueRef.current.then(async () => {
				try {
					const encrypted = await encryptYjsUpdate(update, e2eeKey);
					await appendUpdate.mutateAsync({
						...accessInput,
						clientId: clientIdRef.current,
						update: encrypted,
					});
				} catch (error) {
					setConnectionError(
						error instanceof Error
							? error.message
							: "Encrypted update could not be saved.",
					);
				}
			});
		};
		ydoc.on("update", updateObserver);

		return () => {
			if (syncFrameRef.current != null) {
				window.cancelAnimationFrame(syncFrameRef.current);
				syncFrameRef.current = null;
			}
			ydoc.off("update", updateObserver);
			yElements.unobserveDeep(deepObserver);
			yViews.unobserveDeep(deepObserver);
			ydoc.destroy();
			ydocRef.current = null;
			setIsConnected(false);
			setScene(CanvasScene.empty());
			setViews(new Map());
		};
	}, [
		accessInput,
		appendUpdate.mutateAsync,
		e2eeKey,
		enabled,
		readonly,
		scheduleSyncFromYjs,
	]);

	useEffect(() => {
		if (!updates || !e2eeKey || !ydocRef.current) return;

		let cancelled = false;
		const applyUpdates = async () => {
			for (const update of updates) {
				if (cancelled || appliedUpdateIdsRef.current.has(update.id)) continue;
				try {
					const decrypted = await decryptYjsUpdate(update.update, e2eeKey);
					Y.applyUpdate(
						ydocRef.current as Y.Doc,
						decrypted,
						REMOTE_E2EE_ORIGIN,
					);
					appliedUpdateIdsRef.current.add(update.id);
				} catch {
					setConnectionError(
						"Encrypted board update could not be decrypted. Check the E2EE key.",
					);
					return;
				}
			}
			syncFromYjs();
		};

		void applyUpdates();
		return () => {
			cancelled = true;
		};
	}, [e2eeKey, syncFromYjs, updates]);

	const guardWrite = useCallback((): Y.Doc | null => {
		if (!ydocRef.current || readonly) return null;
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

	const noopPresence = useCallback((_value?: unknown) => {}, []);

	return {
		isConnected,
		isReadonly: readonly,
		role: (readonly ? "viewer" : "editor") as RealtimeRole,
		scene,
		elements,
		views,
		connectionError,
		remotePresence: [] as RemoteCanvasPresence[],
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
		setPresenceSelection: noopPresence as (selection: string[]) => void,
		setPresenceCursor: noopPresence as (
			cursor: { x: number; y: number } | null,
		) => void,
		setPresenceViewport: noopPresence as (viewport: Viewport) => void,
		setPresenceActiveView: noopPresence as (
			activeViewId: string | null,
		) => void,
		getYDoc: () => ydocRef.current,
	};
}
