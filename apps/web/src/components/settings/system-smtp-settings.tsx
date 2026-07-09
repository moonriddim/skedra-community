/**
 * SMTP / Instanz-Einstellungen für Self-Hosting.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Check, Loader2, Mail, Server } from "lucide-react";
import { useEffect, useState } from "react";

export function SystemSmtpSettings() {
	const { t } = useI18n();
	const utils = trpc.useUtils();

	const { data: status, isLoading } = trpc.instance.getMailStatus.useQuery();

	const [useCustomSmtp, setUseCustomSmtp] = useState(false);
	const [host, setHost] = useState("");
	const [port, setPort] = useState("587");
	const [user, setUser] = useState("");
	const [from, setFrom] = useState("");
	const [password, setPassword] = useState("");
	const [clearPassword, setClearPassword] = useState(false);
	const [secure, setSecure] = useState(false);
	const [resetFallback, setResetFallback] = useState<"log" | "link">("log");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		if (!status) return;
		setUseCustomSmtp(status.useCustomSmtp);
		setHost(status.smtpHost ?? "");
		setPort(String(status.smtpPort ?? 587));
		setUser(status.smtpUser ?? "");
		setFrom(status.smtpFrom ?? "");
		setSecure(status.smtpSecure);
		setResetFallback(status.resetFallback === "link" ? "link" : "log");
	}, [status]);

	const updateSmtp = trpc.instance.updateSmtp.useMutation({
		onSuccess: () => {
			setMessage(t("systemSettings.messages.saved"));
			setError("");
			setPassword("");
			setClearPassword(false);
			void utils.instance.getMailStatus.invalidate();
		},
		onError: (err) => {
			setError(err.message || t("systemSettings.messages.saveFailed"));
			setMessage("");
		},
	});

	const sendTest = trpc.instance.sendTestEmail.useMutation({
		onSuccess: (result) => {
			setMessage(
				t("systemSettings.messages.testSent", { email: result.email }),
			);
			setError("");
		},
		onError: (err) => {
			setError(err.message || t("systemSettings.messages.testFailed"));
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
			? t("systemSettings.smtpCard.sources.database")
			: status?.source === "env"
				? t("systemSettings.smtpCard.sources.env")
				: t("systemSettings.smtpCard.sources.none");

	return (
		<div className="space-y-6 animate-in fade-in-50 duration-200">
			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
				<div className="flex items-center gap-3">
					<div className="rounded-xl bg-primary/10 p-2 text-primary">
						<Server className="h-5 w-5" />
					</div>
					<div>
						<h2 className="text-lg font-semibold text-foreground">
							{t("systemSettings.title")}
						</h2>
						<p className="text-sm text-muted-foreground">
							{t("systemSettings.description")}
						</p>
					</div>
				</div>
			</div>

			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
				<div>
					<h3 className="text-base font-semibold text-foreground">
						{t("systemSettings.smtpCard.title")}
					</h3>
					<p className="mt-0.5 text-sm text-muted-foreground">
						{t("systemSettings.smtpCard.description")}
					</p>
				</div>

				<div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm">
					<p className="font-medium text-foreground">
						{t("systemSettings.smtpCard.statusTitle")}
					</p>
					<p className="mt-1 text-muted-foreground">
						{t("systemSettings.smtpCard.activeSource")}:{" "}
						<strong>{sourceLabel}</strong>
						{status?.from ? ` · ${status.from}` : ""}
					</p>
				</div>

				<label className="flex items-start gap-3 text-sm">
					<input
						type="checkbox"
						checked={useCustomSmtp}
						onChange={(event) => setUseCustomSmtp(event.target.checked)}
						className="mt-1"
					/>
					<span>
						<span className="font-medium text-foreground">
							{t("systemSettings.smtpCard.useCustomConfig")}
						</span>
						<span className="mt-0.5 block text-muted-foreground">
							{t("systemSettings.smtpCard.useCustomConfigHint")}
						</span>
					</span>
				</label>

				{useCustomSmtp ? (
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5 sm:col-span-2">
							<label
								htmlFor="system-smtp-host"
								className="text-xs font-medium text-muted-foreground"
							>
								{t("systemSettings.smtpCard.host")}
							</label>
							<Input
								id="system-smtp-host"
								value={host}
								onChange={(event) => setHost(event.target.value)}
								placeholder="smtp.example.com"
							/>
						</div>
						<div className="space-y-1.5">
							<label
								htmlFor="system-smtp-port"
								className="text-xs font-medium text-muted-foreground"
							>
								{t("systemSettings.smtpCard.port")}
							</label>
							<Input
								id="system-smtp-port"
								value={port}
								onChange={(event) => setPort(event.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<label
								htmlFor="system-smtp-user"
								className="text-xs font-medium text-muted-foreground"
							>
								{t("systemSettings.smtpCard.user")}
							</label>
							<Input
								id="system-smtp-user"
								value={user}
								onChange={(event) => setUser(event.target.value)}
							/>
						</div>
						<div className="space-y-1.5 sm:col-span-2">
							<label
								htmlFor="system-smtp-from"
								className="text-xs font-medium text-muted-foreground"
							>
								{t("systemSettings.smtpCard.from")}
							</label>
							<Input
								id="system-smtp-from"
								type="email"
								value={from}
								onChange={(event) => setFrom(event.target.value)}
								placeholder="Skedra <noreply@example.com>"
							/>
						</div>
						<div className="space-y-1.5 sm:col-span-2">
							<label
								htmlFor="system-smtp-password"
								className="text-xs font-medium text-muted-foreground"
							>
								{t("systemSettings.smtpCard.password")}
							</label>
							<Input
								id="system-smtp-password"
								type="password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								placeholder={t("systemSettings.smtpCard.passwordPlaceholder")}
							/>
							<p className="text-xs text-muted-foreground">
								{status?.hasStoredPassword
									? t("systemSettings.smtpCard.passwordConfigured")
									: t("systemSettings.smtpCard.passwordNotConfigured")}
							</p>
							{status?.hasStoredPassword ? (
								<label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
									<input
										type="checkbox"
										checked={clearPassword}
										onChange={(event) => setClearPassword(event.target.checked)}
									/>
									{t("systemSettings.smtpCard.clearPassword")}
								</label>
							) : null}
						</div>
						<label className="flex items-center gap-2 text-sm sm:col-span-2">
							<input
								type="checkbox"
								checked={secure}
								onChange={(event) => setSecure(event.target.checked)}
							/>
							{t("systemSettings.smtpCard.secure")}
						</label>
					</div>
				) : null}

				<div className="space-y-2 border-t border-border pt-4">
					<p className="text-sm font-medium text-foreground">
						{t("systemSettings.accessCard.resetFallback")}
					</p>
					<div className="flex flex-wrap gap-2">
						{(["log", "link"] as const).map((mode) => (
							<button
								key={mode}
								type="button"
								onClick={() => setResetFallback(mode)}
								className={cn(
									"rounded-lg border px-3 py-1.5 text-sm transition-colors",
									resetFallback === mode
										? "border-primary bg-primary/10 text-primary"
										: "border-border text-muted-foreground hover:bg-muted/40",
								)}
							>
								{t(`systemSettings.accessCard.fallbacks.${mode}`)}
							</button>
						))}
					</div>
					<p className="text-xs text-muted-foreground">
						{t("systemSettings.accessCard.hint")}
					</p>
				</div>

				{message ? (
					<p className="text-sm text-emerald-600 dark:text-emerald-400">
						{message}
					</p>
				) : null}
				{error ? <p className="text-sm text-destructive">{error}</p> : null}

				<div className="flex flex-wrap gap-2">
					<Button
						disabled={updateSmtp.isPending}
						onClick={() =>
							updateSmtp.mutate({
								useCustomSmtp,
								host: host || undefined,
								port: Number(port) || 587,
								user: user || undefined,
								from: from || undefined,
								password: password || undefined,
								clearPassword,
								secure,
								resetFallback,
							})
						}
					>
						{updateSmtp.isPending ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Check className="mr-2 h-4 w-4" />
						)}
						{t("common.save")}
					</Button>
					<Button
						variant="outline"
						disabled={sendTest.isPending || !status?.configured}
						onClick={() => sendTest.mutate()}
					>
						{sendTest.isPending ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Mail className="mr-2 h-4 w-4" />
						)}
						{t("systemSettings.smtpCard.sendTest")}
					</Button>
				</div>
				<p className="text-xs text-muted-foreground">
					{t("systemSettings.smtpCard.statusHint")}
				</p>
			</div>
		</div>
	);
}
