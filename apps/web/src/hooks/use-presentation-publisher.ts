import { getApiWebSocketUrl } from "@/lib/api-url";
import { encryptYjsUpdate } from "@/lib/e2ee";
import { getPresentationFrameAssetIds } from "@/lib/presentation-frame";
import type {
	PresentationFrameContent,
	PresentationRelativeCamera,
} from "@skedra/shared";
import { presentationPresenterControlMessageSchema } from "@skedra/shared";
import { useCallback, useEffect, useRef, useState } from "react";

const encoder = new TextEncoder();

export function usePresentationPublisher(options: {
	whiteboardId?: string;
	sessionId?: string | null;
	encryptionMode: "server" | "e2ee";
	e2eeKey: string | null | undefined;
	enabled: boolean;
}) {
	const { whiteboardId, sessionId, encryptionMode, e2eeKey, enabled } = options;
	const socketRef = useRef<WebSocket | null>(null);
	const sequenceRef = useRef(0);
	const cursorSequenceRef = useRef(0);
	const cameraSequenceRef = useRef(0);
	const pendingFrameSequenceRef = useRef<number | null>(null);
	const latestCursorRef = useRef<{ x: number; y: number } | null>(null);
	const cursorFrameRef = useRef<number | null>(null);
	const latestCameraRef = useRef<{
		camera: PresentationRelativeCamera;
		viewId: string;
	} | null>(null);
	const cameraFrameRef = useRef<number | null>(null);
	const latestFrameRef = useRef<PresentationFrameContent | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [lastAcknowledgedSequence, setLastAcknowledgedSequence] = useState(0);
	const [audienceCount, setAudienceCount] = useState(0);
	const [sessionEnded, setSessionEnded] = useState(false);
	const [publishError, setPublishError] = useState<string | null>(null);

	const publishFrame = useCallback(
		async (frame: PresentationFrameContent) => {
			latestFrameRef.current = frame;
			const socket = socketRef.current;
			if (!socket || socket.readyState !== WebSocket.OPEN) return;
			sequenceRef.current += 1;
			const sequence = sequenceRef.current;
			pendingFrameSequenceRef.current = sequence;
			try {
				const assetIds = getPresentationFrameAssetIds(frame);
				const json = JSON.stringify(frame);
				const payload =
					encryptionMode === "e2ee"
						? await encryptYjsUpdate(encoder.encode(json), e2eeKey as string)
						: json;
				if (latestFrameRef.current !== frame) return;
				if (payload.length > 4_000_000) {
					if (pendingFrameSequenceRef.current === sequence) {
						pendingFrameSequenceRef.current = null;
					}
					setPublishError(
						"Diese Folie ist zu groß für die Live-Übertragung. Entferne große eingebettete Inhalte.",
					);
					return;
				}
				if (
					socketRef.current !== socket ||
					socket.readyState !== WebSocket.OPEN
				) {
					return;
				}
				socket.send(
					JSON.stringify({
						type: "frame",
						sequence,
						payload,
						assetIds,
					}),
				);
				setPublishError(null);
			} catch {
				if (pendingFrameSequenceRef.current === sequence) {
					pendingFrameSequenceRef.current = null;
				}
				if (latestFrameRef.current === frame) {
					setPublishError("Die aktuelle Folie konnte nicht übertragen werden.");
				}
			}
		},
		[e2eeKey, encryptionMode],
	);

	const publishCursor = useCallback(
		(cursor: { x: number; y: number } | null) => {
			latestCursorRef.current = cursor;
			if (cursorFrameRef.current != null) return;
			cursorFrameRef.current = window.requestAnimationFrame(() => {
				cursorFrameRef.current = null;
				const socket = socketRef.current;
				if (!socket || socket.readyState !== WebSocket.OPEN) return;
				cursorSequenceRef.current += 1;
				socket.send(
					JSON.stringify({
						type: "cursor",
						sequence: cursorSequenceRef.current,
						cursor: latestCursorRef.current,
					}),
				);
			});
		},
		[],
	);

	const publishCamera = useCallback(
		(camera: PresentationRelativeCamera, viewId: string) => {
			latestCameraRef.current = { camera, viewId };
			if (pendingFrameSequenceRef.current != null) return;
			if (cameraFrameRef.current != null) return;
			cameraFrameRef.current = window.requestAnimationFrame(() => {
				cameraFrameRef.current = null;
				if (pendingFrameSequenceRef.current != null) return;
				const socket = socketRef.current;
				if (
					!socket ||
					socket.readyState !== WebSocket.OPEN ||
					!latestCameraRef.current
				)
					return;
				cameraSequenceRef.current += 1;
				socket.send(
					JSON.stringify({
						type: "camera",
						sequence: cameraSequenceRef.current,
						viewId: latestCameraRef.current.viewId,
						camera: latestCameraRef.current.camera,
					}),
				);
			});
		},
		[],
	);

	useEffect(() => {
		sequenceRef.current = 0;
		cursorSequenceRef.current = 0;
		cameraSequenceRef.current = 0;
		pendingFrameSequenceRef.current = null;
		latestCursorRef.current = null;
		latestCameraRef.current = null;
		if (cursorFrameRef.current != null) {
			window.cancelAnimationFrame(cursorFrameRef.current);
			cursorFrameRef.current = null;
		}
		if (cameraFrameRef.current != null) {
			window.cancelAnimationFrame(cameraFrameRef.current);
			cameraFrameRef.current = null;
		}
		latestFrameRef.current = null;
		setLastAcknowledgedSequence(0);
		setAudienceCount(0);
		setSessionEnded(false);
		setPublishError(null);

		if (
			!enabled ||
			!whiteboardId ||
			!sessionId ||
			(encryptionMode === "e2ee" && !e2eeKey)
		) {
			return;
		}
		let closed = false;
		let reconnectTimer: number | null = null;
		let heartbeatTimer: number | null = null;
		let reconnectAttempt = 0;

		const connect = () => {
			if (closed) return;
			const url = new URL(
				getApiWebSocketUrl(`/api/boards/${whiteboardId}/presentation-live`),
			);
			url.searchParams.set("sessionId", sessionId);
			const socket = new WebSocket(url);
			socketRef.current = socket;
			socket.onopen = () => {
				reconnectAttempt = 0;
				setSessionEnded(false);
				heartbeatTimer = window.setInterval(() => {
					if (socket.readyState === WebSocket.OPEN) {
						socket.send(JSON.stringify({ type: "heartbeat" }));
					}
				}, 30_000);
			};
			socket.onmessage = (event) => {
				try {
					const message = presentationPresenterControlMessageSchema.parse(
						JSON.parse(typeof event.data === "string" ? event.data : ""),
					);
					if (message.type === "ready") {
						setIsConnected(true);
						setAudienceCount(message.audienceCount);
						if (latestFrameRef.current) {
							void publishFrame(latestFrameRef.current);
						}
					} else if (message.type === "ack") {
						setLastAcknowledgedSequence(message.sequence);
						if (
							pendingFrameSequenceRef.current != null &&
							message.sequence >= pendingFrameSequenceRef.current
						) {
							pendingFrameSequenceRef.current = null;
							if (latestCameraRef.current) {
								publishCamera(
									latestCameraRef.current.camera,
									latestCameraRef.current.viewId,
								);
							}
						}
					} else if (message.type === "audience") {
						setAudienceCount(message.count);
					} else {
						setSessionEnded(true);
						setIsConnected(false);
					}
				} catch {
					// Ignore malformed control messages.
				}
			};
			socket.onclose = (event) => {
				if (socketRef.current === socket) socketRef.current = null;
				setIsConnected(false);
				if (heartbeatTimer != null) window.clearInterval(heartbeatTimer);
				if (event.code === 1008) {
					setPublishError(
						event.reason || "Die Presenter-Session wurde vom Server beendet.",
					);
				}
				if (closed || event.code === 1008) return;
				const delay = Math.min(15_000, 1_000 * 2 ** reconnectAttempt);
				reconnectAttempt += 1;
				reconnectTimer = window.setTimeout(connect, delay);
			};
			socket.onerror = () => socket.close();
		};

		connect();
		return () => {
			closed = true;
			if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
			if (heartbeatTimer != null) window.clearInterval(heartbeatTimer);
			if (cursorFrameRef.current != null) {
				window.cancelAnimationFrame(cursorFrameRef.current);
				cursorFrameRef.current = null;
			}
			if (cameraFrameRef.current != null) {
				window.cancelAnimationFrame(cameraFrameRef.current);
				cameraFrameRef.current = null;
			}
			socketRef.current?.close();
			socketRef.current = null;
			setIsConnected(false);
		};
	}, [
		e2eeKey,
		enabled,
		encryptionMode,
		publishCamera,
		publishFrame,
		sessionId,
		whiteboardId,
	]);

	return {
		isConnected,
		isBroadcasting: isConnected && lastAcknowledgedSequence > 0,
		lastAcknowledgedSequence,
		audienceCount,
		sessionEnded,
		publishError,
		publishFrame,
		publishCursor,
		publishCamera,
	};
}
