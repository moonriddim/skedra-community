/**
 * Lokaler Canvas-Sync ohne Server: Y.js im Browser mit localStorage-Persistenz.
 * Fuer den Gastmodus — zeichnen ohne Login, Speichern in der Cloud erst nach Anmeldung.
 */

import {
	buildReplaceAllHistoryEntry,
	transactLocalUndo,
} from "@/lib/canvas/canvas-undo";
import { clearGuestCanvasViewport } from "@/lib/canvas/canvas-viewport-storage";
import {
	clearLocalCanvasState,
	loadLocalCanvasStateBase64,
	saveLocalCanvasStateBase64,
} from "@/lib/canvas/local-canvas-storage";
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
	applyYDocStateBase64,
	encodeYDocStateBase64,
	readCanvasMapsFromYDoc,
	setCanvasBackgroundInYDoc,
} from "@/lib/canvas/yjs-document-helpers";
import type {
	CanvasElement,
	SavedCanvasView,
	Viewport,
} from "@skedra/canvas-core";
import { CanvasScene } from "@skedra/canvas-core";
import type { CanvasSkedraFile as SkedraFile } from "@skedra/canvas-io/file";
import type { CanvasRole } from "@skedra/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import type {
	LocalCanvasPresence,
	RemoteCanvasPresence,
} from "./canvas-sync-types";

const LOCAL_SAVE_DEBOUNCE_MS = 400;

export function useLocalCanvasSync(enabled = true) {
	const ydocRef = useRef<Y.Doc | null>(null);
	const saveTimerRef = useRef<number | null>(null);
	const syncFrameRef = useRef<number | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [scene, setScene] = useState(() => CanvasScene.empty());
	const elements = scene.getElementsMap();
	const [views, setViews] = useState<Map<string, SavedCanvasView>>(new Map());
	const [canvasBg, setCanvasBgState] = useState("");

	const schedulePersist = useCallback(() => {
		const ydoc = ydocRef.current;
		if (!ydoc) return;

		if (saveTimerRef.current != null) {
			window.clearTimeout(saveTimerRef.current);
		}

		saveTimerRef.current = window.setTimeout(() => {
			saveLocalCanvasStateBase64(encodeYDocStateBase64(ydoc));
		}, LOCAL_SAVE_DEBOUNCE_MS);
	}, []);

	useEffect(() => {
		if (!enabled) return;

		const ydoc = new Y.Doc({ gc: false });
		ydocRef.current = ydoc;

		const savedState = loadLocalCanvasStateBase64();
		if (savedState) {
			try {
				applyYDocStateBase64(ydoc, savedState);
			} catch {
				// Beschaedigter lokaler Stand — mit leerem Canvas starten.
			}
		}

		const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
		const yViews = ydoc.getMap<Y.Map<unknown>>("viewsMap");
		const yAppState = ydoc.getMap<unknown>("appStateMap");

		const syncFromYjs = () => {
			const next = readCanvasMapsFromYDoc(ydoc);
			setScene(CanvasScene.from(next.elements));
			setViews(next.views);
			setCanvasBgState(next.canvasBg);
		};

		const scheduleSyncFromYjs = () => {
			if (syncFrameRef.current != null) return;
			syncFrameRef.current = window.requestAnimationFrame(() => {
				syncFrameRef.current = null;
				syncFromYjs();
			});
		};

		const observer = () => {
			scheduleSyncFromYjs();
			schedulePersist();
		};

		yElements.observeDeep(observer);
		yViews.observeDeep(observer);
		yAppState.observeDeep(observer);
		ydoc.on("update", schedulePersist);
		syncFromYjs();
		setIsConnected(true);

		return () => {
			if (saveTimerRef.current != null) {
				window.clearTimeout(saveTimerRef.current);
			}
			if (syncFrameRef.current != null) {
				window.cancelAnimationFrame(syncFrameRef.current);
				syncFrameRef.current = null;
			}
			yElements.unobserveDeep(observer);
			yViews.unobserveDeep(observer);
			yAppState.unobserveDeep(observer);
			ydoc.destroy();
			ydocRef.current = null;
			setIsConnected(false);
			setScene(CanvasScene.empty());
			setViews(new Map());
		};
	}, [enabled, schedulePersist]);

	const createElement = useCallback((element: CanvasElement) => {
		const ydoc = ydocRef.current;
		if (!ydoc) return;
		yjsCreateElement(ydoc, element);
	}, []);

	const updateElement = useCallback(
		(id: string, updates: Partial<CanvasElement>) => {
			const ydoc = ydocRef.current;
			if (!ydoc) return;
			yjsUpdateElement(ydoc, id, updates);
		},
		[],
	);

	const updateElements = useCallback(
		(updates: Array<{ id: string; changes: Partial<CanvasElement> }>) => {
			const ydoc = ydocRef.current;
			if (!ydoc) return;
			yjsUpdateElements(ydoc, updates);
		},
		[],
	);

	const deleteElement = useCallback((id: string) => {
		const ydoc = ydocRef.current;
		if (!ydoc) return;
		yjsDeleteElement(ydoc, id);
	}, []);

	const deleteElements = useCallback((ids: string[]) => {
		const ydoc = ydocRef.current;
		if (!ydoc) return;
		yjsDeleteElements(ydoc, ids);
	}, []);

	const createView = useCallback((view: SavedCanvasView) => {
		const ydoc = ydocRef.current;
		if (!ydoc) return;
		yjsCreateView(ydoc, view);
	}, []);

	const updateView = useCallback(
		(id: string, updates: Partial<SavedCanvasView>) => {
			const ydoc = ydocRef.current;
			if (!ydoc) return;
			yjsUpdateView(ydoc, id, updates);
		},
		[],
	);

	const deleteView = useCallback((id: string) => {
		const ydoc = ydocRef.current;
		if (!ydoc) return;
		yjsDeleteView(ydoc, id);
	}, []);

	const setCanvasBg = useCallback((value: string) => {
		const ydoc = ydocRef.current;
		if (ydoc) setCanvasBackgroundInYDoc(ydoc, value);
	}, []);

	const getYDoc = useCallback(() => ydocRef.current, []);

	const getStateBase64 = useCallback(() => {
		const ydoc = ydocRef.current;
		if (!ydoc) return null;
		return encodeYDocStateBase64(ydoc);
	}, []);

	/** Leert den lokalen Gast-Canvas inklusive Browser-Cache. */
	const clearCanvas = useCallback(() => {
		const ydoc = ydocRef.current;
		if (!ydoc) return;
		const entry = buildReplaceAllHistoryEntry(ydoc, [], []);
		transactLocalUndo(
			ydoc,
			() => {
				ydoc.getMap<Y.Map<unknown>>("elementsMap").clear();
				ydoc.getMap<Y.Map<unknown>>("viewsMap").clear();
			},
			entry,
		);
		clearLocalCanvasState();
		clearGuestCanvasViewport();
	}, []);

	const loadSkedraFile = useCallback((file: SkedraFile) => {
		if (!ydocRef.current) return;
		applySkedraFileToYDoc(ydocRef.current, file);
	}, []);

	const noopPresence = useCallback((_value?: unknown) => {}, []);

	return {
		isConnected: enabled ? isConnected : false,
		isReadonly: false,
		role: "editor" as CanvasRole,
		scene,
		elements,
		views,
		canvasBg,
		connectionError: null,
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
		setCanvasBg,
		setPresenceSelection: noopPresence as (selection: string[]) => void,
		setPresenceCursor: noopPresence as (
			cursor: { x: number; y: number } | null,
		) => void,
		setPresenceViewport: noopPresence as (viewport: Viewport) => void,
		setPresenceActiveView: noopPresence as (
			activeViewId: string | null,
		) => void,
		getYDoc,
		getStateBase64,
		clearCanvas,
		loadSkedraFile,
	};
}
