/**
 * Y.js-basierter Sync-Hook fuer das Canvas.
 * Nutzt eine Y.Map (statt Y.Array) fuer granulare Element-Updates.
 * Verbindet sich ueber HocuspocusProvider mit dem Realtime-Server.
 *
 * API: createElement, updateElement, deleteElement, elements (reaktiv)
 */

import { authClient } from "@/lib/auth-client";
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
import { translate } from "@/lib/i18n";
import {
	HttpRequestError,
	createHttpRequestError,
	getRequestErrorMessage,
} from "@/lib/request-errors";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { getCurrentLocale } from "@/stores/locale";
import { HocuspocusProvider } from "@hocuspocus/provider";
import type {
	CanvasElement,
	SavedCanvasView,
	Viewport,
} from "@skedra/canvas-core";
import { CanvasScene } from "@skedra/canvas-core";
import type { RealtimeRole, SkedraFile } from "@skedra/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";

const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const REALTIME_URL =
	getRuntimeConfigValue("REALTIME_URL") ||
	import.meta.env.VITE_REALTIME_URL ||
	`${wsProtocol}//${window.location.host}/realtime`;

const PRESENCE_COLORS = [
	"#0f766e",
	"#2563eb",
	"#db2777",
	"#d97706",
	"#7c3aed",
	"#059669",
	"#dc2626",
	"#0891b2",
] as const;

interface RealtimeTokenResponse {
	token: string;
	expiresAt: number;
	presenceEnabled?: boolean;
	user: {
		id: string;
		name: string;
		image: string | null;
		role: RealtimeRole;
	};
}

interface UseCanvasSyncOptions {
	presentationShareToken?: string;
	collabShareToken?: string;
	embedShareToken?: string;
	presenceEnabled?: boolean;
	enabled?: boolean;
}

interface CanvasPresenceBase {
	user: {
		id: string;
		name: string;
		image: string | null;
		color: string;
		role: RealtimeRole;
	};
	selection: string[];
	cursor: { x: number; y: number } | null;
	viewport: Viewport | null;
	/** Aktive Slide (Saved View) im Presenter-Modus */
	activeViewId: string | null;
	canWrite: boolean;
	updatedAt: number;
}

export interface RemoteCanvasPresence extends CanvasPresenceBase {
	clientId: number;
}

export interface LocalCanvasPresence extends CanvasPresenceBase {}

interface PresenceUserInfo {
	id: string;
	name: string;
	image?: string | null;
}

const realtimeErrorKeyOverrides: Record<string, string> = {
	UNAUTHORIZED: "apiErrors.auth.unauthorized",
	WHITEBOARD_NOT_FOUND: "apiErrors.whiteboard.notFound",
	WORKSPACE_ACCESS_DENIED: "apiErrors.workspace.accessDenied",
	PROJECT_ACCESS_DENIED: "apiErrors.project.accessDenied",
	PRESENTATION_SHARE_NOT_FOUND: "apiErrors.presentation.shareUnavailable",
	PRESENTATION_SHARE_DISABLED: "apiErrors.presentation.shareUnavailable",
	PRESENTATION_SHARE_INACTIVE: "apiErrors.presentation.shareInactive",
};

function getRealtimeRequestErrorMessage(error: HttpRequestError) {
	const locale = getCurrentLocale();
	return getRequestErrorMessage({
		error,
		t: (key, params) => translate(locale, key, params),
		fallbackKey: "apiErrors.common.badRequest",
		overrides: realtimeErrorKeyOverrides,
	});
}

function getPresenceColor(seed: string) {
	let hash = 0;
	for (let index = 0; index < seed.length; index++) {
		hash = (hash * 31 + seed.charCodeAt(index)) | 0;
	}
	return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

function areSelectionsEqual(left: string[], right: string[]) {
	if (left.length !== right.length) return false;
	return left.every((value, index) => value === right[index]);
}

function areViewportsEqual(left: Viewport | null, right: Viewport | null) {
	if (!left && !right) return true;
	if (!left || !right) return false;
	return left.x === right.x && left.y === right.y && left.zoom === right.zoom;
}

function areCursorsEqual(
	left: { x: number; y: number } | null,
	right: { x: number; y: number } | null,
) {
	if (!left && !right) return true;
	if (!left || !right) return false;
	return left.x === right.x && left.y === right.y;
}

function normalizePresenceState(
	clientId: number,
	value: unknown,
	localClientId: number,
): RemoteCanvasPresence | null {
	if (clientId === localClientId || typeof value !== "object" || value == null)
		return null;

	const presence = (value as { presence?: Partial<CanvasPresenceBase> })
		.presence;
	if (!presence?.user?.id || !presence.user.name || !presence.user.color)
		return null;

	return {
		clientId,
		user: {
			id: presence.user.id,
			name: presence.user.name,
			image: presence.user.image ?? null,
			color: presence.user.color,
			role: presence.user.role ?? "editor",
		},
		selection: Array.isArray(presence.selection)
			? presence.selection.filter(
					(item): item is string => typeof item === "string",
				)
			: [],
		cursor:
			presence.cursor &&
			typeof presence.cursor.x === "number" &&
			typeof presence.cursor.y === "number"
				? presence.cursor
				: null,
		viewport:
			presence.viewport &&
			typeof presence.viewport.x === "number" &&
			typeof presence.viewport.y === "number" &&
			typeof presence.viewport.zoom === "number"
				? presence.viewport
				: null,
		activeViewId:
			typeof presence.activeViewId === "string" ? presence.activeViewId : null,
		canWrite: presence.canWrite ?? true,
		updatedAt:
			typeof presence.updatedAt === "number" ? presence.updatedAt : Date.now(),
	};
}

async function fetchRealtimeAuth(
	whiteboardId: string,
	options?: {
		presentationShareToken?: string;
		collabShareToken?: string;
		embedShareToken?: string;
	},
): Promise<RealtimeTokenResponse> {
	const endpoint = options?.collabShareToken
		? `/api/realtime/collab-token?shareToken=${encodeURIComponent(options.collabShareToken)}`
		: options?.embedShareToken
			? `/api/realtime/embed-token?shareToken=${encodeURIComponent(options.embedShareToken)}`
			: options?.presentationShareToken
				? `/api/realtime/presentation-token?shareToken=${encodeURIComponent(options.presentationShareToken)}`
				: `/api/realtime/token?whiteboardId=${encodeURIComponent(whiteboardId)}`;

	const response = await fetch(endpoint, {
		credentials: "include",
		cache: "no-store",
	});

	if (!response.ok) {
		const data = await response.json().catch(() => null);
		const requestError = createHttpRequestError(
			response.status,
			data,
			translate(getCurrentLocale(), "apiErrors.common.badRequest"),
		);
		throw new HttpRequestError({
			message: getRealtimeRequestErrorMessage(requestError),
			code: requestError.code,
			status: requestError.status,
		});
	}

	return (await response.json()) as RealtimeTokenResponse;
}

export function useCanvasSync(
	whiteboardId: string,
	options: UseCanvasSyncOptions = {},
) {
	const {
		presentationShareToken,
		collabShareToken,
		embedShareToken,
		presenceEnabled = true,
		enabled = true,
	} = options;
	const { data: session } = authClient.useSession();
	const ydocRef = useRef<Y.Doc | null>(null);
	const providerRef = useRef<HocuspocusProvider | null>(null);
	const syncFrameRef = useRef<number | null>(null);
	const isReadonlyRef = useRef(false);
	const lastCursorUpdateRef = useRef(0);
	const tokenUserRef = useRef<PresenceUserInfo | null>(null);
	const activeUserRef = useRef<PresenceUserInfo | null>(null);
	const roleRef = useRef<RealtimeRole>("editor");
	const [isConnected, setIsConnected] = useState(false);
	const [isReadonly, setIsReadonly] = useState(false);
	const [role, setRole] = useState<RealtimeRole>("editor");
	const [scene, setScene] = useState(() => CanvasScene.empty());
	const elements = scene.getElementsMap();
	const [views, setViews] = useState<Map<string, SavedCanvasView>>(new Map());
	const [connectionError, setConnectionError] = useState<string | null>(null);
	const [remotePresence, setRemotePresence] = useState<RemoteCanvasPresence[]>(
		[],
	);
	const [localPresence, setLocalPresence] =
		useState<LocalCanvasPresence | null>(null);
	const [resolvedPresenceUser, setResolvedPresenceUser] =
		useState<PresenceUserInfo | null>(null);

	const syncPresenceFromAwareness = useCallback(
		(provider: HocuspocusProvider) => {
			if (!presenceEnabled) {
				setRemotePresence([]);
				return;
			}

			if (!provider.awareness) {
				setRemotePresence([]);
				return;
			}

			const localClientId = provider.awareness.clientID;
			const peers = Array.from(provider.awareness.getStates().entries())
				.map(([clientId, value]) =>
					normalizePresenceState(clientId, value, localClientId),
				)
				.filter((value): value is RemoteCanvasPresence => value != null)
				.sort((left, right) => left.user.name.localeCompare(right.user.name));
			setRemotePresence(peers);
		},
		[presenceEnabled],
	);

	const updateLocalPresence = useCallback(
		(patch: Partial<CanvasPresenceBase>) => {
			const provider = providerRef.current;
			const user = activeUserRef.current;
			if (!presenceEnabled) {
				setLocalPresence(null);
				return;
			}
			if (!provider || !provider.awareness || !user) return;

			const state = provider.awareness.getLocalState() as {
				presence?: CanvasPresenceBase;
			} | null;
			const current = state?.presence;
			const next: CanvasPresenceBase = {
				user: patch.user ??
					current?.user ?? {
						id: user.id,
						name: user.name,
						image: user.image ?? null,
						color: getPresenceColor(user.id),
						role: roleRef.current,
					},
				selection: patch.selection ?? current?.selection ?? [],
				cursor:
					patch.cursor === undefined ? (current?.cursor ?? null) : patch.cursor,
				viewport:
					patch.viewport === undefined
						? (current?.viewport ?? null)
						: patch.viewport,
				activeViewId:
					patch.activeViewId === undefined
						? (current?.activeViewId ?? null)
						: patch.activeViewId,
				canWrite: patch.canWrite ?? current?.canWrite ?? !isReadonlyRef.current,
				updatedAt: Date.now(),
			};

			if (
				current &&
				current.user.id === next.user.id &&
				current.user.name === next.user.name &&
				current.user.image === next.user.image &&
				current.user.color === next.user.color &&
				current.user.role === next.user.role &&
				current.canWrite === next.canWrite &&
				areSelectionsEqual(current.selection, next.selection) &&
				areCursorsEqual(current.cursor, next.cursor) &&
				areViewportsEqual(current.viewport, next.viewport) &&
				current.activeViewId === next.activeViewId
			) {
				return;
			}

			provider.setAwarenessField("presence", next);
			setLocalPresence(next);
		},
		[presenceEnabled],
	);

	useEffect(() => {
		const nextUser = session?.user
			? {
					id: session.user.id,
					name: session.user.name,
					image: session.user.image ?? null,
				}
			: tokenUserRef.current;

		activeUserRef.current = nextUser;
		setResolvedPresenceUser(nextUser ?? null);
	}, [session?.user]);

	useEffect(() => {
		roleRef.current = role;
	}, [role]);

	useEffect(() => {
		if (!enabled) return;

		const ydoc = new Y.Doc({ gc: false });
		ydocRef.current = ydoc;

		const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
		const yViews = ydoc.getMap<Y.Map<unknown>>("viewsMap");

		const scheduleSyncFromYjs = () => {
			if (syncFrameRef.current != null) return;
			syncFrameRef.current = window.requestAnimationFrame(() => {
				syncFrameRef.current = null;
				syncFromYjs();
			});
		};

		const provider = new HocuspocusProvider({
			url: REALTIME_URL,
			name: whiteboardId,
			document: ydoc,
			token: async () => {
				setConnectionError(null);
				try {
					const auth = await fetchRealtimeAuth(whiteboardId, {
						presentationShareToken,
						collabShareToken,
						embedShareToken,
					});
					tokenUserRef.current = {
						id: auth.user.id,
						name: auth.user.name,
						image: auth.user.image ?? null,
					};
					if (!session?.user) {
						activeUserRef.current = tokenUserRef.current;
						setResolvedPresenceUser(tokenUserRef.current);
					}
					roleRef.current = auth.user.role;
					setRole(auth.user.role);
					return auth.token;
				} catch (error) {
					setConnectionError(
						error instanceof Error
							? error.message
							: translate(getCurrentLocale(), "apiErrors.common.badRequest"),
					);
					throw error;
				}
			},
			onAuthenticated({ scope }) {
				const readonly = scope === "readonly";
				isReadonlyRef.current = readonly;
				setIsReadonly(readonly);
			},
			onSynced() {
				setIsConnected(true);
				setConnectionError(null);
				syncFromYjs();
				updateLocalPresence({ canWrite: !isReadonlyRef.current });
			},
			onAuthenticationFailed() {
				setIsConnected(false);
				setRemotePresence([]);
			},
			onDisconnect() {
				setIsConnected(false);
				setRemotePresence([]);
			},
			onAwarenessChange() {
				syncPresenceFromAwareness(provider);
			},
			onAwarenessUpdate() {
				syncPresenceFromAwareness(provider);
			},
		});
		providerRef.current = provider;

		/**
		 * Observer: Reagiert auf alle Aenderungen an der Y.Map.
		 * Baut den lokalen React-State aus dem Y.js-State neu auf.
		 */
		const observer = scheduleSyncFromYjs;
		yElements.observeDeep(observer);
		yViews.observeDeep(observer);

		return () => {
			if (syncFrameRef.current != null) {
				window.cancelAnimationFrame(syncFrameRef.current);
				syncFrameRef.current = null;
			}
			yElements.unobserveDeep(observer);
			yViews.unobserveDeep(observer);
			provider.destroy();
			ydoc.destroy();
			providerRef.current = null;
			ydocRef.current = null;
			tokenUserRef.current = null;
			activeUserRef.current = null;
			setIsConnected(false);
			setIsReadonly(false);
			setRole("editor");
			setScene(CanvasScene.empty());
			setViews(new Map());
			setConnectionError(null);
			setRemotePresence([]);
			setLocalPresence(null);
			setResolvedPresenceUser(null);
		};
	}, [
		enabled,
		presentationShareToken,
		collabShareToken,
		embedShareToken,
		session?.user,
		syncPresenceFromAwareness,
		updateLocalPresence,
		whiteboardId,
	]);

	useEffect(() => {
		if (presenceEnabled) return;
		setRemotePresence([]);
		setLocalPresence(null);
	}, [presenceEnabled]);

	useEffect(() => {
		const activeUser = session?.user
			? {
					id: session.user.id,
					name: session.user.name,
					image: session.user.image ?? null,
				}
			: resolvedPresenceUser;

		updateLocalPresence({
			user: activeUser
				? {
						id: activeUser.id,
						name: activeUser.name,
						image: activeUser.image ?? null,
						color: getPresenceColor(activeUser.id),
						role,
					}
				: undefined,
			canWrite: !isReadonly,
		});
	}, [
		isReadonly,
		role,
		resolvedPresenceUser,
		session?.user,
		updateLocalPresence,
	]);

	/** Liest alle Elemente aus der Y.Map in eine React-freundliche Map */
	function syncFromYjs() {
		const ydoc = ydocRef.current;
		if (!ydoc) return;
		const next = readCanvasMapsFromYDoc(ydoc);
		setScene(CanvasScene.from(next.elements));
		setViews(next.views);
	}

	/** Neues Element erstellen */
	const createElement = useCallback((element: CanvasElement) => {
		const ydoc = ydocRef.current;
		if (!ydoc || isReadonlyRef.current) return;
		yjsCreateElement(ydoc, element);
	}, []);

	/** Bestehendes Element aktualisieren (partielle Updates) */
	const updateElement = useCallback(
		(id: string, updates: Partial<CanvasElement>) => {
			const ydoc = ydocRef.current;
			if (!ydoc || isReadonlyRef.current) return;
			yjsUpdateElement(ydoc, id, updates);
		},
		[],
	);

	/** Mehrere Elemente gleichzeitig aktualisieren (z.B. beim Verschieben) */
	const updateElements = useCallback(
		(updates: Array<{ id: string; changes: Partial<CanvasElement> }>) => {
			const ydoc = ydocRef.current;
			if (!ydoc || isReadonlyRef.current) return;
			yjsUpdateElements(ydoc, updates);
		},
		[],
	);

	/** Element loeschen */
	const deleteElement = useCallback((id: string) => {
		const ydoc = ydocRef.current;
		if (!ydoc || isReadonlyRef.current) return;
		yjsDeleteElement(ydoc, id);
	}, []);

	/** Mehrere Elemente loeschen */
	const deleteElements = useCallback((ids: string[]) => {
		const ydoc = ydocRef.current;
		if (!ydoc || isReadonlyRef.current) return;
		yjsDeleteElements(ydoc, ids);
	}, []);

	/** Zugriff auf Y.Doc fuer UndoManager */
	const getYDoc = useCallback(() => ydocRef.current, []);

	const createView = useCallback((view: SavedCanvasView) => {
		const ydoc = ydocRef.current;
		if (!ydoc || isReadonlyRef.current) return;
		yjsCreateView(ydoc, view);
	}, []);

	const updateView = useCallback(
		(id: string, updates: Partial<SavedCanvasView>) => {
			const ydoc = ydocRef.current;
			if (!ydoc || isReadonlyRef.current) return;
			yjsUpdateView(ydoc, id, updates);
		},
		[],
	);

	const deleteView = useCallback((id: string) => {
		const ydoc = ydocRef.current;
		if (!ydoc || isReadonlyRef.current) return;
		yjsDeleteView(ydoc, id);
	}, []);

	const loadSkedraFile = useCallback((file: SkedraFile) => {
		if (!ydocRef.current || isReadonlyRef.current) return;
		applySkedraFileToYDoc(ydocRef.current, file);
	}, []);

	const setPresenceSelection = useCallback(
		(selection: string[]) => {
			const normalized = [...selection].sort();
			updateLocalPresence({ selection: normalized });
		},
		[updateLocalPresence],
	);

	const setPresenceCursor = useCallback(
		(cursor: { x: number; y: number } | null) => {
			if (cursor) {
				const now = performance.now();
				if (now - lastCursorUpdateRef.current < 33) return;
				lastCursorUpdateRef.current = now;
			}
			updateLocalPresence({ cursor });
		},
		[updateLocalPresence],
	);

	const setPresenceViewport = useCallback(
		(viewport: Viewport) => {
			updateLocalPresence({ viewport });
		},
		[updateLocalPresence],
	);

	const setPresenceActiveView = useCallback(
		(activeViewId: string | null) => {
			updateLocalPresence({ activeViewId });
		},
		[updateLocalPresence],
	);

	return {
		isConnected,
		isReadonly,
		role,
		scene,
		elements,
		views,
		connectionError,
		remotePresence,
		localPresence,
		createElement,
		updateElement,
		updateElements,
		deleteElement,
		deleteElements,
		createView,
		updateView,
		deleteView,
		loadSkedraFile,
		setPresenceSelection,
		setPresenceCursor,
		setPresenceViewport,
		setPresenceActiveView,
		getYDoc,
	};
}
