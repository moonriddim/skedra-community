import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { requestPasswordReset } from "@/lib/auth-password";
import { reencryptUserE2eeIdentity } from "@/lib/e2ee";
import { deletePendingE2eeUpdateDatabase } from "@/lib/e2ee-update-queue";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import {
	Copy,
	ExternalLink,
	Github,
	KeyRound,
	Link2,
	Loader2,
	Mail,
	ShieldCheck,
	Trash2,
	Unlink,
} from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";

interface ProfileAccountSecurityProps {
	email: string;
}

interface LinkedAccount {
	id: string;
	providerId: string;
	accountId: string;
}

interface TwoFactorSetup {
	totpURI: string;
	backupCodes: string[];
}

type SocialProvider = "google" | "github";

async function clearSkedraBrowserData() {
	for (const storage of [localStorage, sessionStorage]) {
		const keys: string[] = [];
		for (let index = 0; index < storage.length; index += 1) {
			const key = storage.key(index);
			if (key?.startsWith("skedra")) keys.push(key);
		}
		for (const key of keys) storage.removeItem(key);
	}

	await deletePendingE2eeUpdateDatabase();
}

function providerName(provider: SocialProvider) {
	return provider === "google" ? "Google" : "GitHub";
}

function getAuthenticatorSecret(setup: TwoFactorSetup | null) {
	if (!setup) return "";
	try {
		return new URL(setup.totpURI).searchParams.get("secret") ?? "";
	} catch {
		return "";
	}
}

export function ProfileAccountSecurity({ email }: ProfileAccountSecurityProps) {
	const { t } = useI18n();
	const utils = trpc.useUtils();
	const { data: session } = authClient.useSession();
	const { data: publicConfig } = trpc.billing.getPublicConfig.useQuery();
	const { data: prefs } = trpc.userPreferences.get.useQuery();
	const identityQuery = trpc.userE2ee.getIdentity.useQuery(undefined, {
		retry: false,
	});

	const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
	const [accountsLoading, setAccountsLoading] = useState(true);
	const [accountAction, setAccountAction] = useState<string | null>(null);
	const [accountMessage, setAccountMessage] = useState("");
	const [accountError, setAccountError] = useState("");

	const [newEmail, setNewEmail] = useState(email);
	const [emailLoading, setEmailLoading] = useState(false);
	const [emailMessage, setEmailMessage] = useState("");
	const [emailError, setEmailError] = useState("");

	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordMessage, setPasswordMessage] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [resetLoading, setResetLoading] = useState(false);
	const [resetMessage, setResetMessage] = useState("");
	const [resetError, setResetError] = useState("");
	const [localResetUrl, setLocalResetUrl] = useState<string | null>(null);

	const [twoFactorPassword, setTwoFactorPassword] = useState("");
	const [twoFactorCode, setTwoFactorCode] = useState("");
	const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(
		null,
	);
	const [twoFactorQrCode, setTwoFactorQrCode] = useState("");
	const [twoFactorLoading, setTwoFactorLoading] = useState(false);
	const [twoFactorMessage, setTwoFactorMessage] = useState("");
	const [twoFactorError, setTwoFactorError] = useState("");

	const [emailOnMention, setEmailOnMention] = useState(true);
	const [emailOnCommentReply, setEmailOnCommentReply] = useState(true);
	const [notifMessage, setNotifMessage] = useState("");

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deleteConfirmation, setDeleteConfirmation] = useState("");
	const [deletePassword, setDeletePassword] = useState("");
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [deleteError, setDeleteError] = useState("");

	const hasCredential = accounts.some(
		(account) => account.providerId === "credential",
	);
	const twoFactorEnabled = Boolean(session?.user.twoFactorEnabled);
	const authenticatorSecret = getAuthenticatorSecret(twoFactorSetup);

	const loadAccounts = useCallback(async () => {
		setAccountsLoading(true);
		setAccountError("");
		try {
			const result = await authClient.listAccounts();
			if (result.error) {
				setAccountError(
					result.error.message ?? t("profileSettings.accessCard.loadFailed"),
				);
				return;
			}
			setAccounts(result.data ?? []);
		} catch {
			setAccountError(t("profileSettings.accessCard.loadFailed"));
		} finally {
			setAccountsLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void loadAccounts();
	}, [loadAccounts]);

	useEffect(() => {
		setNewEmail(email);
	}, [email]);

	useEffect(() => {
		if (!prefs) return;
		setEmailOnMention(prefs.emailOnMention);
		setEmailOnCommentReply(prefs.emailOnCommentReply);
	}, [prefs]);

	useEffect(() => {
		if (!twoFactorSetup) {
			setTwoFactorQrCode("");
			return;
		}
		let cancelled = false;
		void QRCode.toDataURL(twoFactorSetup.totpURI, {
			width: 220,
			margin: 1,
			errorCorrectionLevel: "M",
		}).then((dataUrl) => {
			if (!cancelled) setTwoFactorQrCode(dataUrl);
		});
		return () => {
			cancelled = true;
		};
	}, [twoFactorSetup]);

	const changePassword = trpc.account.changePassword.useMutation();
	const setPassword = trpc.account.setPassword.useMutation();
	const updatePrefs = trpc.userPreferences.update.useMutation({
		onSuccess: () => {
			setNotifMessage(t("profileSettings.messages.notificationsSaved"));
			void utils.userPreferences.get.invalidate();
		},
	});

	const handleEmailChange = async (event: React.FormEvent) => {
		event.preventDefault();
		setEmailLoading(true);
		setEmailMessage("");
		setEmailError("");
		try {
			const result = await authClient.changeEmail({
				newEmail: newEmail.trim(),
				callbackURL: `${window.location.origin}/settings?tab=profile`,
			});
			if (result.error) {
				setEmailError(
					result.error.message ??
						t("profileSettings.messages.emailChangeFailed"),
				);
				return;
			}
			setEmailMessage(t("profileSettings.messages.emailChangeRequested"));
		} catch {
			setEmailError(t("profileSettings.messages.emailChangeFailed"));
		} finally {
			setEmailLoading(false);
		}
	};

	const handlePasswordSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setPasswordMessage("");
		setPasswordError("");

		if (newPassword.length < 8) {
			setPasswordError(t("profileSettings.messages.newPasswordTooShort"));
			return;
		}
		if (newPassword !== confirmPassword) {
			setPasswordError(t("profileSettings.messages.passwordMismatch"));
			return;
		}

		try {
			if (hasCredential) {
				const newEncryptedPrivateKey = identityQuery.data
					? await reencryptUserE2eeIdentity(
							currentPassword,
							newPassword,
							identityQuery.data,
						)
					: undefined;
				await changePassword.mutateAsync({
					currentPassword,
					newPassword,
					newEncryptedPrivateKey,
					revokeOtherSessions: true,
				});
				setPasswordMessage(t("profileSettings.messages.passwordUpdated"));
			} else {
				await setPassword.mutateAsync({ newPassword });
				setPasswordMessage(t("profileSettings.messages.passwordSet"));
				await loadAccounts();
			}
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
		} catch (error) {
			setPasswordError(
				error instanceof Error
					? error.message
					: t("profileSettings.messages.passwordUpdateFailed"),
			);
		}
	};

	const handlePasswordReset = async () => {
		setResetLoading(true);
		setResetError("");
		setResetMessage("");
		setLocalResetUrl(null);

		try {
			const result = await requestPasswordReset(email);
			if (result.error) {
				setResetError(
					result.error.message ??
						t("profileSettings.messages.passwordResetFailed"),
				);
				return;
			}
			setResetMessage(t("profileSettings.messages.passwordResetSent"));
			// Only instance admins may retrieve a local fallback link. A failed
			// lookup must not turn a successfully sent reset mail into an error.
			try {
				const link = await utils.instance.peekPasswordResetLink.fetch({
					email,
				});
				if (link.url) setLocalResetUrl(link.url);
			} catch {
				// Normal users intentionally cannot inspect reset tokens.
			}
		} catch {
			setResetError(t("profileSettings.messages.passwordResetFailed"));
		} finally {
			setResetLoading(false);
		}
	};

	const handleLinkProvider = async (provider: SocialProvider) => {
		setAccountAction(provider);
		setAccountMessage("");
		setAccountError("");
		try {
			const result = await authClient.linkSocial({
				provider,
				callbackURL: `${window.location.origin}/settings?tab=profile`,
				errorCallbackURL: `${window.location.origin}/settings?tab=profile&oauthError=1`,
			});
			if (result.error) {
				setAccountError(
					result.error.message ?? t("profileSettings.accessCard.linkFailed"),
				);
			}
		} catch {
			setAccountError(t("profileSettings.accessCard.linkFailed"));
		} finally {
			setAccountAction(null);
		}
	};

	const handleUnlinkProvider = async (provider: SocialProvider) => {
		setAccountAction(provider);
		setAccountMessage("");
		setAccountError("");
		try {
			const result = await authClient.unlinkAccount({ providerId: provider });
			if (result.error) {
				setAccountError(
					result.error.message ?? t("profileSettings.accessCard.unlinkFailed"),
				);
				return;
			}
			setAccountMessage(
				t("profileSettings.messages.providerUnlinked", {
					provider: providerName(provider),
				}),
			);
			await loadAccounts();
		} catch {
			setAccountError(t("profileSettings.accessCard.unlinkFailed"));
		} finally {
			setAccountAction(null);
		}
	};

	const handleEnableTwoFactor = async () => {
		if (!hasCredential) {
			setTwoFactorError(t("profileSettings.securityCard.passwordRequired"));
			return;
		}
		setTwoFactorLoading(true);
		setTwoFactorMessage("");
		setTwoFactorError("");
		try {
			const result = await authClient.twoFactor.enable({
				password: twoFactorPassword,
			});
			if (result.error || !result.data) {
				setTwoFactorError(
					result.error?.message ??
						t("profileSettings.securityCard.enableFailed"),
				);
				return;
			}
			setTwoFactorSetup(result.data);
			setTwoFactorMessage(t("profileSettings.messages.twoFactorSetupReady"));
		} catch {
			setTwoFactorError(t("profileSettings.securityCard.enableFailed"));
		} finally {
			setTwoFactorLoading(false);
		}
	};

	const handleVerifyTwoFactor = async () => {
		setTwoFactorLoading(true);
		setTwoFactorError("");
		try {
			const result = await authClient.twoFactor.verifyTotp({
				code: twoFactorCode.replace(/\s/gu, ""),
			});
			if (result.error) {
				setTwoFactorError(
					result.error.message ??
						t("profileSettings.securityCard.verifyFailed"),
				);
				return;
			}
			setTwoFactorSetup(null);
			setTwoFactorCode("");
			setTwoFactorPassword("");
			setTwoFactorMessage(t("profileSettings.messages.twoFactorEnabled"));
		} catch {
			setTwoFactorError(t("profileSettings.securityCard.verifyFailed"));
		} finally {
			setTwoFactorLoading(false);
		}
	};

	const handleDisableTwoFactor = async () => {
		if (!hasCredential) {
			setTwoFactorError(t("profileSettings.securityCard.passwordRequired"));
			return;
		}
		setTwoFactorLoading(true);
		setTwoFactorMessage("");
		setTwoFactorError("");
		try {
			const result = await authClient.twoFactor.disable({
				password: twoFactorPassword,
			});
			if (result.error) {
				setTwoFactorError(
					result.error.message ??
						t("profileSettings.securityCard.disableFailed"),
				);
				return;
			}
			setTwoFactorPassword("");
			setTwoFactorMessage(t("profileSettings.messages.twoFactorDisabled"));
		} catch {
			setTwoFactorError(t("profileSettings.securityCard.disableFailed"));
		} finally {
			setTwoFactorLoading(false);
		}
	};

	const handleDeleteAccount = async () => {
		setDeleteLoading(true);
		setDeleteError("");
		try {
			const result = await authClient.deleteUser({
				password: hasCredential ? deletePassword : undefined,
			});
			if (result.error || !result.data?.success) {
				setDeleteError(
					result.error?.message ?? t("profileSettings.dangerZone.deleteFailed"),
				);
				return;
			}
			await clearSkedraBrowserData().catch((error) => {
				console.warn(
					"Local Skedra data could not be cleared completely",
					error,
				);
			});
			window.location.assign("/?accountDeleted=1");
		} catch {
			setDeleteError(t("profileSettings.dangerZone.deleteFailed"));
		} finally {
			setDeleteLoading(false);
		}
	};

	const visibleProviders = (["google", "github"] as const).filter(
		(provider) =>
			publicConfig?.socialProviders[provider] ||
			accounts.some((account) => account.providerId === provider),
	);

	return (
		<>
			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
				<div className="flex items-start gap-3">
					<div className="rounded-xl bg-primary/10 p-2 text-primary">
						<Mail className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-base font-semibold text-foreground">
							{t("profileSettings.emailCard.title")}
						</h3>
						<p className="mt-0.5 text-sm text-muted-foreground">
							{t("profileSettings.emailCard.description")}
						</p>
					</div>
				</div>
				<form className="mt-5 space-y-4" onSubmit={handleEmailChange}>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="current-account-email">
								{t("profileSettings.emailCard.currentEmail")}
							</Label>
							<Input id="current-account-email" value={email} readOnly />
						</div>
						<div className="space-y-2">
							<Label htmlFor="new-account-email">
								{t("profileSettings.emailCard.newEmail")}
							</Label>
							<Input
								id="new-account-email"
								type="email"
								value={newEmail}
								onChange={(event) => setNewEmail(event.target.value)}
								required
							/>
						</div>
					</div>
					<p className="text-xs text-muted-foreground">
						{t("profileSettings.emailCard.verificationNote")}
					</p>
					{emailMessage ? (
						<p className="text-sm text-emerald-600 dark:text-emerald-400">
							{emailMessage}
						</p>
					) : null}
					{emailError ? (
						<p className="text-sm text-destructive">{emailError}</p>
					) : null}
					<Button
						type="submit"
						disabled={
							emailLoading ||
							newEmail.trim().toLowerCase() === email.toLowerCase()
						}
					>
						{emailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
						{t("profileSettings.emailCard.save")}
					</Button>
				</form>
			</div>

			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
				<div className="flex items-start gap-3">
					<div className="rounded-xl bg-primary/10 p-2 text-primary">
						<KeyRound className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-base font-semibold text-foreground">
							{t("profileSettings.passwordCard.title")}
						</h3>
						<p className="mt-0.5 text-sm text-muted-foreground">
							{hasCredential
								? t("profileSettings.passwordCard.description")
								: t("profileSettings.passwordCard.noPasswordDescription")}
						</p>
					</div>
				</div>
				<form className="mt-5 space-y-4" onSubmit={handlePasswordSubmit}>
					<div className="grid gap-4 sm:grid-cols-3">
						{hasCredential ? (
							<div className="space-y-2">
								<Label htmlFor="current-password">
									{t("profileSettings.passwordCard.currentPassword")}
								</Label>
								<Input
									id="current-password"
									type="password"
									autoComplete="current-password"
									value={currentPassword}
									onChange={(event) => setCurrentPassword(event.target.value)}
									required
								/>
							</div>
						) : null}
						<div className="space-y-2">
							<Label htmlFor="new-password">
								{t("profileSettings.passwordCard.newPassword")}
							</Label>
							<Input
								id="new-password"
								type="password"
								autoComplete="new-password"
								minLength={8}
								value={newPassword}
								onChange={(event) => setNewPassword(event.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="confirm-password">
								{t("profileSettings.passwordCard.confirmPassword")}
							</Label>
							<Input
								id="confirm-password"
								type="password"
								autoComplete="new-password"
								minLength={8}
								value={confirmPassword}
								onChange={(event) => setConfirmPassword(event.target.value)}
								required
							/>
						</div>
					</div>
					{passwordMessage ? (
						<p className="text-sm text-emerald-600 dark:text-emerald-400">
							{passwordMessage}
						</p>
					) : null}
					{passwordError ? (
						<p className="text-sm text-destructive">{passwordError}</p>
					) : null}
					<div className="flex flex-wrap gap-2">
						<Button
							type="submit"
							disabled={changePassword.isPending || setPassword.isPending}
						>
							{changePassword.isPending || setPassword.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : null}
							{hasCredential
								? t("profileSettings.passwordCard.save")
								: t("profileSettings.passwordCard.setPassword")}
						</Button>
						{hasCredential ? (
							<Button
								type="button"
								variant="outline"
								disabled={resetLoading}
								onClick={handlePasswordReset}
							>
								{resetLoading ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : null}
								{t("profileSettings.passwordCard.sendResetLink")}
							</Button>
						) : null}
					</div>
					{resetMessage ? (
						<p className="text-sm text-emerald-600 dark:text-emerald-400">
							{resetMessage}
						</p>
					) : null}
					{resetError ? (
						<p className="text-sm text-destructive">{resetError}</p>
					) : null}
					{localResetUrl ? (
						<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
							<p>{t("profileSettings.messages.passwordResetLocalLinkReady")}</p>
							<Button asChild variant="link" className="h-auto px-0">
								<a href={localResetUrl}>
									<ExternalLink className="h-3.5 w-3.5" />
									{t("profileSettings.messages.openLocalResetLink")}
								</a>
							</Button>
						</div>
					) : null}
				</form>
			</div>

			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
				<div className="flex items-start gap-3">
					<div className="rounded-xl bg-primary/10 p-2 text-primary">
						<Link2 className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-base font-semibold text-foreground">
							{t("profileSettings.accessCard.title")}
						</h3>
						<p className="mt-0.5 text-sm text-muted-foreground">
							{t("profileSettings.accessCard.description")}
						</p>
					</div>
				</div>
				<div className="mt-5 divide-y divide-border rounded-xl border border-border">
					<div className="flex items-center justify-between gap-4 p-4">
						<div className="flex items-center gap-3">
							<Mail className="h-5 w-5 text-muted-foreground" />
							<div>
								<p className="text-sm font-medium">
									{t("profileSettings.accessCard.emailPassword")}
								</p>
								<p className="text-xs text-muted-foreground">{email}</p>
							</div>
						</div>
						<span className="text-xs font-medium text-muted-foreground">
							{hasCredential
								? t("profileSettings.accessCard.connected")
								: t("profileSettings.accessCard.notConnected")}
						</span>
					</div>
					{visibleProviders.map((provider) => {
						const connected = accounts.some(
							(account) => account.providerId === provider,
						);
						const isLastMethod = connected && accounts.length <= 1;
						return (
							<div
								key={provider}
								className="flex items-center justify-between gap-4 p-4"
							>
								<div className="flex items-center gap-3">
									{provider === "github" ? (
										<Github className="h-5 w-5 text-muted-foreground" />
									) : (
										<span className="flex h-5 w-5 items-center justify-center font-semibold text-muted-foreground">
											G
										</span>
									)}
									<div>
										<p className="text-sm font-medium">
											{providerName(provider)}
										</p>
										<p className="text-xs text-muted-foreground">
											{connected
												? t("profileSettings.accessCard.connected")
												: t("profileSettings.accessCard.notConnected")}
										</p>
									</div>
								</div>
								<Button
									variant="outline"
									size="sm"
									disabled={
										accountsLoading || accountAction !== null || isLastMethod
									}
									title={
										isLastMethod
											? t("profileSettings.accessCard.lastMethodHint")
											: undefined
									}
									onClick={() =>
										connected
											? void handleUnlinkProvider(provider)
											: void handleLinkProvider(provider)
									}
								>
									{accountAction === provider ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : connected ? (
										<Unlink className="h-4 w-4" />
									) : (
										<Link2 className="h-4 w-4" />
									)}
									{connected
										? t("profileSettings.accessCard.disconnect")
										: t("profileSettings.accessCard.connect")}
								</Button>
							</div>
						);
					})}
				</div>
				{accountMessage ? (
					<p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
						{accountMessage}
					</p>
				) : null}
				{accountError ? (
					<p className="mt-3 text-sm text-destructive">{accountError}</p>
				) : null}
			</div>

			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
				<div className="flex items-start gap-3">
					<div className="rounded-xl bg-primary/10 p-2 text-primary">
						<ShieldCheck className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-base font-semibold text-foreground">
							{t("profileSettings.securityCard.twoFactor")}
						</h3>
						<p className="mt-0.5 text-sm text-muted-foreground">
							{t("profileSettings.securityCard.twoFactorDescription")}
						</p>
					</div>
				</div>
				<div className="mt-5 rounded-xl border border-border p-4">
					<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
						<div>
							<p className="text-sm font-medium">
								{twoFactorEnabled
									? t("profileSettings.securityCard.twoFactorEnabled")
									: t("profileSettings.securityCard.twoFactorDisabled")}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{t("profileSettings.securityCard.authenticatorAndBackup")}
							</p>
						</div>
						{hasCredential ? (
							<Input
								type="password"
								autoComplete="current-password"
								className="sm:max-w-64"
								placeholder={t("profileSettings.securityCard.currentPassword")}
								value={twoFactorPassword}
								onChange={(event) => setTwoFactorPassword(event.target.value)}
							/>
						) : (
							<p className="text-xs text-muted-foreground sm:max-w-64">
								{t("profileSettings.securityCard.passwordRequired")}
							</p>
						)}
					</div>
					{!twoFactorSetup ? (
						<Button
							className="mt-4"
							variant={twoFactorEnabled ? "outline" : "default"}
							disabled={
								twoFactorLoading ||
								!hasCredential ||
								twoFactorPassword.length === 0
							}
							onClick={
								twoFactorEnabled
									? handleDisableTwoFactor
									: handleEnableTwoFactor
							}
						>
							{twoFactorLoading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : null}
							{twoFactorEnabled
								? t("profileSettings.securityCard.disable")
								: t("profileSettings.securityCard.enable")}
						</Button>
					) : (
						<div className="mt-5 space-y-5 border-t border-border pt-5">
							<div className="grid gap-5 md:grid-cols-[220px_1fr]">
								<div className="flex items-center justify-center rounded-xl bg-white p-3">
									{twoFactorQrCode ? (
										<img
											src={twoFactorQrCode}
											alt={t(
												"profileSettings.securityCard.authenticatorQrCode",
											)}
											className="h-[196px] w-[196px]"
										/>
									) : (
										<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
									)}
								</div>
								<div className="space-y-4">
									<p className="text-sm text-muted-foreground">
										{t("profileSettings.securityCard.authenticatorQrCodeHint")}
									</p>
									<div className="space-y-2">
										<Label>
											{t("profileSettings.securityCard.authenticatorSecret")}
										</Label>
										<div className="flex gap-2">
											<Input value={authenticatorSecret} readOnly />
											<Button
												type="button"
												variant="outline"
												size="icon"
												onClick={() =>
													void navigator.clipboard.writeText(
														authenticatorSecret,
													)
												}
											>
												<Copy className="h-4 w-4" />
												<span className="sr-only">
													{t("profileSettings.securityCard.copySecret")}
												</span>
											</Button>
										</div>
									</div>
								</div>
							</div>
							<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
								<div className="flex items-center justify-between gap-3">
									<h4 className="text-sm font-semibold">
										{t("profileSettings.securityCard.backupCodes")}
									</h4>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											void navigator.clipboard.writeText(
												twoFactorSetup.backupCodes.join("\n"),
											)
										}
									>
										<Copy className="h-4 w-4" />
										{t("profileSettings.securityCard.copyBackupCodes")}
									</Button>
								</div>
								<p className="mt-1 text-xs text-muted-foreground">
									{t("profileSettings.securityCard.backupCodesHint")}
								</p>
								<div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-3">
									{twoFactorSetup.backupCodes.map((code) => (
										<code
											key={code}
											className="rounded bg-background/80 px-2 py-1"
										>
											{code}
										</code>
									))}
								</div>
							</div>
							<div className="flex flex-col gap-2 sm:flex-row">
								<Input
									inputMode="numeric"
									autoComplete="one-time-code"
									placeholder={t(
										"profileSettings.securityCard.verificationCode",
									)}
									value={twoFactorCode}
									onChange={(event) => setTwoFactorCode(event.target.value)}
									maxLength={8}
								/>
								<Button
									disabled={twoFactorLoading || twoFactorCode.trim().length < 6}
									onClick={handleVerifyTwoFactor}
								>
									{twoFactorLoading ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : null}
									{t("profileSettings.securityCard.verifySetup")}
								</Button>
							</div>
						</div>
					)}
					{twoFactorMessage ? (
						<p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
							{twoFactorMessage}
						</p>
					) : null}
					{twoFactorError ? (
						<p className="mt-3 text-sm text-destructive">{twoFactorError}</p>
					) : null}
				</div>
			</div>

			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
				<h3 className="text-base font-semibold text-foreground">
					{t("profileSettings.notificationsCard.title")}
				</h3>
				<p className="mb-4 mt-0.5 text-sm text-muted-foreground">
					{t("profileSettings.notificationsCard.emailDescription")}
				</p>
				<div className="space-y-3">
					<label className="flex items-center gap-3 text-sm">
						<input
							type="checkbox"
							checked={emailOnMention}
							onChange={(event) => setEmailOnMention(event.target.checked)}
						/>
						<span>{t("profileSettings.notificationsCard.mentions")}</span>
					</label>
					<label className="flex items-center gap-3 text-sm">
						<input
							type="checkbox"
							checked={emailOnCommentReply}
							onChange={(event) => setEmailOnCommentReply(event.target.checked)}
						/>
						<span>
							{t("profileSettings.notificationsCard.whiteboardActivity")}
						</span>
					</label>
				</div>
				{notifMessage ? (
					<p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
						{notifMessage}
					</p>
				) : null}
				<Button
					className="mt-4"
					disabled={updatePrefs.isPending}
					onClick={() =>
						updatePrefs.mutate({ emailOnMention, emailOnCommentReply })
					}
				>
					{updatePrefs.isPending ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : null}
					{t("profileSettings.notificationsCard.save")}
				</Button>
			</div>

			<div className="rounded-2xl border border-destructive/35 bg-destructive/5 p-6 shadow-sm">
				<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
					<div className="flex items-start gap-3">
						<div className="rounded-xl bg-destructive/10 p-2 text-destructive">
							<Trash2 className="h-5 w-5" />
						</div>
						<div>
							<h3 className="text-base font-semibold text-foreground">
								{t("profileSettings.dangerZone.title")}
							</h3>
							<p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
								{t("profileSettings.dangerZone.description")}
							</p>
						</div>
					</div>
					<Button
						variant="destructive"
						onClick={() => setDeleteDialogOpen(true)}
					>
						<Trash2 className="h-4 w-4" />
						{t("profileSettings.dangerZone.deleteAccount")}
					</Button>
				</div>
			</div>

			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{t("profileSettings.dangerZone.dialogTitle")}
						</DialogTitle>
						<DialogDescription>
							{t("profileSettings.dangerZone.dialogDescription")}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
							{t("profileSettings.dangerZone.dataWarning")}
						</div>
						{publicConfig?.managed ? (
							<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
								{t("profileSettings.dangerZone.subscriptionCancellation")}
							</div>
						) : null}
						<div className="space-y-2">
							<Label htmlFor="delete-confirmation">
								{t("profileSettings.dangerZone.confirmationLabel", { email })}
							</Label>
							<Input
								id="delete-confirmation"
								value={deleteConfirmation}
								onChange={(event) => setDeleteConfirmation(event.target.value)}
								autoComplete="off"
							/>
						</div>
						{hasCredential ? (
							<div className="space-y-2">
								<Label htmlFor="delete-password">
									{t("profileSettings.dangerZone.passwordLabel")}
								</Label>
								<Input
									id="delete-password"
									type="password"
									autoComplete="current-password"
									value={deletePassword}
									onChange={(event) => setDeletePassword(event.target.value)}
								/>
							</div>
						) : null}
						<p className="text-xs text-muted-foreground">
							{t("profileSettings.dangerZone.legalRetention")}
						</p>
						{deleteError ? (
							<p className="text-sm text-destructive">{deleteError}</p>
						) : null}
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							disabled={deleteLoading}
							onClick={() => setDeleteDialogOpen(false)}
						>
							{t("profileSettings.dangerZone.cancel")}
						</Button>
						<Button
							variant="destructive"
							disabled={
								deleteLoading ||
								deleteConfirmation.trim().toLowerCase() !==
									email.toLowerCase() ||
								(hasCredential && deletePassword.length === 0)
							}
							onClick={handleDeleteAccount}
						>
							{deleteLoading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Trash2 className="h-4 w-4" />
							)}
							{deleteLoading
								? t("profileSettings.dangerZone.deleting")
								: t("profileSettings.dangerZone.confirmDelete")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
