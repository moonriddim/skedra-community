import { AuthFormLayout } from "@/components/auth/auth-form-layout";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import {
	readE2eeKeyFromHash,
	unlockOrCreateUserE2eeIdentity,
	withE2eeKeyFragmentPath,
} from "@/lib/e2ee";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";

export function RegisterPage() {
	const { data: session, isPending } = authClient.useSession();
	const { t } = useI18n();
	const [searchParams] = useSearchParams();
	const config = trpc.billing.getPublicConfig.useQuery();
	const requestedRedirect = searchParams.get("redirect") || "/library";
	const requestedPlan = searchParams.get("plan");
	const plan =
		requestedPlan === "pro_monthly" || requestedPlan === "pro_yearly"
			? requestedPlan
			: null;
	const hasSelectedPlan = plan !== null;
	const baseRedirectTo =
		config.data?.managed && plan
			? `/subscribe?${new URLSearchParams({
					plan,
					checkout: "start",
					redirect: requestedRedirect,
				}).toString()}`
			: requestedRedirect;
	const e2eeKeyFromHash = readE2eeKeyFromHash();
	const redirectTo = e2eeKeyFromHash
		? withE2eeKeyFragmentPath(baseRedirectTo, e2eeKeyFromHash)
		: baseRedirectTo;
	const inviteToken = searchParams.get("invite");
	const [name, setName] = useState("");
	const [email, setEmail] = useState(searchParams.get("email") ?? "");
	const [password, setPassword] = useState("");
	const [acceptedTerms, setAcceptedTerms] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const displayError =
		error ||
		(searchParams.get("oauthError") || searchParams.get("error")
			? t("auth.social.failed")
			: "");
	const identityQuery = trpc.userE2ee.getIdentity.useQuery(undefined, {
		enabled: false,
		retry: false,
	});
	const saveIdentity = trpc.userE2ee.saveIdentity.useMutation();

	if (config.isPending) {
		return (
			<div className="flex h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	if (config.data?.managed && !inviteToken && !hasSelectedPlan) {
		return (
			<Navigate
				to={`/pricing?redirect=${encodeURIComponent(requestedRedirect)}`}
				replace
			/>
		);
	}

	if (!isPending && session?.user) {
		return <Navigate to={redirectTo} replace />;
	}

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError("");
		setLoading(true);

		try {
			const result = await authClient.signUp.email({
				name,
				email,
				password,
				inviteToken: inviteToken ?? undefined,
			} as {
				name: string;
				email: string;
				password: string;
				inviteToken?: string;
			});
			if (result.error) {
				setError(result.error.message ?? t("auth.register.failed"));
				return;
			}
			try {
				const identityResult = await identityQuery.refetch();
				await unlockOrCreateUserE2eeIdentity({
					email,
					password,
					existingIdentity: identityResult.data ?? null,
					saveIdentity: saveIdentity.mutateAsync,
				});
			} catch (identityError) {
				console.error("E2EE identity setup failed", identityError);
			}
		} catch {
			setError(t("auth.register.unexpected"));
		} finally {
			setLoading(false);
		}
	};

	return (
		<AuthFormLayout
			title={t("auth.register.title")}
			description={t("auth.register.description")}
			error={displayError}
			loading={loading}
			submitLabel={t("auth.register.submit")}
			onSubmit={handleSubmit}
			alternateActions={
				config.data?.socialSignUpEnabled ? (
					<SocialAuthButtons
						providers={config.data.socialProviders}
						callbackURL={redirectTo}
						requestSignUp
						disabled={Boolean(config.data.managed && !acceptedTerms)}
						onError={setError}
					/>
				) : null
			}
			footer={
				<p className="text-center text-sm text-muted-foreground">
					{t("auth.register.haveAccount")}{" "}
					<Link
						to={`/login?redirect=${encodeURIComponent(redirectTo)}`}
						className="text-primary underline-offset-4 hover:underline"
					>
						{t("auth.register.login")}
					</Link>
				</p>
			}
		>
			<div className="space-y-2">
				<Label htmlFor="name">{t("auth.register.name")}</Label>
				<Input
					id="name"
					type="text"
					placeholder={t("auth.register.namePlaceholder")}
					value={name}
					onChange={(e) => setName(e.target.value)}
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="email">{t("auth.register.email")}</Label>
				<Input
					id="email"
					type="email"
					placeholder={t("auth.register.emailPlaceholder")}
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="password">{t("auth.register.password")}</Label>
				<Input
					id="password"
					type="password"
					placeholder={t("auth.register.passwordPlaceholder")}
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					minLength={8}
				/>
			</div>
			{config.data?.managed && hasSelectedPlan && (
				<label className="flex items-start gap-3 text-sm leading-5 text-muted-foreground">
					<input
						type="checkbox"
						checked={acceptedTerms}
						onChange={(event) => setAcceptedTerms(event.target.checked)}
						required
						className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
					/>
					<span>
						{t("auth.register.legalPrefix")}{" "}
						<Link
							className="text-primary hover:underline"
							to="/terms"
							target="_blank"
						>
							{t("auth.register.terms")}
						</Link>{" "}
						{t("auth.register.legalAnd")}{" "}
						<Link
							className="text-primary hover:underline"
							to="/privacy"
							target="_blank"
						>
							{t("auth.register.privacy")}
						</Link>{" "}
						{t("auth.register.legalSuffix")}
					</span>
				</label>
			)}
		</AuthFormLayout>
	);
}
