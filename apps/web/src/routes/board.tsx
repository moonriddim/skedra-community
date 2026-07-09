import { BoardActivityOverlay } from "@/components/board";
import { BoardAppearanceMenu } from "@/components/board/board-appearance-menu";
import { LiveCallPanel } from "@/components/board/live-call-panel";
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
import { BoardShareMembersList } from "@/components/whiteboard/board-share-members-list";
import type { PendingCommentPlacement } from "@/components/whiteboard/canvas-comment-layer";
import type { WhiteboardCommentThread } from "@/components/whiteboard/whiteboard-comment-types";
import { WhiteboardCommentsPanel } from "@/components/whiteboard/whiteboard-comments-panel";
import { authClient } from "@/lib/auth-client";
import {
	encryptYjsUpdate,
	generateE2eeKey,
	getKnownE2eeKey,
	putE2eeKeyInCurrentUrl,
	storeE2eeKey,
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
import { Link, useParams, useSearchParams } from "react-router";

const SkedraCanvas = lazy(() =>
	import("@/components/canvas/skedra-canvas").then((m) => ({
		default: m.SkedraCanvas,
	})),
);

export function BoardPage() {
	const { boardId } = useParams();
	const [searchParams] = useSearchParams();
	const presenterMode = searchParams.get("present") === "1";
	const { t } = useI18n();
	const { data: session } = authClient.useSession();
	const utils = trpc.useUtils();
	const [copied, setCopied] = useState(false);
	const [commentsOpen, setCommentsOpen] = useState(false);
	const [activityOpen, setActivityOpen] = useState(false);
	const [nameDraft, setNameDraft] = useState("");
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRoleId, setInviteRoleId] = useState("");
	const [inviteLink, setInviteLink] = useState("");
	const [inviteCopied, setInviteCopied] = useState(false);
	const [collabCopied, setCollabCopied] = useState(false);
	const [embedCopied, setEmbedCopied] = useState(false);
	const [embedCodeCopied, setEmbedCodeCopied] = useState(false);
	const [notionCopied, setNotionCopied] = useState(false);
	const [obsidianCopied, setObsidianCopied] = useState(false);
	const [e2eeKey, setE2eeKey] = useState<string | null>(null);
	const [e2eeKeyDraft, setE2eeKeyDraft] = useState("");
	const [e2eeCopied, setE2eeCopied] = useState(false);
	const [notionPageId, setNotionPageId] = useState("");
	const [notionToken, setNotionToken] = useState("");
	const [obsidianEndpoint, setObsidianEndpoint] = useState(
		"http://127.0.0.1:27123",
	);
	const [obsidianPath, setObsidianPath] = useState("");
	const [obsidianApiKey, setObsidianApiKey] = useState("");
	const [callOpen, setCallOpen] = useState(false);
	const [presenterIsLive, setPresenterIsLive] = useState(false);
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

	const { data: board, isLoading } = trpc.whiteboard.getById.useQuery(
		{ id: boardId ?? "" },
		{ enabled: !!boardId },
	);
	const { data: callsConfig } = trpc.calls.getConfig.useQuery(undefined, {
		enabled: !!boardId,
	});

	const canManage = board?.canManage ?? false;
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

	const updateBoard = trpc.whiteboard.update.useMutation({
		onSuccess: () =>
			void utils.whiteboard.getById.invalidate({ id: boardId ?? "" }),
	});

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

	const enableE2ee = trpc.whiteboard.enableE2ee.useMutation({
		onSuccess: () => {
			void utils.whiteboard.getById.invalidate({ id: boardId ?? "" });
			void utils.whiteboard.getE2eeSettings.invalidate({ id: boardId ?? "" });
		},
	});

	const appendE2eeUpdate = trpc.whiteboard.appendE2eeUpdate.useMutation();

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
		onSuccess: (result) => {
			setInviteEmail("");
			setInviteLink("inviteUrl" in result ? result.inviteUrl : "");
			void utils.whiteboard.getAssignmentOptions.invalidate({
				id: boardId ?? "",
			});
			void utils.whiteboard.listMembers.invalidate({ id: boardId ?? "" });
		},
	});

	const heartbeatPresentation =
		trpc.whiteboard.heartbeatPresentationSession.useMutation({
			onSuccess: (result) => setPresenterIsLive(result.isPresentationActive),
		});

	useEffect(() => {
		if (!boardId || !presenterMode) {
			setPresenterIsLive(false);
			return;
		}

		void heartbeatPresentation.mutate({ id: boardId, active: true });
		const interval = window.setInterval(() => {
			void heartbeatPresentation.mutate({ id: boardId, active: true });
		}, 45_000);

		return () => {
			window.clearInterval(interval);
			void heartbeatPresentation.mutate({ id: boardId, active: false });
		};
	}, [boardId, presenterMode, heartbeatPresentation.mutate]);

	const shareUrl = useMemo(() => {
		if (!shareSettings?.shareToken) return "";
		const url = `${window.location.origin}/present/${shareSettings.shareToken}`;
		return board?.e2eeEnabled ? withE2eeKeyFragment(url, e2eeKey) : url;
	}, [board?.e2eeEnabled, e2eeKey, shareSettings?.shareToken]);

	const collabUrl = useMemo(() => {
		if (!collabSettings?.shareToken) return "";
		const url = `${window.location.origin}/collab/${collabSettings.shareToken}`;
		return board?.e2eeEnabled ? withE2eeKeyFragment(url, e2eeKey) : url;
	}, [board?.e2eeEnabled, collabSettings?.shareToken, e2eeKey]);

	const embedUrl = useMemo(() => {
		if (!embedSettings?.shareToken) return "";
		const url = `${window.location.origin}/embed/${embedSettings.shareToken}`;
		return board?.e2eeEnabled ? withE2eeKeyFragment(url, e2eeKey) : url;
	}, [board?.e2eeEnabled, e2eeKey, embedSettings?.shareToken]);

	const embedCode = useMemo(() => {
		if (!embedUrl) return "";
		return `<iframe src="${embedUrl}" title="${board?.name ?? "Skedra board"}" width="100%" height="640" loading="lazy" allowfullscreen></iframe>`;
	}, [board?.name, embedUrl]);

	const integrationUrl = useMemo(() => {
		if (embedUrl) return embedUrl;
		if (shareUrl) return shareUrl;
		const url = boardId ? `${window.location.origin}/board/${boardId}` : "";
		return board?.e2eeEnabled ? withE2eeKeyFragment(url, e2eeKey) : url;
	}, [board?.e2eeEnabled, boardId, e2eeKey, embedUrl, shareUrl]);

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
		if (!boardId) return;
		const known = getKnownE2eeKey(boardId);
		if (known) {
			setE2eeKey(known);
			setE2eeKeyDraft(known);
		}
	}, [boardId]);

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

	const handleEnableE2ee = async () => {
		if (!boardId || !board?.canManage) return;
		const key = generateE2eeKey();
		const currentState = e2eeStateRef.current?.() ?? null;
		storeE2eeKey(boardId, key);
		putE2eeKeyInCurrentUrl(key);
		setE2eeKey(key);
		setE2eeKeyDraft(key);
		await enableE2ee.mutateAsync({
			id: boardId,
			keyHint: `created-${new Date().toISOString().slice(0, 10)}`,
		});
		if (currentState && currentState.length > 0) {
			const encrypted = await encryptYjsUpdate(currentState, key);
			await appendE2eeUpdate.mutateAsync({
				whiteboardId: boardId,
				clientId: `migration-${Date.now()}`,
				update: encrypted,
			});
		}
		await utils.whiteboard.getById.invalidate({ id: boardId });
	};

	const handleCopyE2eeBoardLink = async () => {
		if (!boardId || !e2eeKey) return;
		await navigator.clipboard.writeText(
			withE2eeKeyFragment(
				`${window.location.origin}/board/${boardId}`,
				e2eeKey,
			),
		);
		setE2eeCopied(true);
		setTimeout(() => setE2eeCopied(false), 2000);
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

				{isOwner ? (
					<Input
						className="h-9 w-48 bg-card/90 backdrop-blur-md font-medium"
						value={nameDraft || board.name}
						onChange={(e) => setNameDraft(e.target.value)}
						onBlur={() => {
							const next = nameDraft.trim();
							if (next && next !== board.name) {
								updateBoard.mutate({ id: board.id, name: next });
							}
						}}
					/>
				) : (
					<div className="h-9 flex items-center px-3 rounded-lg border border-border bg-card/90 backdrop-blur-md font-medium text-sm">
						{board.name}
					</div>
				)}
			</div>

			<div className="absolute right-4 top-4 z-50 flex items-center gap-2">
				<BoardAppearanceMenu />

				{canViewActivity ? (
					<Button
						variant="outline"
						size="sm"
						className="bg-card/90 backdrop-blur-md"
						onClick={() => {
							setActivityOpen(true);
							setCommentsOpen(false);
						}}
					>
						<History className="mr-2 h-4 w-4" />
						{t("whiteboardPage.activity.open")}
					</Button>
				) : null}

				<Button
					variant="outline"
					size="sm"
					className="bg-card/90 backdrop-blur-md"
					onClick={() => {
						setCommentsOpen(true);
						setActivityOpen(false);
					}}
				>
					<MessageSquare className="mr-2 h-4 w-4" />
					{t("whiteboardPage.comments.label")}
				</Button>

				{callsConfig?.enabled ? (
					<Dialog open={callOpen} onOpenChange={setCallOpen}>
						<DialogTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="bg-card/90 backdrop-blur-md"
							>
								<MonitorPlay className="mr-2 h-4 w-4" />
								{t("canvas.call.open")}
							</Button>
						</DialogTrigger>
						<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
							<DialogHeader>
								<DialogTitle>{t("canvas.call.title")}</DialogTitle>
								<DialogDescription>
									{t("canvas.call.description")}
								</DialogDescription>
							</DialogHeader>
							<LiveCallPanel
								boardId={board.id}
								boardName={board.name}
								open={callOpen}
							/>
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
							<BoardShareMembersList
								boardId={board.id}
								canManage={canManageMembers}
								inviteRoles={canManageMembers ? inviteRoles : undefined}
							/>
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
														accessLevel: collabSettings?.accessLevel ?? "edit",
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
																await navigator.clipboard.writeText(collabUrl);
																setCollabCopied(true);
																setTimeout(() => setCollabCopied(false), 2000);
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
											<ShieldCheck className="h-4 w-4 text-muted-foreground" />
											Browserseitiges E2EE
										</p>
										<p className="text-xs text-muted-foreground">
											Der Board-Inhalt wird im Browser verschlüsselt. Der Server
											speichert nur verschlüsselte Yjs-Updates; der Schlüssel
											bleibt im URL-Fragment oder lokal im Browser.
										</p>
										{board.e2eeEnabled ? (
											<div className="space-y-2">
												<div className="flex gap-2">
													<Input
														value={e2eeKeyDraft}
														onChange={(event) =>
															setE2eeKeyDraft(event.target.value)
														}
														placeholder="E2EE-Schlüssel"
														type="password"
													/>
													<Button variant="outline" onClick={handleUseE2eeKey}>
														<Check className="h-4 w-4" />
													</Button>
												</div>
												<Button
													variant="outline"
													size="sm"
													disabled={!e2eeKey}
													onClick={handleCopyE2eeBoardLink}
												>
													{e2eeCopied ? (
														<Check className="mr-2 h-4 w-4" />
													) : (
														<Copy className="mr-2 h-4 w-4" />
													)}
													Sicheren Board-Link kopieren
												</Button>
											</div>
										) : (
											<Button
												variant="outline"
												disabled={enableE2ee.isPending || !board.canManage}
												onClick={() => void handleEnableE2ee()}
											>
												<ShieldCheck className="mr-2 h-4 w-4" />
												E2EE aktivieren
											</Button>
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
														<a href={embedUrl} target="_blank" rel="noreferrer">
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
																{notionIntegration ? "Speichern" : "Verbinden"}
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
											<p>{t("whiteboardPage.share.boardRolesEmptyInvite")}</p>
											{canManage ? (
												<Button
													variant="outline"
													size="sm"
													className="mt-3"
													asChild
												>
													<Link
														to={`/settings?tab=canvas-roles&boardId=${board.id}`}
													>
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
												<div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 sm:flex-row">
													<Input
														readOnly
														value={inviteLink}
														className="text-xs"
													/>
													<Button
														variant="outline"
														type="button"
														onClick={async () => {
															await navigator.clipboard.writeText(inviteLink);
															setInviteCopied(true);
															setTimeout(() => setInviteCopied(false), 2000);
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
						<Link to={`/board/${board.id}`}>
							{t("whiteboardPage.presenter.exit")}
						</Link>
					</Button>
				) : (
					isOwner &&
					shareSettings?.shareEnabled && (
						<Button
							variant="outline"
							size="sm"
							className="bg-card/90 backdrop-blur-md"
							asChild
						>
							<Link to={`/board/${board.id}?present=1`}>
								<MonitorPlay className="mr-2 h-4 w-4" />
								{t("whiteboardPage.presenter.title")}
							</Link>
						</Button>
					)
				)}
			</div>

			{board.e2eeEnabled && !e2eeKey ? (
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
					canUseAi={board?.canUseAi ?? true}
					e2eeEnabled={board.e2eeEnabled}
					e2eeKey={e2eeKey}
					e2eeStateRef={e2eeStateRef}
					forceReadonly={!canWrite}
					kanbanAssignmentOptions={kanbanAssignmentOptions}
					presencePanelOffsetTop={68}
					presenterMode={presenterMode}
					presenterShareUrl={shareUrl}
					presenterIsLive={presenterIsLive}
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
