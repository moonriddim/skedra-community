import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import {
	DisconnectButton,
	LiveKitRoom,
	RoomAudioRenderer,
	StartAudio,
	TrackToggle,
	useLocalParticipant,
	useParticipants,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
	Loader2,
	Mic,
	MicOff,
	PhoneOff,
	RefreshCcw,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";

type LiveKitCredentials = {
	serverUrl: string;
	token: string;
	roomName: string;
};

type LiveCallPanelProps = {
	boardId: string;
	boardName: string;
	open: boolean;
};

function VoiceHangout() {
	const { t } = useI18n();
	const participants = useParticipants();
	const { isMicrophoneEnabled } = useLocalParticipant();

	return (
		<div className="flex h-full min-h-[360px] flex-col bg-card text-card-foreground">
			<RoomAudioRenderer />
			<div className="flex flex-1 flex-col justify-between gap-6 p-5 sm:p-6">
				<div className="space-y-4">
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								{t("canvas.call.participants")}
							</p>
							<h3 className="text-lg font-semibold text-foreground">
								{t("canvas.call.title")}
							</h3>
						</div>
						<div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-sm text-muted-foreground">
							<Users className="h-4 w-4" />
							{participants.length}
						</div>
					</div>

					<div className="grid gap-2 sm:grid-cols-2">
						{participants.map((participant) => {
							const displayName =
								participant.name || participant.identity || t("common.user");
							const initial = displayName.trim().slice(0, 1).toUpperCase();

							return (
								<div
									key={participant.identity}
									className="flex min-w-0 items-center gap-3 rounded-lg border border-border/80 bg-background/80 p-3"
								>
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
										{initial}
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium text-foreground">
											{displayName}
										</p>
										<p className="text-xs text-muted-foreground">
											{participant.isLocal
												? t("canvas.call.you")
												: t("canvas.call.guest")}
										</p>
									</div>
									<span
										className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground"
										title={
											participant.isMicrophoneEnabled
												? t("canvas.call.micOn")
												: t("canvas.call.micOff")
										}
									>
										{participant.isMicrophoneEnabled ? (
											<Mic className="h-4 w-4" />
										) : (
											<MicOff className="h-4 w-4" />
										)}
									</span>
								</div>
							);
						})}
					</div>
				</div>

				<div className="space-y-3 border-t border-border pt-4">
					<StartAudio
						className="h-9 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-accent"
						label={t("canvas.call.allowAudio")}
					/>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							asChild
							variant={isMicrophoneEnabled ? "default" : "outline"}
						>
							<TrackToggle
								aria-label={
									isMicrophoneEnabled
										? t("canvas.call.mute")
										: t("canvas.call.unmute")
								}
								showIcon={false}
								source={Track.Source.Microphone}
							>
								{isMicrophoneEnabled ? (
									<Mic className="h-4 w-4" />
								) : (
									<MicOff className="h-4 w-4" />
								)}
								{isMicrophoneEnabled
									? t("canvas.call.mute")
									: t("canvas.call.unmute")}
							</TrackToggle>
						</Button>
						<Button asChild variant="destructive">
							<DisconnectButton>
								<PhoneOff className="h-4 w-4" />
								{t("canvas.call.leaveAction")}
							</DisconnectButton>
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

export function LiveCallPanel({
	boardId,
	boardName,
	open,
}: LiveCallPanelProps) {
	const { t } = useI18n();
	const [credentials, setCredentials] = useState<LiveKitCredentials | null>(
		null,
	);
	const [wasDisconnected, setWasDisconnected] = useState(false);

	const { data: config, isLoading: configLoading } =
		trpc.calls.getConfig.useQuery(undefined, { enabled: open });
	const {
		error: issueTokenError,
		isPending: tokenPending,
		mutate: issueToken,
		reset: resetIssueToken,
	} = trpc.calls.issueToken.useMutation({
		onSuccess: (nextCredentials) => {
			setCredentials(nextCredentials);
			setWasDisconnected(false);
		},
	});

	useEffect(() => {
		if (!open) {
			setCredentials(null);
			setWasDisconnected(false);
			resetIssueToken();
			return;
		}
		if (
			credentials ||
			wasDisconnected ||
			configLoading ||
			!config?.enabled ||
			tokenPending
		) {
			return;
		}
		issueToken({ whiteboardId: boardId });
	}, [
		boardId,
		config?.enabled,
		configLoading,
		credentials,
		issueToken,
		open,
		resetIssueToken,
		tokenPending,
		wasDisconnected,
	]);

	const reconnect = () => {
		setCredentials(null);
		setWasDisconnected(false);
		resetIssueToken();
		issueToken({ whiteboardId: boardId });
	};

	if (configLoading || tokenPending) {
		return (
			<div className="flex min-h-[420px] items-center justify-center rounded-lg border border-border bg-muted/30">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" />
					{t("canvas.call.connecting")}
				</div>
			</div>
		);
	}

	if (!config?.enabled) {
		return (
			<div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
				{t("canvas.call.unavailable")}
			</div>
		);
	}

	if (issueTokenError) {
		return (
			<div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
				<p>{issueTokenError.message || t("canvas.call.error")}</p>
				<Button variant="outline" size="sm" onClick={reconnect}>
					<RefreshCcw className="mr-2 h-4 w-4" />
					{t("canvas.call.retry")}
				</Button>
			</div>
		);
	}

	if (wasDisconnected) {
		return (
			<div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
				<p className="text-muted-foreground">{t("canvas.call.left")}</p>
				<Button variant="outline" size="sm" onClick={reconnect}>
					<RefreshCcw className="mr-2 h-4 w-4" />
					{t("canvas.call.rejoin")}
				</Button>
			</div>
		);
	}

	if (!credentials) {
		return null;
	}

	return (
		<div className="space-y-3">
			<LiveKitRoom
				audio={false}
				className="h-[min(70vh,640px)] overflow-hidden rounded-lg border border-border bg-card"
				connect={open}
				data-lk-theme="default"
				onDisconnected={() => {
					setCredentials(null);
					setWasDisconnected(true);
				}}
				serverUrl={credentials.serverUrl}
				token={credentials.token}
				video={false}
			>
				<VoiceHangout />
			</LiveKitRoom>
			<p className="text-xs text-muted-foreground">
				{t("canvas.call.livekitHint", { boardName })}
			</p>
		</div>
	);
}
