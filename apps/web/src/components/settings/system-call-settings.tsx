import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Check, Loader2, PhoneCall } from "lucide-react";
import { useEffect, useState } from "react";

export function SystemCallSettings() {
	const { t } = useI18n();
	const utils = trpc.useUtils();

	const { data: status, isLoading } = trpc.instance.getCallStatus.useQuery();

	const [useCustomCalls, setUseCustomCalls] = useState(false);
	const [callsEnabled, setCallsEnabled] = useState(false);
	const [provider, setProvider] = useState<"none" | "livekit">("livekit");
	const [livekitUrl, setLivekitUrl] = useState("");
	const [livekitApiKey, setLivekitApiKey] = useState("");
	const [livekitApiSecret, setLivekitApiSecret] = useState("");
	const [clearApiSecret, setClearApiSecret] = useState(false);
	const [tokenTtlSeconds, setTokenTtlSeconds] = useState("3600");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		if (!status) return;
		setUseCustomCalls(status.useCustomCalls);
		setCallsEnabled(status.callsEnabled);
		setProvider(status.callProvider === "livekit" ? "livekit" : "none");
		setLivekitUrl(status.livekitUrl ?? "");
		setLivekitApiKey(status.livekitApiKey ?? "");
		setTokenTtlSeconds(String(status.tokenTtlSeconds ?? 3600));
	}, [status]);

	const updateCalls = trpc.instance.updateCalls.useMutation({
		onSuccess: () => {
			setMessage(t("systemSettings.messages.callsSaved"));
			setError("");
			setLivekitApiSecret("");
			setClearApiSecret(false);
			void utils.instance.getCallStatus.invalidate();
			void utils.calls.getConfig.invalidate();
		},
		onError: (err) => {
			setError(err.message || t("systemSettings.messages.callsSaveFailed"));
			setMessage("");
		},
	});

	if (isLoading) {
		return (
			<div className="flex justify-center py-12">
				<Loader2 className="h-6 w-6 animate-spin text-primary" />
			</div>
		);
	}

	const sourceLabel =
		status?.source === "database"
			? t("systemSettings.callsCard.sources.database")
			: status?.source === "env"
				? t("systemSettings.callsCard.sources.env")
				: t("systemSettings.callsCard.sources.none");

	const effectiveUrl =
		status?.source === "env" ? status.envServerUrl : status?.livekitUrl;

	return (
		<div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
			<div>
				<div className="flex items-center gap-3">
					<div className="rounded-xl bg-primary/10 p-2 text-primary">
						<PhoneCall className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-base font-semibold text-foreground">
							{t("systemSettings.callsCard.title")}
						</h3>
						<p className="mt-0.5 text-sm text-muted-foreground">
							{t("systemSettings.callsCard.description")}
						</p>
					</div>
				</div>
			</div>

			<div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm">
				<p className="font-medium text-foreground">
					{t("systemSettings.callsCard.statusTitle")}
				</p>
				<p className="mt-1 text-muted-foreground">
					{t("systemSettings.callsCard.activeSource")}:{" "}
					<strong>{sourceLabel}</strong>
					{effectiveUrl ? ` - ${effectiveUrl}` : ""}
				</p>
			</div>

			<label className="flex items-start gap-3 text-sm">
				<input
					type="checkbox"
					checked={useCustomCalls}
					onChange={(event) => setUseCustomCalls(event.target.checked)}
					className="mt-1"
				/>
				<span>
					<span className="font-medium text-foreground">
						{t("systemSettings.callsCard.useCustomConfig")}
					</span>
					<span className="mt-0.5 block text-muted-foreground">
						{t("systemSettings.callsCard.useCustomConfigHint")}
					</span>
				</span>
			</label>

			{useCustomCalls ? (
				<div className="grid gap-4 sm:grid-cols-2">
					<label className="flex items-center gap-2 text-sm sm:col-span-2">
						<input
							type="checkbox"
							checked={callsEnabled}
							onChange={(event) => setCallsEnabled(event.target.checked)}
						/>
						{t("systemSettings.callsCard.enable")}
					</label>

					<div className="space-y-1.5">
						<label
							htmlFor="system-calls-provider"
							className="text-xs font-medium text-muted-foreground"
						>
							{t("systemSettings.callsCard.provider")}
						</label>
						<select
							id="system-calls-provider"
							className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
							value={provider}
							onChange={(event) =>
								setProvider(event.target.value as "none" | "livekit")
							}
						>
							<option value="livekit">LiveKit</option>
							<option value="none">{t("common.none")}</option>
						</select>
					</div>

					<div className="space-y-1.5">
						<label
							htmlFor="system-calls-token-ttl"
							className="text-xs font-medium text-muted-foreground"
						>
							{t("systemSettings.callsCard.tokenTtl")}
						</label>
						<Input
							id="system-calls-token-ttl"
							value={tokenTtlSeconds}
							onChange={(event) => setTokenTtlSeconds(event.target.value)}
						/>
					</div>

					{provider === "livekit" ? (
						<>
							<div className="space-y-1.5 sm:col-span-2">
								<label
									htmlFor="system-calls-livekit-url"
									className="text-xs font-medium text-muted-foreground"
								>
									{t("systemSettings.callsCard.livekitUrl")}
								</label>
								<Input
									id="system-calls-livekit-url"
									value={livekitUrl}
									onChange={(event) => setLivekitUrl(event.target.value)}
									placeholder="wss://livekit.example.com"
								/>
							</div>
							<div className="space-y-1.5 sm:col-span-2">
								<label
									htmlFor="system-calls-livekit-api-key"
									className="text-xs font-medium text-muted-foreground"
								>
									{t("systemSettings.callsCard.apiKey")}
								</label>
								<Input
									id="system-calls-livekit-api-key"
									value={livekitApiKey}
									onChange={(event) => setLivekitApiKey(event.target.value)}
									placeholder="APIxxxxxxxx"
								/>
							</div>
							<div className="space-y-1.5 sm:col-span-2">
								<label
									htmlFor="system-calls-livekit-api-secret"
									className="text-xs font-medium text-muted-foreground"
								>
									{t("systemSettings.callsCard.apiSecret")}
								</label>
								<Input
									id="system-calls-livekit-api-secret"
									type="password"
									value={livekitApiSecret}
									onChange={(event) => setLivekitApiSecret(event.target.value)}
									placeholder={t(
										"systemSettings.callsCard.apiSecretPlaceholder",
									)}
								/>
								<p className="text-xs text-muted-foreground">
									{status?.hasStoredApiSecret
										? t("systemSettings.callsCard.apiSecretConfigured")
										: t("systemSettings.callsCard.apiSecretNotConfigured")}
								</p>
								{status?.hasStoredApiSecret ? (
									<label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
										<input
											type="checkbox"
											checked={clearApiSecret}
											onChange={(event) =>
												setClearApiSecret(event.target.checked)
											}
										/>
										{t("systemSettings.callsCard.clearApiSecret")}
									</label>
								) : null}
							</div>
						</>
					) : null}
				</div>
			) : null}

			{message ? (
				<p className="text-sm text-emerald-600 dark:text-emerald-400">
					{message}
				</p>
			) : null}
			{error ? <p className="text-sm text-destructive">{error}</p> : null}

			<div className="flex flex-wrap gap-2">
				<Button
					disabled={updateCalls.isPending}
					onClick={() =>
						updateCalls.mutate({
							useCustomCalls,
							callsEnabled,
							provider,
							livekitUrl: livekitUrl || undefined,
							livekitApiKey: livekitApiKey || undefined,
							livekitApiSecret: livekitApiSecret || undefined,
							clearApiSecret,
							tokenTtlSeconds: Number(tokenTtlSeconds) || 3600,
						})
					}
				>
					{updateCalls.isPending ? (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<Check className="mr-2 h-4 w-4" />
					)}
					{t("common.save")}
				</Button>
			</div>
		</div>
	);
}
