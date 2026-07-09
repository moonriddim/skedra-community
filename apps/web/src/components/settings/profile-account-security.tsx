/**
 * Passwort-Reset und E-Mail-Benachrichtigungen im Profil.
 */

import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/lib/auth-password";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface ProfileAccountSecurityProps {
	email: string;
}

export function ProfileAccountSecurity({ email }: ProfileAccountSecurityProps) {
	const { t } = useI18n();
	const utils = trpc.useUtils();

	const { data: prefs } = trpc.userPreferences.get.useQuery();
	const [emailOnMention, setEmailOnMention] = useState(true);
	const [emailOnCommentReply, setEmailOnCommentReply] = useState(true);
	const [resetLoading, setResetLoading] = useState(false);
	const [resetMessage, setResetMessage] = useState("");
	const [resetError, setResetError] = useState("");
	const [localResetUrl, setLocalResetUrl] = useState<string | null>(null);
	const [notifMessage, setNotifMessage] = useState("");

	useEffect(() => {
		if (!prefs) return;
		setEmailOnMention(prefs.emailOnMention);
		setEmailOnCommentReply(prefs.emailOnCommentReply);
	}, [prefs]);

	const updatePrefs = trpc.userPreferences.update.useMutation({
		onSuccess: () => {
			setNotifMessage(t("profileSettings.messages.notificationsSaved"));
			void utils.userPreferences.get.invalidate();
		},
	});

	const peekLink = trpc.instance.peekPasswordResetLink.useQuery(
		{ email },
		{ enabled: !!localResetUrl || !!resetMessage, retry: false },
	);

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
			} else {
				setResetMessage(t("profileSettings.messages.passwordResetSent"));
				const link = await utils.instance.peekPasswordResetLink.fetch({
					email,
				});
				if (link.url) setLocalResetUrl(link.url);
			}
		} catch {
			setResetError(t("profileSettings.messages.passwordResetFailed"));
		} finally {
			setResetLoading(false);
		}
	};

	const fallbackUrl = peekLink.data?.url ?? localResetUrl;

	return (
		<>
			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
				<h3 className="text-base font-semibold text-foreground mb-1">
					{t("profileSettings.passwordCard.title")}
				</h3>
				<p className="text-sm text-muted-foreground mb-4">
					{t("profileSettings.passwordCard.signedInAsPrefix")}{" "}
					<strong>{email}</strong>{" "}
					{t("profileSettings.passwordCard.signedInAsSuffix")}
				</p>
				<Button
					variant="outline"
					disabled={resetLoading}
					onClick={handlePasswordReset}
				>
					{resetLoading ? (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : null}
					{t("profileSettings.passwordCard.sendResetLink")}
				</Button>
				{resetMessage ? (
					<p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
						{resetMessage}
					</p>
				) : null}
				{resetError ? (
					<p className="mt-3 text-sm text-destructive">{resetError}</p>
				) : null}
				{fallbackUrl ? (
					<div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
						<p>{t("profileSettings.messages.passwordResetLocalLinkReady")}</p>
						<Button asChild variant="link" className="mt-1 h-auto px-0">
							<a href={fallbackUrl}>
								<ExternalLink className="mr-1 h-3.5 w-3.5" />
								{t("profileSettings.messages.openLocalResetLink")}
							</a>
						</Button>
					</div>
				) : null}
				<p className="mt-3 text-xs text-muted-foreground">
					{t("profileSettings.passwordCard.compatibilityNote")}
				</p>
			</div>

			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
				<h3 className="text-base font-semibold text-foreground">
					{t("profileSettings.notificationsCard.title")}
				</h3>
				<p className="mt-0.5 text-sm text-muted-foreground mb-4">
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
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : null}
					{t("profileSettings.notificationsCard.save")}
				</Button>
			</div>
		</>
	);
}
