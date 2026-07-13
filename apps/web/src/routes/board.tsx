import { BoardActivityOverlay } from "@/components/board";
import { BoardAppearanceMenu } from "@/components/board/board-appearance-menu";
import { RoleBadge } from "@/components/team/role-badge";
import { RolePermissionsSummary } from "@/components/team/role-permissions-editor";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { BoardShareMembersList } from "@/components/whiteboard/board-share-members-list";
import type { PendingCommentPlacement } from "@/components/whiteboard/canvas-comment-layer";
import type { WhiteboardCommentThread } from "@/components/whiteboard/whiteboard-comment-types";
import { WhiteboardCommentsPanel } from "@/components/whiteboard/whiteboard-comments-panel";
import { getApiUrl } from "@/lib/api-url";
import { authClient } from "@/lib/auth-client";
import {
	type UnlockedUserE2eeIdentity,
	createE2eeKeyHash,
	decryptBoardKeyFromRecipientEnvelope,
	encryptBoardKeyForRecipient,
	getKnownE2eeKey,
	putE2eeKeyInCurrentUrl,
	readE2eeKeyFromHash,
	readUnlockedUserE2eeIdentity,
	storeE2eeKey,
	unlockOrCreateUserE2eeIdentity,
	withE2eeKeyFragment,
} from "@/lib/e2ee";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import {
	ArrowLeft,
	Check,
	Code2,
	Copy,
	ExternalLink,
	History,
	Loader2,
	MessageSquare,
	MonitorPlay,
	RefreshCcw,
	Share2,
	ShieldCheck,
} from "lucide-react";
import {
	Suspense,
	lazy,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Link,
	useLocation,
	useNavigate,
	useParams,
	useSearchParams,
} from "react-router";

const SkedraCanvas = lazy(() =>
	import("@/components/canvas/skedra-canvas").then((m) => ({
		default: m.SkedraCanvas,
	})),
);

const LiveCallPanel = lazy(() =>
	import("@/components/board/live-call-panel").then((m) => ({
		default: m.LiveCallPanel,
	})),
);

type InviteKeyDelivery = "none" | "fragment" | "recipient";

export function BoardPage() {
	const { boardId } = useParams();
	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const presenterMode = searchParams.get("present") === "1";
	const presentationPreparationMode = searchParams.get("prepare") === "1";
	const buildBoardModeHref = (mode?: "prepare" | "present") => {
		const nextSearch = new URLSearchParams(searchParams);
		nextSearch.delete("prepare");
		nextSearch.delete("present");
		if (mode) nextSearch.set(mode, "1");
		const query = nextSearch.toString();
		return `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
	};
	const normalBoardHref = buildBoardModeHref();
	const preparationBoardHref = buildBoardModeHref("prepare");
	const presenterBoardHref = buildBoardModeHref("present");
	const { t } = useI18n();
	const { data: session } = authClient.useSession();
	const utils = trpc.useUtils();
	const [copied, setCopied] = useState(false);
	const [commentsOpen, setCommentsOpen] = useState(false);
	const [activityOpen, setActivityOpen] = useState(false);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRoleId, setInviteRoleId] = useState("");
	const [inviteLink, setInviteLink] = useState("");
	const [inviteKeyDelivery, setInviteKeyDelivery] =
		useState<InviteKeyDelivery>("none");
	const [inviteCopied, setInviteCopied] = useState(false);
	const [collabCopied, setCollabCopied] = useState(false);
	const [embedCopied, setEmbedCopied] = useState(false);
	const [embedCodeCopied, setEmbedCodeCopied] = useState(false);
	const [mcpKeyCopied, setMcpKeyCopied] = useState(false);
	const [notionCopied, setNotionCopied] = useState(false);
	const [obsidianCopied, setObsidianCopied] = useState(false);
	const [e2eeKey, setE2eeKey] = useState<string | null>(null);
	const [e2eeKeyDraft, setE2eeKeyDraft] = useState("");
	const [shouldRefreshOwnKeyRecipient, setShouldRefreshOwnKeyRecipient] =
		useState(false);
	const [identityUnlockPassword, setIdentityUnlockPassword] = useState("");
	const [identityUnlockError, setIdentityUnlockError] = useState("");
	const [identityUnlockLoading, setIdentityUnlockLoading] = useState(false);
	const [notionPageId, setNotionPageId] = useState("");
	const [notionToken, setNotionToken] = useState("");
	const [obsidianEndpoint, setObsidianEndpoint] = useState(
		"http://127.0.0.1:27123",
	);
	const [obsidianPath, setObsidianPath] = useState("");
	const [obsidianApiKey, setObsidianApiKey] = useState("");
	const [callOpen, setCallOpen] = useState(false);
	const [presenterSessionId, setPresenterSessionId] = useState<string | null>(
		null,
	);
	const [presenterStartedAt, setPresenterStartedAt] = useState<string | null>(
		null,
	);
	const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
	const [showResolvedComments, setShowResolvedComments] = useState(false);
	const [commentPlacementActive, setCommentPlacementActive] = useState(false);
	const [pendingCommentPlacement, setPendingCommentPlacement] =
		useState<PendingCommentPlacement | null>(null);
	const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
		null,
	);
	const focusCanvasPointRef = useRef<((x: number, y: number) => void) | null>(
		null,
	);
	const e2eeStateRef = useRef<(() => Uint8Array | null) | null>(null);
	const ownKeyRecipientWriteRef = useRef<string | null>(null);

	const { data: board, isLoading } = trpc.whiteboard.getById.useQuery(
		{ id: boardId ?? "" },
		{ enabled: !!boardId },
	);
	const encryptionMode = board?.encryptionMode ?? "server";
	const { data: ownKeyRecipient } = trpc.whiteboard.getOwnKeyRecipient.useQuery(
		{ id: boardId ?? "" },
		{
			enabled: !!boardId && !!session?.user && encryptionMode === "e2ee",
		},
	);
	const identityQuery = trpc.userE2ee.getIdentity.useQuery(undefined, {
		enabled: false,
		retry: false,
	});
	const { data: callsConfig } = trpc.calls.getConfig.useQuery(undefined, {
		enabled: !!boardId,
	});

	const canManage = board?.canManage ?? false;
	const isE2eeBoard = encryptionMode === "e2ee";
	const canInvite = board?.canInvite ?? canManage;
	const canManageShare = board?.canManageShare ?? canManage;
	const canManageMembers = board?.canManageMembers ?? canManage;
	const canViewActivity = board?.canViewActivity ?? true;
	const canResolveComments = board?.canResolveComments ?? canManage;
	const { data: inviteRoles } = trpc.whiteboard.listInviteRoles.useQuery(
		{ id: boardId ?? "" },
		{ enabled: !!boardId },
	);

	const { data: shareSettings } =
		trpc.whiteboard.getPresentationSettings.useQuery(
			{ id: boardId ?? "" },
			{ enabled: !!boardId && canManageShare },
		);

	const { data: collabSettings } =
		trpc.whiteboard.getCollabShareSettings.useQuery(
			{ id: boardId ?? "" },
			{ enabled: !!boardId && canManageShare },
		);

	const { data: embedSettings } =
		trpc.whiteboard.getEmbedShareSettings.useQuery(
			{ id: boardId ?? "" },
			{ enabled: !!boardId && canManageShare },
		);

	const { data: integrations = [] } = trpc.integrations.listBoard.useQuery(
		{ whiteboardId: boardId ?? "" },
		{ enabled: !!boardId && canManageShare },
	);

	const { data: assignmentOptions } =
		trpc.whiteboard.getAssignmentOptions.useQuery(
			{ id: boardId ?? "" },
			{ enabled: !!boardId },
		);

	const { data: commentThreads, isLoading: commentsLoading } =
		trpc.whiteboard.listCommentThreads.useQuery(
			{ whiteboardId: boardId ?? "" },
			{ enabled: !!boardId, refetchInterval: 5_000 },
		);

	const invalidateComments = useCallback(() => {
		void utils.whiteboard.listCommentThreads.invalidate({
			whiteboardId: boardId ?? "",
		});
	}, [boardId, utils.whiteboard.listCommentThreads]);

	const createCommentThread = trpc.whiteboard.createCommentThread.useMutation({
		onSuccess: (thread) => {
			invalidateComments();
			setPendingCommentPlacement(null);
			setCommentPlacementActive(false);
			setSelectedThreadId(thread.id);
		},
	});

	const addCommentReply = trpc.whiteboard.addCommentReply.useMutation({
		onSuccess: () => invalidateComments(),
	});

	const setCommentThreadResolved =
		trpc.whiteboard.setCommentThreadResolved.useMutation({
			onSuccess: () => invalidateComments(),
		});

	const deleteCommentThread = trpc.whiteboard.deleteCommentThread.useMutation({
		onSuccess: () => {
			invalidateComments();
			setSelectedThreadId(null);
		},
	});

	const deleteCommentMessage = trpc.whiteboard.deleteCommentMessage.useMutation(
		{
			onSuccess: () => {
				invalidateComments();
				setDeletingMessageId(null);
			},
			onError: () => setDeletingMessageId(null),
		},
	);

	const updateShare = trpc.whiteboard.updatePresentationShare.useMutation({
		onSuccess: () =>
			void utils.whiteboard.getPresentationSettings.invalidate({
				id: boardId ?? "",
			}),
	});

	const updateCollabShare = trpc.whiteboard.updateCollabShare.useMutation({
		onSuccess: () =>
			void utils.whiteboard.getCollabShareSettings.invalidate({
				id: boardId ?? "",
			}),
	});

	const updateEmbedShare = trpc.whiteboard.updateEmbedShare.useMutation({
		onSuccess: () =>
			void utils.whiteboard.getEmbedShareSettings.invalidate({
				id: boardId ?? "",
			}),
	});

	const registerE2eeKeyHash = trpc.whiteboard.registerE2eeKeyHash.useMutation({
		onSuccess: () => {
			void utils.whiteboard.getById.invalidate({ id: boardId ?? "" });
		},
	});

	const upsertOwnKeyRecipient =
		trpc.whiteboard.upsertOwnKeyRecipient.useMutation({
			onSuccess: () => {
				void utils.whiteboard.getOwnKeyRecipient.invalidate({
					id: boardId ?? "",
				});
			},
		});

	const upsertMemberKeyRecipient =
		trpc.whiteboard.upsertMemberKeyRecipient.useMutation();
	const saveIdentity = trpc.userE2ee.saveIdentity.useMutation();

	const saveNotionIntegration = trpc.integrations.saveNotion.useMutation({
		onSuccess: () =>
			void utils.integrations.listBoard.invalidate({
				whiteboardId: boardId ?? "",
			}),
	});

	const saveObsidianIntegration = trpc.integrations.saveObsidian.useMutation({
		onSuccess: () =>
			void utils.integrations.listBoard.invalidate({
				whiteboardId: boardId ?? "",
			}),
	});

	const syncIntegration = trpc.integrations.syncNow.useMutation({
		onSuccess: () =>
			void utils.integrations.listBoard.invalidate({
				whiteboardId: boardId ?? "",
			}),
	});

	const regenerateShare =
		trpc.whiteboard.regeneratePresentationShareToken.useMutation({
			onSuccess: () =>
				void utils.whiteboard.getPresentationSettings.invalidate({
					id: boardId ?? "",
				}),
		});

	const inviteMember = trpc.whiteboard.inviteByEmail.useMutation({
		onSuccess: async (result) => {
			setInviteEmail("");
			const fallbackBoardUrl = boardId
				? `${window.location.origin}/board/${boardId}`
				: "";
			const nextInviteUrl =
				"inviteUrl" in result ? result.inviteUrl : fallbackBoardUrl;
			const recipient = "recipient" in result ? result.recipient : null;
			let recipientEnvelopeStored = false;
			if (boardId && e2eeKey && recipient?.publicKey) {
				try {
					const keyHash = await createE2eeKeyHash(e2eeKey);
					const encryptedBoardKey = await encryptBoardKeyForRecipient({
						boardKey: e2eeKey,
						recipientPublicKey: recipient.publicKey,
						boardId,
						recipientUserId: recipient.userId,
						keyHash,
					});
					const storedResult = await upsertMemberKeyRecipient.mutateAsync({
						id: boardId,
						userId: recipient.userId,
						keyHash,
						encryptedBoardKey,
					});
					recipientEnvelopeStored = storedResult.stored;
				} catch (error) {
					console.error("E2EE invite key wrapping failed", error);
				}
			}
			if (nextInviteUrl) {
				const includeKeyFragment = !!e2eeKey && !recipientEnvelopeStored;
				setInviteLink(
					withE2eeKeyFragment(
						nextInviteUrl,
						includeKeyFragment ? e2eeKey : null,
					),
				);
				setInviteKeyDelivery(
					recipientEnvelopeStored
						? "recipient"
						: includeKeyFragment
							? "fragment"
							: "none",
				);
			} else {
				setInviteLink("");
				setInviteKeyDelivery("none");
			}
			void utils.whiteboard.getAssignmentOptions.invalidate({
				id: boardId ?? "",
			});
			void utils.whiteboard.listMembers.invalidate({ id: boardId ?? "" });
			void utils.whiteboard.list.invalidate();
		},
	});

	const setTeamRoleAccess = trpc.whiteboard.setTeamRoleAccess.useMutation({
		onSuccess: () => {
			void utils.whiteboard.listInviteRoles.invalidate({ id: boardId ?? "" });
			void utils.whiteboard.getAssignmentOptions.invalidate({
				id: boardId ?? "",
			});
			void utils.whiteboard.listMembers.invalidate({ id: boardId ?? "" });
			void utils.whiteboard.list.invalidate();
		},
	});

	const startPresentation =
		trpc.whiteboard.startPresentationSession.useMutation({
			onSuccess: (result) => {
				setPresenterSessionId(result.sessionId);
				setPresenterStartedAt(result.startedAt);
			},
		});
	const endPresentation = trpc.whiteboard.endPresentationSession.useMutation({
		onSuccess: () => {
			setPresenterSessionId(null);
			setPresenterStartedAt(null);
		},
	});
	const presenterSessionRef = useRef<string | null>(null);
	presenterSessionRef.current = presenterSessionId;
	const endPresentationMutateRef = useRef(endPresentation.mutate);
	endPresentationMutateRef.current = endPresentation.mutate;

	const handleStartPresentation = useCallback(() => {
		if (!boardId || startPresentation.isPending) return;
		startPresentation.mutate({ id: boardId });
	}, [boardId, startPresentation.isPending, startPresentation.mutate]);

	const handleEndPresentation = useCallback(() => {
		if (!boardId || !presenterSessionRef.current) return;
		endPresentationMutateRef.current({
			id: boardId,
			sessionId: presenterSessionRef.current,
		});
	}, [boardId]);

	useEffect(() => {
		if (presenterMode) return;
		if (presenterSessionRef.current && boardId) {
			endPresentationMutateRef.current({
				id: boardId,
				sessionId: presenterSessionRef.current,
			});
		}
	}, [boardId, presenterMode]);

	useEffect(
		() => () => {
			if (!boardId || !presenterSessionRef.current) return;
			endPresentationMutateRef.current({
				id: boardId,
				sessionId: presenterSessionRef.current,
			});
		},
		[boardId],
	);

	useEffect(() => {
		if (!boardId || !presenterSessionId) return;
		const endPresentationOnPageExit = () => {
			void fetch(
				getApiUrl(
					`/api/boards/${encodeURIComponent(boardId)}/presentation-end`,
				),
				{
					method: "POST",
					body: presenterSessionId,
					credentials: "include",
					keepalive: true,
				},
			).catch(() => undefined);
		};
		window.addEventListener("pagehide", endPresentationOnPageExit);
		return () =>
			window.removeEventListener("pagehide", endPresentationOnPageExit);
	}, [boardId, presenterSessionId]);

	const shareUrl = useMemo(() => {
		if (!shareSettings?.shareToken) return "";
		const url = `${window.location.origin}/present/${shareSettings.shareToken}`;
		return withE2eeKeyFragment(url, e2eeKey);
	}, [e2eeKey, shareSettings?.shareToken]);

	const collabUrl = useMemo(() => {
		if (!collabSettings?.shareToken) return "";
		const url = `${window.location.origin}/collab/${collabSettings.shareToken}`;
		return withE2eeKeyFragment(url, e2eeKey);
	}, [collabSettings?.shareToken, e2eeKey]);

	const embedUrl = useMemo(() => {
		if (!embedSettings?.shareToken) return "";
		const url = `${window.location.origin}/embed/${embedSettings.shareToken}`;
		return withE2eeKeyFragment(url, e2eeKey);
	}, [e2eeKey, embedSettings?.shareToken]);

	const embedCode = useMemo(() => {
		if (!embedUrl) return "";
		return `<iframe src="${embedUrl}" title="${board?.name ?? "Skedra board"}" width="100%" height="640" loading="lazy" allowfullscreen></iframe>`;
	}, [board?.name, embedUrl]);

	const integrationUrl = useMemo(() => {
		if (embedUrl) return embedUrl;
		if (shareUrl) return shareUrl;
		const url = boardId ? `${window.location.origin}/board/${boardId}` : "";
		return withE2eeKeyFragment(url, e2eeKey);
	}, [boardId, e2eeKey, embedUrl, shareUrl]);

	const obsidianMarkdown = useMemo(() => {
		if (!integrationUrl) return "";
		const title = board?.name ?? "Skedra board";
		return embedUrl
			? `![${title}](${embedUrl})`
			: `[${title}](${integrationUrl})`;
	}, [board?.name, embedUrl, integrationUrl]);

	const isOwner = board?.ownerId === session?.user?.id;
	const canWrite = board?.canWrite ?? true;
	const canComment = board?.canComment ?? true;

	const selectedInviteRole = useMemo(
		() =>
			inviteRoles?.find((role) => role.id === inviteRoleId) ?? inviteRoles?.[0],
		[inviteRoleId, inviteRoles],
	);

	const storeOwnBoardKeyWithIdentity = useCallback(
		async (identity: UnlockedUserE2eeIdentity, boardKey: string) => {
			if (!boardId || !session?.user?.id) return;
			const keyHash = await createE2eeKeyHash(boardKey);
			const encryptedBoardKey = await encryptBoardKeyForRecipient({
				boardKey,
				recipientPublicKey: identity.publicKey,
				boardId,
				recipientUserId: session.user.id,
				keyHash,
			});
			await upsertOwnKeyRecipient.mutateAsync({
				id: boardId,
				keyHash,
				encryptedBoardKey,
			});
			storeE2eeKey(boardId, boardKey);
			setE2eeKey(boardKey);
			setE2eeKeyDraft(boardKey);
			setShouldRefreshOwnKeyRecipient(false);
			setIdentityUnlockError("");
		},
		[boardId, session?.user?.id, upsertOwnKeyRecipient.mutateAsync],
	);

	const recoverBoardKeyWithIdentity = useCallback(
		async (identity: UnlockedUserE2eeIdentity, encryptedBoardKey: string) => {
			if (!boardId || !session?.user?.id) return;
			const recoveredKey = await decryptBoardKeyFromRecipientEnvelope(
				encryptedBoardKey,
				identity,
				{
					boardId,
					recipientUserId: session.user.id,
					allowLegacy: true,
				},
			);
			await storeOwnBoardKeyWithIdentity(identity, recoveredKey);
		},
		[boardId, session?.user?.id, storeOwnBoardKeyWithIdentity],
	);

	useEffect(() => {
		if (!inviteRoles?.length) return;
		if (
			!inviteRoleId ||
			!inviteRoles.some((role) => role.id === inviteRoleId)
		) {
			setInviteRoleId(inviteRoles[0].id);
		}
	}, [inviteRoleId, inviteRoles]);

	useEffect(() => {
		if (!boardId || !isE2eeBoard) return;
		const keyFromHash = readE2eeKeyFromHash();
		const known = getKnownE2eeKey(boardId);
		if (known) {
			setE2eeKey(known);
			setE2eeKeyDraft(known);
		}
		setShouldRefreshOwnKeyRecipient(!!keyFromHash);
	}, [boardId, isE2eeBoard]);

	useEffect(() => {
		if (!boardId || e2eeKey || !ownKeyRecipient?.encryptedBoardKey) return;
		const identity = readUnlockedUserE2eeIdentity(session?.user?.email);
		if (!identity) return;

		let cancelled = false;
		const unlockFromRecipientEnvelope = async () => {
			try {
				await recoverBoardKeyWithIdentity(
					identity,
					ownKeyRecipient.encryptedBoardKey,
				);
				if (cancelled) return;
			} catch (error) {
				if (!cancelled) setShouldRefreshOwnKeyRecipient(true);
				console.error("E2EE board key recovery failed", error);
			}
		};

		void unlockFromRecipientEnvelope();
		return () => {
			cancelled = true;
		};
	}, [
		boardId,
		e2eeKey,
		ownKeyRecipient?.encryptedBoardKey,
		recoverBoardKeyWithIdentity,
		session?.user?.email,
	]);

	useEffect(() => {
		if (
			!boardId ||
			!e2eeKey ||
			(ownKeyRecipient?.encryptedBoardKey && !shouldRefreshOwnKeyRecipient) ||
			!session?.user?.id
		)
			return;
		const identity = readUnlockedUserE2eeIdentity(session?.user?.email);
		if (!identity) return;
		const writeKey = `${boardId}:${e2eeKey}`;
		if (ownKeyRecipientWriteRef.current === writeKey) return;
		ownKeyRecipientWriteRef.current = writeKey;

		const storeOwnRecipientEnvelope = async () => {
			try {
				await storeOwnBoardKeyWithIdentity(identity, e2eeKey);
			} catch (error) {
				ownKeyRecipientWriteRef.current = null;
				console.error("E2EE own board key wrapping failed", error);
			}
		};

		void storeOwnRecipientEnvelope();
	}, [
		boardId,
		e2eeKey,
		ownKeyRecipient?.encryptedBoardKey,
		session?.user?.id,
		session?.user?.email,
		shouldRefreshOwnKeyRecipient,
		storeOwnBoardKeyWithIdentity,
	]);

	const e2eeHasKeyHash = board?.e2eeHasKeyHash ?? false;

	useEffect(() => {
		if (
			!boardId ||
			e2eeHasKeyHash ||
			!canManage ||
			!e2eeKey ||
			registerE2eeKeyHash.isPending
		) {
			return;
		}

		let cancelled = false;
		const registerHash = async () => {
			try {
				const keyHash = await createE2eeKeyHash(e2eeKey);
				if (cancelled) return;
				await registerE2eeKeyHash.mutateAsync({ id: boardId, keyHash });
			} catch (error) {
				console.error("E2EE key verifier registration failed", error);
			}
		};

		void registerHash();
		return () => {
			cancelled = true;
		};
	}, [
		boardId,
		canManage,
		e2eeKey,
		e2eeHasKeyHash,
		registerE2eeKeyHash.isPending,
		registerE2eeKeyHash.mutateAsync,
	]);

	const notionIntegration = integrations.find(
		(integration) => integration.provider === "notion",
	);
	const obsidianIntegration = integrations.find(
		(integration) => integration.provider === "obsidian",
	);

	useEffect(() => {
		if (!notionIntegration) return;
		setNotionPageId(notionIntegration.target);
	}, [notionIntegration]);

	useEffect(() => {
		if (!obsidianIntegration) return;
		setObsidianPath(obsidianIntegration.target);
		if (typeof obsidianIntegration.config.endpointUrl === "string") {
			setObsidianEndpoint(obsidianIntegration.config.endpointUrl);
		}
	}, [obsidianIntegration]);

	const threads = (commentThreads ?? []) as WhiteboardCommentThread[];
	const kanbanAssignmentOptions = useMemo(() => {
		if (!assignmentOptions) return undefined;
		return {
			members: assignmentOptions.members.map((member) => ({
				id: member.id,
				name: member.name,
				image: member.image,
				roleName: member.roleName ?? undefined,
				roleColor: member.roleColor ?? undefined,
			})),
			roles: assignmentOptions.roles ?? assignmentOptions.groups,
		};
	}, [assignmentOptions]);

	const mentionCandidates = useMemo(
		() => kanbanAssignmentOptions?.members ?? [],
		[kanbanAssignmentOptions?.members],
	);

	const currentUser = session?.user
		? {
				id: session.user.id,
				name: session.user.name,
				image: session.user.image ?? null,
			}
		: undefined;

	const handleSelectThreadFromPanel = useCallback(
		(threadId: string) => {
			setSelectedThreadId(threadId);
			setCommentPlacementActive(false);
			setPendingCommentPlacement(null);

			const thread = threads.find((item) => item.id === threadId);
			if (thread) {
				focusCanvasPointRef.current?.(thread.x, thread.y);
			}
		},
		[threads],
	);

	const handleCanvasCommentClick = useCallback((x: number, y: number) => {
		setPendingCommentPlacement({ x, y });
		setCommentPlacementActive(false);
	}, []);

	const handleCreateThread = useCallback(
		(body: string) => {
			if (!boardId || !pendingCommentPlacement) return;
			createCommentThread.mutate({
				whiteboardId: boardId,
				x: pendingCommentPlacement.x,
				y: pendingCommentPlacement.y,
				body,
			});
		},
		[boardId, createCommentThread, pendingCommentPlacement],
	);

	if (!boardId) return null;

	if (isLoading || !board) {
		return (
			<div className="flex h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	const handleCopyShare = async () => {
		if (!shareUrl) return;
		await navigator.clipboard.writeText(shareUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleCopyEmbedUrl = async () => {
		if (!embedUrl) return;
		await navigator.clipboard.writeText(embedUrl);
		setEmbedCopied(true);
		setTimeout(() => setEmbedCopied(false), 2000);
	};

	const handleCopyEmbedCode = async () => {
		if (!embedCode) return;
		await navigator.clipboard.writeText(embedCode);
		setEmbedCodeCopied(true);
		setTimeout(() => setEmbedCodeCopied(false), 2000);
	};

	const handleCopyMcpKey = async () => {
		if (!e2eeKey) return;
		await navigator.clipboard.writeText(e2eeKey);
		setMcpKeyCopied(true);
		setTimeout(() => setMcpKeyCopied(false), 2000);
	};

	const handleCopyNotionLink = async () => {
		if (!integrationUrl) return;
		await navigator.clipboard.writeText(integrationUrl);
		setNotionCopied(true);
		setTimeout(() => setNotionCopied(false), 2000);
	};

	const handleCopyObsidianMarkdown = async () => {
		if (!obsidianMarkdown) return;
		await navigator.clipboard.writeText(obsidianMarkdown);
		setObsidianCopied(true);
		setTimeout(() => setObsidianCopied(false), 2000);
	};

	const handleUseE2eeKey = () => {
		const key = e2eeKeyDraft.trim();
		if (!key || !boardId) return;
		storeE2eeKey(boardId, key);
		putE2eeKeyInCurrentUrl(key);
		setE2eeKey(key);
	};

	const handleUnlockIdentityForBoard = async (event: React.FormEvent) => {
		event.preventDefault();
		if (
			!session?.user?.email ||
			!identityUnlockPassword ||
			(!ownKeyRecipient?.encryptedBoardKey && !e2eeKey)
		) {
			return;
		}
		setIdentityUnlockLoading(true);
		setIdentityUnlockError("");
		try {
			const identityResult = await identityQuery.refetch();
			const identity = await unlockOrCreateUserE2eeIdentity({
				email: session.user.email,
				password: identityUnlockPassword,
				existingIdentity: identityResult.data ?? null,
				saveIdentity: saveIdentity.mutateAsync,
			});
			if (!e2eeKey && ownKeyRecipient?.encryptedBoardKey) {
				await recoverBoardKeyWithIdentity(
					identity,
					ownKeyRecipient.encryptedBoardKey,
				);
			} else if (
				e2eeKey &&
				(!ownKeyRecipient?.encryptedBoardKey || shouldRefreshOwnKeyRecipient)
			) {
				await storeOwnBoardKeyWithIdentity(identity, e2eeKey);
			}
			setIdentityUnlockPassword("");
		} catch (error) {
			console.error("E2EE identity unlock failed", error);
			setIdentityUnlockError(
				"Die E2EE-Identity konnte nicht entsperrt oder gespeichert werden. Pruefe dein Konto-Passwort oder deinen E2EE-Sicherheitscode.",
			);
		} finally {
			setIdentityUnlockLoading(false);
		}
	};

	const handleSaveNotionIntegration = () => {
		if (!boardId || !notionPageId.trim()) return;
		saveNotionIntegration.mutate({
			whiteboardId: boardId,
			pageOrBlockId: notionPageId.trim(),
			integrationToken: notionToken.trim() || undefined,
			enabled: true,
		});
		setNotionToken("");
	};

	const handleSaveObsidianIntegration = () => {
		if (!boardId || !obsidianEndpoint.trim() || !obsidianPath.trim()) return;
		saveObsidianIntegration.mutate({
			whiteboardId: boardId,
			endpointUrl: obsidianEndpoint.trim(),
			vaultPath: obsidianPath.trim(),
			apiKey: obsidianApiKey.trim() || undefined,
			enabled: true,
		});
		setObsidianApiKey("");
	};

	const commentMutationPending =
		createCommentThread.isPending ||
		addCommentReply.isPending ||
		setCommentThreadResolved.isPending ||
		deleteCommentThread.isPending;
	const canUnlockBoardWithIdentity =
		!!session?.user?.email && !e2eeKey && !!ownKeyRecipient?.encryptedBoardKey;
	const canSaveBoardRecoveryWithIdentity =
		!!session?.user?.email &&
		!!e2eeKey &&
		(ownKeyRecipient === null || shouldRefreshOwnKeyRecipient);
	const inviteE2eeHint = !isE2eeBoard
		? t("whiteboardPage.share.inviteServerHint")
		: inviteKeyDelivery === "fragment"
			? t("whiteboardPage.share.inviteE2eeHint")
			: inviteKeyDelivery === "recipient"
				? t("whiteboardPage.share.inviteE2eeRecipientEnvelopeHint")
				: t("whiteboardPage.share.inviteE2eeMissingKeyHint");

	return (
		<div className="relative h-screen overflow-hidden">
			<div className="absolute left-4 top-4 z-50 flex items-center gap-2">
				<Button
					asChild
					variant="outline"
					size="sm"
					className="bg-card/90 backdrop-blur-md"
				>
					<Link to="/library">
						<ArrowLeft className="mr-2 h-4 w-4" />
						{t("whiteboardPage.backToLibrary")}
					</Link>
				</Button>
			</div>

			<TooltipProvider>
				<div className="absolute right-4 top-4 z-50 flex items-center gap-2">
					<BoardAppearanceMenu />

					{canViewActivity ? (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="icon"
									className={`h-9 w-9 backdrop-blur-md ${
										activityOpen
											? "border-primary bg-primary/10 text-primary"
											: "bg-card/90"
									}`}
									aria-label={t("whiteboardPage.activity.open")}
									aria-pressed={activityOpen}
									onClick={() => {
										setActivityOpen((open) => {
											if (!open) setCommentsOpen(false);
											return !open;
										});
									}}
								>
									<History className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								{t("whiteboardPage.activity.open")}
							</TooltipContent>
						</Tooltip>
					) : null}

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								className={`h-9 w-9 backdrop-blur-md ${
									commentsOpen
										? "border-primary bg-primary/10 text-primary"
										: "bg-card/90"
								}`}
								aria-label={t("whiteboardPage.comments.label")}
								aria-pressed={commentsOpen}
								onClick={() => {
									setCommentsOpen((open) => {
										if (!open) setActivityOpen(false);
										return !open;
									});
								}}
							>
								<MessageSquare className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							{t("whiteboardPage.comments.label")}
						</TooltipContent>
					</Tooltip>

					{callsConfig?.enabled ? (
						<Dialog open={callOpen} onOpenChange={setCallOpen}>
							<Tooltip>
								<TooltipTrigger asChild>
									<DialogTrigger asChild>
										<Button
											variant="outline"
											size="icon"
											className="h-9 w-9 bg-card/90 backdrop-blur-md"
											aria-label={t("canvas.call.open")}
										>
											<MonitorPlay className="h-4 w-4" />
										</Button>
									</DialogTrigger>
								</TooltipTrigger>
								<TooltipContent>{t("canvas.call.open")}</TooltipContent>
							</Tooltip>
							<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
								<DialogHeader>
									<DialogTitle>{t("canvas.call.title")}</DialogTitle>
									<DialogDescription>
										{t("canvas.call.description")}
									</DialogDescription>
								</DialogHeader>
								{callOpen ? (
									<Suspense
										fallback={
											<div className="flex h-48 items-center justify-center">
												<Loader2 className="h-6 w-6 animate-spin text-primary" />
											</div>
										}
									>
										<LiveCallPanel
											boardId={board.id}
											boardName={board.name}
											open={callOpen}
										/>
									</Suspense>
								) : null}
							</DialogContent>
						</Dialog>
					) : null}

					<Dialog>
						<DialogTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="bg-card/90 backdrop-blur-md"
							>
								<Share2 className="mr-2 h-4 w-4" />
								{t("whiteboardPage.share.title")}
							</Button>
						</DialogTrigger>
						<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
							<DialogHeader>
								<DialogTitle>{t("whiteboardPage.share.title")}</DialogTitle>
								<DialogDescription>
									{t("whiteboardPage.share.subtitle")}
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4">
								<div className="rounded-md border border-border/60 p-3">
									<p className="flex items-center gap-2 text-sm font-medium">
										<Code2 className="h-4 w-4 text-muted-foreground" />
										{t("whiteboardPage.share.mcpKeyTitle")}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{!isE2eeBoard
											? t("whiteboardPage.share.mcpServerHint")
											: e2eeKey
												? t("whiteboardPage.share.mcpKeyHint")
												: t("whiteboardPage.share.mcpKeyUnavailable")}
									</p>
									{isE2eeBoard ? (
										<Button
											className="mt-3"
											disabled={!e2eeKey}
											onClick={handleCopyMcpKey}
											variant="outline"
										>
											{mcpKeyCopied ? (
												<Check className="mr-2 h-4 w-4" />
											) : (
												<Copy className="mr-2 h-4 w-4" />
											)}
											{mcpKeyCopied
												? t("whiteboardPage.share.mcpKeyCopied")
												: t("whiteboardPage.share.copyMcpKey")}
										</Button>
									) : null}
								</div>

								<BoardShareMembersList
									boardId={board.id}
									canManage={canManageMembers}
									inviteRoles={canManageMembers ? inviteRoles : undefined}
								/>
								{canManageMembers ? (
									<div className="border-t pt-4 space-y-3">
										<div>
											<p className="text-sm font-medium">
												{t("whiteboardPage.share.teamRoleAccessTitle")}
											</p>
											<p className="text-xs text-muted-foreground">
												{t("whiteboardPage.share.teamRoleAccessHint")}
											</p>
										</div>
										{(inviteRoles?.length ?? 0) === 0 ? (
											<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-950 dark:text-amber-100">
												<p>{t("whiteboardPage.share.teamRolesEmptyInvite")}</p>
												<Button
													variant="outline"
													size="sm"
													className="mt-3"
													asChild
												>
													<Link to="/settings?tab=team">
														{t("whiteboardPage.share.manageRolesAction")}
													</Link>
												</Button>
											</div>
										) : (
											<ul className="space-y-2">
												{inviteRoles?.map((role) => (
													<li
														key={role.id}
														className="rounded-lg border border-border/70 bg-muted/15 p-3"
													>
														<label className="flex cursor-pointer items-start gap-3">
															<input
																type="checkbox"
																className="mt-1"
																checked={role.granted}
																disabled={setTeamRoleAccess.isPending}
																onChange={(event) =>
																	setTeamRoleAccess.mutate({
																		id: board.id,
																		roleId: role.id,
																		enabled: event.target.checked,
																	})
																}
															/>
															<span className="min-w-0 flex-1 space-y-2">
																<RoleBadge
																	name={role.name}
																	color={role.color}
																/>
																<RolePermissionsSummary
																	permissions={role.permissions}
																/>
															</span>
														</label>
													</li>
												))}
											</ul>
										)}
									</div>
								) : null}
								{canManageShare ? (
									<>
										<label className="flex items-center gap-2 text-sm">
											<input
												type="checkbox"
												checked={shareSettings?.shareEnabled ?? false}
												onChange={(e) =>
													updateShare.mutate({
														id: board.id,
														enabled: e.target.checked,
													})
												}
											/>
											{t("whiteboardPage.share.enablePublicLink")}
										</label>
										{shareSettings?.shareEnabled && shareUrl && (
											<div className="space-y-2">
												<Input readOnly value={shareUrl} />
												<div className="flex gap-2">
													<Button
														variant="outline"
														className="flex-1"
														onClick={handleCopyShare}
													>
														{copied ? (
															<Check className="h-4 w-4" />
														) : (
															<Copy className="h-4 w-4" />
														)}
														{copied
															? t("whiteboardPage.share.copied")
															: t("whiteboardPage.share.copyLink")}
													</Button>
													<Button variant="outline" asChild>
														<a href={shareUrl} target="_blank" rel="noreferrer">
															<ExternalLink className="h-4 w-4" />
														</a>
													</Button>
													<Button
														variant="outline"
														disabled={regenerateShare.isPending}
														onClick={() =>
															regenerateShare.mutate({ id: board.id })
														}
													>
														<RefreshCcw className="h-4 w-4" />
													</Button>
												</div>
											</div>
										)}
										<div className="border-t pt-4 space-y-3">
											<p className="text-sm font-medium">
												{t("whiteboardPage.share.collabLinkTitle")}
											</p>
											<p className="text-xs text-muted-foreground">
												{t("whiteboardPage.share.linkAccessHint")}
											</p>
											<label className="flex items-center gap-2 text-sm">
												<input
													type="checkbox"
													checked={collabSettings?.enabled ?? false}
													onChange={(e) =>
														updateCollabShare.mutate({
															id: board.id,
															enabled: e.target.checked,
															accessLevel:
																collabSettings?.accessLevel ?? "edit",
														})
													}
												/>
												{t("whiteboardPage.share.enableCollabLink")}
											</label>
											{collabSettings?.enabled && (
												<>
													<select
														className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
														value={collabSettings.accessLevel}
														onChange={(e) =>
															updateCollabShare.mutate({
																id: board.id,
																enabled: true,
																accessLevel: e.target.value as "view" | "edit",
															})
														}
													>
														<option value="edit">
															{t("whiteboardPage.share.collabEdit")}
														</option>
														<option value="view">
															{t("whiteboardPage.share.collabView")}
														</option>
													</select>
													{collabUrl && (
														<div className="flex gap-2">
															<Input readOnly value={collabUrl} />
															<Button
																variant="outline"
																onClick={async () => {
																	await navigator.clipboard.writeText(
																		collabUrl,
																	);
																	setCollabCopied(true);
																	setTimeout(
																		() => setCollabCopied(false),
																		2000,
																	);
																}}
															>
																{collabCopied ? (
																	<Check className="h-4 w-4" />
																) : (
																	<Copy className="h-4 w-4" />
																)}
															</Button>
														</div>
													)}
												</>
											)}
										</div>
										<div className="border-t pt-4 space-y-3">
											<p className="flex items-center gap-2 text-sm font-medium">
												<Code2 className="h-4 w-4 text-muted-foreground" />
												{t("whiteboardPage.share.embedLinkTitle")}
											</p>
											<p className="text-xs text-muted-foreground">
												{t("whiteboardPage.share.embedLinkHint")}
											</p>
											<label className="flex items-center gap-2 text-sm">
												<input
													type="checkbox"
													checked={embedSettings?.enabled ?? false}
													onChange={(e) =>
														updateEmbedShare.mutate({
															id: board.id,
															enabled: e.target.checked,
														})
													}
												/>
												{t("whiteboardPage.share.enableEmbedLink")}
											</label>
											{embedSettings?.enabled && embedUrl && (
												<div className="space-y-2">
													<div className="flex gap-2">
														<Input readOnly value={embedUrl} />
														<Button
															variant="outline"
															onClick={handleCopyEmbedUrl}
														>
															{embedCopied ? (
																<Check className="h-4 w-4" />
															) : (
																<Copy className="h-4 w-4" />
															)}
														</Button>
														<Button variant="outline" asChild>
															<a
																href={embedUrl}
																target="_blank"
																rel="noreferrer"
															>
																<ExternalLink className="h-4 w-4" />
															</a>
														</Button>
													</div>
													<div className="flex gap-2">
														<Input readOnly value={embedCode} />
														<Button
															variant="outline"
															onClick={handleCopyEmbedCode}
														>
															{embedCodeCopied ? (
																<Check className="h-4 w-4" />
															) : (
																<Copy className="h-4 w-4" />
															)}
															<span className="sr-only">
																{t("whiteboardPage.share.copyEmbedCode")}
															</span>
														</Button>
													</div>
													<div className="rounded-md border border-border/60 p-3 space-y-3">
														<p className="text-sm font-medium">
															{t("whiteboardPage.share.integrationsTitle")}
														</p>
														<p className="text-xs text-muted-foreground">
															Notion schreibt/aktualisiert einen Embed-Block per
															Notion API. Obsidian synchronisiert eine
															Markdown-Datei über die Local REST API.
														</p>
														<div className="space-y-2">
															<p className="text-xs font-medium uppercase text-muted-foreground">
																Notion
															</p>
															<Input
																value={notionPageId}
																onChange={(event) =>
																	setNotionPageId(event.target.value)
																}
																placeholder="Page- oder Block-ID"
															/>
															<Input
																value={notionToken}
																onChange={(event) =>
																	setNotionToken(event.target.value)
																}
																placeholder={
																	notionIntegration?.hasSecret
																		? "Token gespeichert"
																		: "Notion Integration Token"
																}
																type="password"
															/>
															<div className="grid gap-2 sm:grid-cols-2">
																<Button
																	variant="outline"
																	size="sm"
																	disabled={
																		!notionPageId.trim() ||
																		saveNotionIntegration.isPending
																	}
																	onClick={handleSaveNotionIntegration}
																>
																	{notionIntegration
																		? "Speichern"
																		: "Verbinden"}
																</Button>
																<Button
																	variant="outline"
																	size="sm"
																	disabled={
																		!notionIntegration ||
																		syncIntegration.isPending
																	}
																	onClick={() =>
																		syncIntegration.mutate({
																			whiteboardId: board.id,
																			provider: "notion",
																		})
																	}
																>
																	Jetzt syncen
																</Button>
															</div>
															{notionIntegration?.lastSyncError ? (
																<p className="text-xs text-destructive">
																	{notionIntegration.lastSyncError}
																</p>
															) : null}
														</div>
														<div className="space-y-2 border-t pt-3">
															<p className="text-xs font-medium uppercase text-muted-foreground">
																Obsidian
															</p>
															<Input
																value={obsidianEndpoint}
																onChange={(event) =>
																	setObsidianEndpoint(event.target.value)
																}
																placeholder="http://127.0.0.1:27123"
															/>
															<Input
																value={obsidianPath}
																onChange={(event) =>
																	setObsidianPath(event.target.value)
																}
																placeholder="Skedra/Board.md"
															/>
															<Input
																value={obsidianApiKey}
																onChange={(event) =>
																	setObsidianApiKey(event.target.value)
																}
																placeholder={
																	obsidianIntegration?.hasSecret
																		? "API-Key gespeichert"
																		: "Local REST API-Key"
																}
																type="password"
															/>
															<div className="grid gap-2 sm:grid-cols-2">
																<Button
																	variant="outline"
																	size="sm"
																	disabled={
																		!obsidianEndpoint.trim() ||
																		!obsidianPath.trim() ||
																		saveObsidianIntegration.isPending
																	}
																	onClick={handleSaveObsidianIntegration}
																>
																	{obsidianIntegration
																		? "Speichern"
																		: "Verbinden"}
																</Button>
																<Button
																	variant="outline"
																	size="sm"
																	disabled={
																		!obsidianIntegration ||
																		syncIntegration.isPending
																	}
																	onClick={() =>
																		syncIntegration.mutate({
																			whiteboardId: board.id,
																			provider: "obsidian",
																		})
																	}
																>
																	Jetzt syncen
																</Button>
															</div>
															{obsidianIntegration?.lastSyncError ? (
																<p className="text-xs text-destructive">
																	{obsidianIntegration.lastSyncError}
																</p>
															) : null}
														</div>
														<div className="grid gap-2 border-t pt-3 sm:grid-cols-2">
															<Button
																variant="outline"
																size="sm"
																onClick={handleCopyNotionLink}
															>
																{notionCopied ? (
																	<Check className="mr-2 h-4 w-4" />
																) : (
																	<Copy className="mr-2 h-4 w-4" />
																)}
																Link kopieren
															</Button>
															<Button
																variant="outline"
																size="sm"
																onClick={handleCopyObsidianMarkdown}
															>
																{obsidianCopied ? (
																	<Check className="mr-2 h-4 w-4" />
																) : (
																	<Copy className="mr-2 h-4 w-4" />
																)}
																Markdown kopieren
															</Button>
														</div>
													</div>
												</div>
											)}
										</div>
									</>
								) : null}
								{canInvite ? (
									<div className="border-t pt-4 space-y-3">
										<p className="mb-1 text-sm font-medium">
											{t("whiteboardPage.share.inviteCollaborator")}
										</p>
										<p className="text-xs text-muted-foreground">
											{t("whiteboardPage.share.inviteRoleHint")}
										</p>
										{(inviteRoles?.length ?? 0) === 0 ? (
											<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-950 dark:text-amber-100">
												<p>{t("whiteboardPage.share.teamRolesEmptyInvite")}</p>
												{canManage ? (
													<Button
														variant="outline"
														size="sm"
														className="mt-3"
														asChild
													>
														<Link to="/settings?tab=team">
															{t("whiteboardPage.share.manageRolesAction")}
														</Link>
													</Button>
												) : null}
											</div>
										) : (
											<div className="flex flex-col gap-3">
												<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
													<Input
														type="email"
														placeholder="email@example.com"
														value={inviteEmail}
														onChange={(e) => {
															setInviteEmail(e.target.value);
															setInviteLink("");
															setInviteKeyDelivery("none");
														}}
														className="flex-1"
													/>
													<div className="space-y-1.5 min-w-[160px]">
														<label
															className="text-xs font-medium text-muted-foreground"
															htmlFor="board-invite-role"
														>
															{t("whiteboardPage.share.inviteRoleLabel")}
														</label>
														<select
															id="board-invite-role"
															className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
															value={selectedInviteRole?.id ?? ""}
															onChange={(e) => setInviteRoleId(e.target.value)}
														>
															{inviteRoles?.map((role) => (
																<option key={role.id} value={role.id}>
																	{role.name}
																</option>
															))}
														</select>
													</div>
													<Button
														disabled={
															!inviteEmail ||
															!selectedInviteRole?.id ||
															inviteMember.isPending
														}
														onClick={() => {
															if (!selectedInviteRole?.id) return;
															inviteMember.mutate({
																id: board.id,
																email: inviteEmail,
																roleId: selectedInviteRole.id,
															});
														}}
													>
														{t("whiteboardPage.share.invite")}
													</Button>
												</div>
												{inviteLink ? (
													<div className="rounded-lg border border-border/70 bg-muted/20 p-3">
														<div className="flex flex-col gap-2 sm:flex-row">
															<Input
																readOnly
																value={inviteLink}
																className="text-xs"
															/>
															<Button
																variant="outline"
																type="button"
																onClick={async () => {
																	await navigator.clipboard.writeText(
																		inviteLink,
																	);
																	setInviteCopied(true);
																	setTimeout(
																		() => setInviteCopied(false),
																		2000,
																	);
																}}
															>
																{inviteCopied ? (
																	<Check className="h-4 w-4" />
																) : (
																	<Copy className="h-4 w-4" />
																)}
																{inviteCopied
																	? t("common.copied")
																	: t("common.copy")}
															</Button>
														</div>
														<p className="mt-2 text-xs text-muted-foreground">
															{inviteE2eeHint}
														</p>
													</div>
												) : null}
												{selectedInviteRole ? (
													<div className="rounded-lg border border-border/70 bg-muted/20 p-3">
														<RoleBadge
															name={selectedInviteRole.name}
															color={selectedInviteRole.color}
														/>
														<div className="mt-2">
															<RolePermissionsSummary
																permissions={selectedInviteRole.permissions}
															/>
														</div>
													</div>
												) : null}
											</div>
										)}
									</div>
								) : null}
							</div>
						</DialogContent>
					</Dialog>

					{presenterMode ? (
						<Button
							asChild
							variant="outline"
							size="sm"
							className="bg-card/90 backdrop-blur-md"
						>
							<Link to={normalBoardHref}>
								{t("whiteboardPage.presenter.exit")}
							</Link>
						</Button>
					) : presentationPreparationMode ? (
						<>
							<Button
								asChild
								variant="outline"
								size="sm"
								className="bg-card/90 backdrop-blur-md"
							>
								<Link to={normalBoardHref}>
									{t("whiteboardPage.presenter.exitPreparation")}
								</Link>
							</Button>
							{isOwner && (
								<Button
									variant="outline"
									size="sm"
									className="bg-card/90 backdrop-blur-md"
									asChild
								>
									<Link to={presenterBoardHref}>
										<MonitorPlay className="mr-2 h-4 w-4" />
										{t("whiteboardPage.presenter.title")}
									</Link>
								</Button>
							)}
						</>
					) : (
						isOwner && (
							<Button
								variant="outline"
								size="sm"
								className="bg-card/90 backdrop-blur-md"
								asChild
							>
								<Link to={preparationBoardHref}>
									<MonitorPlay className="mr-2 h-4 w-4" />
									{t("whiteboardPage.presenter.prepare")}
								</Link>
							</Button>
						)
					)}
				</div>
			</TooltipProvider>

			{isE2eeBoard && !e2eeKey ? (
				<div className="absolute inset-x-4 top-20 z-[60] mx-auto max-w-md rounded-md border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
					<div className="mb-3 flex items-center gap-2">
						<ShieldCheck className="h-4 w-4 text-primary" />
						<p className="text-sm font-medium">E2EE-Board entsperren</p>
					</div>
					<p className="mb-3 text-xs text-muted-foreground">
						Dieses Board ist browserseitig verschlüsselt. Füge den Schlüssel ein
						oder öffne einen Link mit Schlüssel-Fragment.
					</p>
					<div className="flex gap-2">
						<Input
							type="password"
							value={e2eeKeyDraft}
							onChange={(event) => setE2eeKeyDraft(event.target.value)}
							placeholder="E2EE-Schlüssel"
						/>
						<Button onClick={handleUseE2eeKey}>
							<Check className="h-4 w-4" />
						</Button>
					</div>
					{canUnlockBoardWithIdentity ? (
						<form
							className="mt-4 border-t border-border/70 pt-4"
							onSubmit={handleUnlockIdentityForBoard}
						>
							<p className="mb-2 text-xs text-muted-foreground">
								Oder entsperre deine User-Identity mit deinem Konto-Passwort
								oder E2EE-Sicherheitscode, um den gespeicherten
								Board-Key-Umschlag zu oeffnen.
							</p>
							<div className="flex gap-2">
								<Input
									type="password"
									value={identityUnlockPassword}
									onChange={(event) =>
										setIdentityUnlockPassword(event.target.value)
									}
									placeholder="Passwort oder E2EE-Sicherheitscode"
								/>
								<Button
									type="submit"
									disabled={identityUnlockLoading || !identityUnlockPassword}
								>
									{identityUnlockLoading ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<ShieldCheck className="h-4 w-4" />
									)}
								</Button>
							</div>
							{identityUnlockError ? (
								<p className="mt-2 text-xs text-destructive">
									{identityUnlockError}
								</p>
							) : null}
						</form>
					) : null}
				</div>
			) : null}

			{canSaveBoardRecoveryWithIdentity ? (
				<div className="absolute inset-x-4 top-20 z-[60] mx-auto max-w-md rounded-md border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
					<div className="mb-3 flex items-center gap-2">
						<ShieldCheck className="h-4 w-4 text-primary" />
						<p className="text-sm font-medium">
							E2EE-Recovery fuer dieses Board speichern
						</p>
					</div>
					<p className="mb-3 text-xs text-muted-foreground">
						Entsperre deine User-Identity mit deinem Konto-Passwort oder
						E2EE-Sicherheitscode, damit Skedra den Board-Schluessel als
						Recovery-Umschlag fuer dich speichern oder aktualisieren kann.
					</p>
					<form onSubmit={handleUnlockIdentityForBoard}>
						<div className="flex gap-2">
							<Input
								type="password"
								value={identityUnlockPassword}
								onChange={(event) =>
									setIdentityUnlockPassword(event.target.value)
								}
								placeholder="Passwort oder E2EE-Sicherheitscode"
							/>
							<Button
								type="submit"
								disabled={identityUnlockLoading || !identityUnlockPassword}
							>
								{identityUnlockLoading ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<ShieldCheck className="h-4 w-4" />
								)}
							</Button>
						</div>
						{identityUnlockError ? (
							<p className="mt-2 text-xs text-destructive">
								{identityUnlockError}
							</p>
						) : null}
					</form>
				</div>
			) : null}

			<Suspense
				fallback={
					<div className="flex h-full items-center justify-center">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
					</div>
				}
			>
				<SkedraCanvas
					whiteboardId={boardId}
					encryptionMode={encryptionMode}
					canUseAi={board?.canUseAi ?? true}
					e2eeKey={e2eeKey}
					e2eeStateRef={e2eeStateRef}
					forceReadonly={!canWrite}
					kanbanAssignmentOptions={kanbanAssignmentOptions}
					presencePanelOffsetTop={68}
					presenterMode={presenterMode}
					presentationPreparationMode={presentationPreparationMode}
					presenterShareUrl={shareUrl}
					presenterSessionId={presenterSessionId}
					presenterStartedAt={presenterStartedAt}
					presenterSessionStarting={startPresentation.isPending}
					presenterStartError={
						startPresentation.error?.message ?? endPresentation.error?.message
					}
					onStartPresentation={handleStartPresentation}
					onEndPresentation={handleEndPresentation}
					onCancelPresentationPreparation={() =>
						navigate(normalBoardHref, { replace: true })
					}
					onPresentationSessionEnded={() => {
						setPresenterSessionId(null);
						setPresenterStartedAt(null);
					}}
					focusCanvasPointRef={focusCanvasPointRef}
					comments={{
						threads,
						selectedThreadId,
						pendingPlacement: pendingCommentPlacement,
						placementActive: commentPlacementActive,
						showResolved: showResolvedComments,
						currentUser,
						mentionCandidates,
						canModerate: canResolveComments,
						canComment,
						isSending: commentMutationPending,
						deletingMessageId,
						onSelectThread: setSelectedThreadId,
						onCanvasClick: handleCanvasCommentClick,
						onCreateThread: handleCreateThread,
						onReply: (threadId, body) =>
							addCommentReply.mutate({ whiteboardId: boardId, threadId, body }),
						onResolve: (threadId, resolved) =>
							setCommentThreadResolved.mutate({
								whiteboardId: boardId,
								threadId,
								resolved,
							}),
						onDeleteThread: (threadId) =>
							deleteCommentThread.mutate({ whiteboardId: boardId, threadId }),
						onDeleteMessage: (messageId) => {
							setDeletingMessageId(messageId);
							deleteCommentMessage.mutate({ whiteboardId: boardId, messageId });
						},
						onCancelPlacement: () => {
							setPendingCommentPlacement(null);
							setCommentPlacementActive(false);
						},
					}}
				/>
			</Suspense>

			<WhiteboardCommentsPanel
				open={commentsOpen}
				whiteboardName={board.name}
				threads={threads}
				selectedThreadId={selectedThreadId}
				showResolved={showResolvedComments}
				placementActive={commentPlacementActive}
				isLoading={commentsLoading}
				onClose={() => {
					setCommentsOpen(false);
					setCommentPlacementActive(false);
					setPendingCommentPlacement(null);
				}}
				onSelectThread={handleSelectThreadFromPanel}
				onToggleShowResolved={() =>
					setShowResolvedComments((current) => !current)
				}
				onStartPlacement={() => {
					setCommentPlacementActive(true);
					setPendingCommentPlacement(null);
					setSelectedThreadId(null);
				}}
			/>

			<BoardActivityOverlay
				open={activityOpen}
				whiteboardId={boardId}
				whiteboardName={board.name}
				onClose={() => setActivityOpen(false)}
			/>
		</div>
	);
}
