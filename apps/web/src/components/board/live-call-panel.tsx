import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { Loader2, RefreshCcw } from "lucide-react";
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
				className="h-[min(70vh,640px)] overflow-hidden rounded-lg border border-border bg-black"
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
				<VideoConference />
			</LiveKitRoom>
			<p className="text-xs text-muted-foreground">
				{t("canvas.call.livekitHint", { boardName })}
			</p>
		</div>
	);
}
