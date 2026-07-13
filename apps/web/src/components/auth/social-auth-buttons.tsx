import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { Github, Loader2 } from "lucide-react";
import { useState } from "react";

type SocialProvider = "google" | "github";

interface SocialAuthButtonsProps {
	providers: { google: boolean; github: boolean } | undefined;
	callbackURL: string;
	requestSignUp?: boolean;
	disabled?: boolean;
	onError: (message: string) => void;
}

function currentOAuthErrorCallbackURL() {
	const url = new URL(window.location.href);
	url.searchParams.set("oauthError", "1");
	return `${url.pathname}${url.search}${url.hash}`;
}

export function SocialAuthButtons({
	providers,
	callbackURL,
	requestSignUp = false,
	disabled = false,
	onError,
}: SocialAuthButtonsProps) {
	const { t } = useI18n();
	const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(
		null,
	);

	if (!providers?.google && !providers?.github) return null;

	const handleSocialAuth = async (provider: SocialProvider) => {
		setLoadingProvider(provider);
		onError("");
		try {
			const result = await authClient.signIn.social({
				provider,
				callbackURL,
				errorCallbackURL: currentOAuthErrorCallbackURL(),
				requestSignUp,
			});
			if (result.error) {
				onError(result.error.message ?? t("auth.social.failed"));
				setLoadingProvider(null);
			}
		} catch {
			onError(t("auth.social.failed"));
			setLoadingProvider(null);
		}
	};

	return (
		<div className="w-full space-y-3">
			<div className="flex items-center gap-3 text-xs text-muted-foreground">
				<div className="h-px flex-1 bg-border" />
				<span>{t("auth.social.divider")}</span>
				<div className="h-px flex-1 bg-border" />
			</div>
			<div className="grid gap-2 sm:grid-cols-2">
				{providers.google ? (
					<Button
						type="button"
						variant="outline"
						disabled={disabled || loadingProvider !== null}
						onClick={() => void handleSocialAuth("google")}
					>
						{loadingProvider === "google" ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<span className="mr-2 text-base font-semibold" aria-hidden="true">
								G
							</span>
						)}
						{t("auth.social.google")}
					</Button>
				) : null}
				{providers.github ? (
					<Button
						type="button"
						variant="outline"
						disabled={disabled || loadingProvider !== null}
						onClick={() => void handleSocialAuth("github")}
					>
						{loadingProvider === "github" ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Github className="mr-2 h-4 w-4" aria-hidden="true" />
						)}
						{t("auth.social.github")}
					</Button>
				) : null}
			</div>
			{disabled ? (
				<p className="text-center text-xs text-muted-foreground">
					{t("auth.social.acceptTerms")}
				</p>
			) : null}
		</div>
	);
}
