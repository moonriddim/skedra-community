import type { RemoteCanvasPresence } from "@/hooks/canvas-sync-types";
import { getApiWebSocketUrl } from "@/lib/api-url";
import { decryptYjsUpdate } from "@/lib/e2ee";
import { decodePresentationFrameContent } from "@/lib/presentation-frame";
import type { CanvasElement, SavedCanvasView } from "@skedra/canvas-core";
import { CanvasScene } from "@skedra/canvas-core";
import {
	type PresentationRelativeCamera,
	presentationViewerMessageSchema,
} from "@skedra/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 15_000;
const decoder = new TextDecoder();

export function usePresentationCanvasSync(options: {
	enabled: boolean;
	shareToken?: string;
	encryptionMode: "server" | "e2ee";
	e2eeKey: string | null | undefined;
	cursorEnabled: boolean;
}) {
	const { enabled, shareToken, encryptionMode, e2eeKey, cursorEnabled } =
		options;
	const [scene, setScene] = useState(() => CanvasScene.empty());
	const [views, setViews] = useState<Map<string, SavedCanvasView>>(new Map());
	const [camera, setCamera] = useState<PresentationRelativeCamera | null>(null);
	const [frameSequence, setFrameSequence] = useState(-1);
	const frameSequenceRef = useRef(-1);
	const sessionIdRef = useRef<string | null>(null);
	const activeViewIdRef = useRef<string | null>(null);
	const cursorSequenceRef = useRef(-1);
	const pendingCameraRef = useRef<{
		sessionId: string;
		sequence: number;
		viewId: string;
		camera: PresentationRelativeCamera;
	} | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [isLive, setIsLive] = useState(false);
	const [connectionError, setConnectionError] = useState<string | null>(null);
	const [remotePresence, setRemotePresence] = useState<RemoteCanvasPresence[]>(
		[],
	);

	useEffect(() => {
		frameSequenceRef.current = -1;
		sessionIdRef.current = null;
		activeViewIdRef.current = null;
		cursorSequenceRef.current = -1;
		pendingCameraRef.current = null;
		setScene(CanvasScene.empty());
		setViews(new Map());
		setCamera(null);
		setFrameSequence(-1);
		setIsLive(false);
		setRemotePresence([]);
		setConnectionError(null);

		if (!enabled || !shareToken || (encryptionMode === "e2ee" && !e2eeKey)) {
			return;
		}
		let closed = false;
		let reconnectTimer: number | null = null;
		let reconnectAttempt = 0;
		let socket: WebSocket | null = null;
		const clearPublishedFrame = () => {
			frameSequenceRef.current = -1;
			sessionIdRef.current = null;
			activeViewIdRef.current = null;
			cursorSequenceRef.current = -1;
			pendingCameraRef.current = null;
			setScene(CanvasScene.empty());
			setViews(new Map());
			setCamera(null);
			setFrameSequence(-1);
			setIsLive(false);
			setRemotePresence([]);
			setConnectionError(null);
		};

		const connect = () => {
			if (closed) return;
			socket = new WebSocket(
				getApiWebSocketUrl(
					`/api/presentations/${encodeURIComponent(shareToken)}/live`,
				),
			);
			socket.onopen = () => {
				reconnectAttempt = 0;
				setIsConnected(true);
				setConnectionError(null);
			};
			socket.onmessage = (event) => {
				void (async () => {
					let processingFrame: { sessionId: string; sequence: number } | null =
						null;
					try {
						const parsed = presentationViewerMessageSchema.parse(
							JSON.parse(typeof event.data === "string" ? event.data : ""),
						);
						if (parsed.type === "waiting") {
							clearPublishedFrame();
							return;
						}
						if (parsed.type === "ended") {
							clearPublishedFrame();
							return;
						}
						if (parsed.type === "cursor") {
							if (
								!cursorEnabled ||
								parsed.sessionId !== sessionIdRef.current ||
								parsed.sequence <= cursorSequenceRef.current
							) {
								return;
							}
							cursorSequenceRef.current = parsed.sequence;
							setRemotePresence([
								{
									clientId: 1,
									user: {
										id: "authorized-presenter",
										name: "Presenter",
										image: null,
										color: "#f43f5e",
										role: "owner",
									},
									selection: [],
									cursor: parsed.cursor,
									viewport: null,
									activeViewId: null,
									canWrite: false,
									updatedAt: Date.now(),
								},
							]);
							return;
						}
						if (parsed.type === "camera") {
							const pendingCamera = pendingCameraRef.current;
							if (
								pendingCamera?.sessionId === parsed.sessionId &&
								parsed.sequence <= pendingCamera.sequence
							) {
								return;
							}
							pendingCameraRef.current = parsed;
							if (
								parsed.sessionId === sessionIdRef.current &&
								parsed.viewId === activeViewIdRef.current
							) {
								setCamera(parsed.camera);
							}
							return;
						}
						if (
							parsed.sessionId === sessionIdRef.current &&
							parsed.sequence <= frameSequenceRef.current
						) {
							return;
						}
						if (parsed.sessionId !== sessionIdRef.current) {
							cursorSequenceRef.current = -1;
						}
						sessionIdRef.current = parsed.sessionId;
						frameSequenceRef.current = parsed.sequence;
						processingFrame = {
							sessionId: parsed.sessionId,
							sequence: parsed.sequence,
						};
						const json =
							encryptionMode === "e2ee"
								? decoder.decode(
										await decryptYjsUpdate(parsed.payload, e2eeKey as string),
									)
								: parsed.payload;
						if (
							sessionIdRef.current !== parsed.sessionId ||
							frameSequenceRef.current !== parsed.sequence
						) {
							return;
						}
						const frame = decodePresentationFrameContent(JSON.parse(json));
						activeViewIdRef.current = frame.view.id;
						setFrameSequence(parsed.sequence);
						setScene(CanvasScene.from(frame.elements));
						setViews(new Map([[frame.view.id, frame.view]]));
						const pendingCamera = pendingCameraRef.current;
						setCamera(
							pendingCamera?.sessionId === parsed.sessionId &&
								pendingCamera.viewId === frame.view.id
								? pendingCamera.camera
								: frame.camera,
						);
						setIsLive(true);
						setConnectionError(null);
					} catch {
						if (
							processingFrame &&
							(sessionIdRef.current !== processingFrame.sessionId ||
								frameSequenceRef.current !== processingFrame.sequence)
						) {
							return;
						}
						setConnectionError(
							"Die aktuelle Folie konnte nicht gelesen werden.",
						);
					}
				})();
			};
			socket.onclose = (event) => {
				setIsConnected(false);
				if (event.code === 1008) {
					setConnectionError(
						event.reason || "Die Präsentationsverbindung wurde beendet.",
					);
				}
				if (closed || event.code === 1008) return;
				const delay = Math.min(
					RECONNECT_MAX_DELAY_MS,
					RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt,
				);
				reconnectAttempt += 1;
				reconnectTimer = window.setTimeout(connect, delay);
			};
			socket.onerror = () => socket?.close();
		};

		connect();
		return () => {
			closed = true;
			if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
			socket?.close();
			setIsConnected(false);
		};
	}, [cursorEnabled, e2eeKey, enabled, encryptionMode, shareToken]);

	const noOp = useCallback(() => undefined, []);
	const elements = scene.getElementsMap();
	return useMemo(
		() => ({
			isConnected,
			isReadonly: true,
			role: "viewer" as const,
			scene,
			elements,
			views,
			canvasBg: "",
			connectionError,
			remotePresence,
			localPresence: null,
			createElement: noOp as (element: CanvasElement) => void,
			updateElement: noOp,
			updateElements: noOp,
			deleteElement: noOp,
			deleteElements: noOp,
			applyMutationPlan: noOp,
			createView: noOp,
			updateView: noOp,
			deleteView: noOp,
			setCanvasBg: noOp,
			loadSkedraFile: noOp,
			setPresenceSelection: noOp,
			setPresenceCursor: noOp,
			setPresenceViewport: noOp,
			setPresenceActiveView: noOp,
			getYDoc: () => null,
			presentationCamera: camera,
			presentationFrameSequence: frameSequence,
			presentationIsLive: isLive,
		}),
		[
			camera,
			connectionError,
			elements,
			frameSequence,
			isConnected,
			isLive,
			noOp,
			remotePresence,
			scene,
			views,
		],
	);
}
