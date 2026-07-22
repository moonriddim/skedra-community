import { AuthFormLayout } from "@/components/auth/auth-form-layout";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAbsoluteApiBaseUrl } from "@/lib/api-url";
import { authClient } from "@/lib/auth-client";
import {
	readE2eeKeyFromHash,
	unlockOrCreateUserE2eeIdentity,
	withE2eeKeyFragmentPath,
} from "@/lib/e2ee";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";

export function LoginPage() {
	const { data: session, isPending } = authClient.useSession();
	const { t } = useI18n();
	const [searchParams] = useSearchParams();
	const config = trpc.billing.getPublicConfig.useQuery();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const identityQuery = trpc.userE2ee.getIdentity.useQuery(undefined, {
		enabled: false,
		retry: false,
	});
	const saveIdentity = trpc.userE2ee.saveIdentity.useMutation();
	const requestedRedirect = searchParams.get("redirect") || "/library";
	const baseRedirectTo = (() => {
		try {
			const target = new URL(requestedRedirect, window.location.origin);
			const allowedOrigins = new Set([
				window.location.origin,
				new URL(getAbsoluteApiBaseUrl()).origin,
			]);
			if (!allowedOrigins.has(target.origin)) return "/library";
			return target.origin === window.location.origin
				? `${target.pathname}${target.search}${target.hash}`
				: target.toString();
		} catch {
			return "/library";
		}
	})();
	const e2eeKeyFromHash = readE2eeKeyFromHash();
	const redirectTo = e2eeKeyFromHash
		? withE2eeKeyFragmentPath(baseRedirectTo, e2eeKeyFromHash)
		: baseRedirectTo;
	const displayError =
		error ||
		(searchParams.get("oauthError") || searchParams.get("error")
			? t("auth.social.failed")
			: "");
	const externalRedirect = (() => {
		try {
			return (
				new URL(redirectTo, window.location.origin).origin !==
				window.location.origin
			);
		} catch {
			return false;
		}
	})();

	useEffect(() => {
		if (!isPending && session?.user && externalRedirect) {
			window.location.replace(redirectTo);
		}
	}, [externalRedirect, isPending, redirectTo, session?.user]);

	if (!isPending && session?.user && !externalRedirect) {
		return <Navigate to={redirectTo} replace />;
	}
	if (!isPending && session?.user) return null;

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError("");
		setLoading(true);

		try {
			const result = await authClient.signIn.email({ email, password });
			if (result.error) {
				setError(result.error.message ?? t("auth.login.failed"));
				return;
			}
			if (
				(result.data as { twoFactorRedirect?: boolean } | null)
					?.twoFactorRedirect
			)
				return;
			try {
				const identityResult = await identityQuery.refetch();
				await unlockOrCreateUserE2eeIdentity({
					email,
					password,
					existingIdentity: identityResult.data ?? null,
					saveIdentity: saveIdentity.mutateAsync,
				});
			} catch (identityError) {
				console.error("E2EE identity unlock failed", identityError);
			}
		} catch {
			setError(t("auth.login.unexpected"));
		} finally {
			setLoading(false);
		}
	};

	return (
		<AuthFormLayout
			title={t("auth.login.title")}
			description={t(
				config.data?.managed
					? "auth.login.managedDescription"
					: "auth.login.description",
			)}
			error={displayError}
			loading={loading}
			submitLabel={t("auth.login.submit")}
			onSubmit={handleSubmit}
			alternateActions={
				<SocialAuthButtons
					providers={config.data?.socialProviders}
					callbackURL={redirectTo}
					onError={setError}
				/>
			}
			footer={
				<p className="text-center text-sm text-muted-foreground">
					{t(
						config.data?.managed
							? "auth.login.choosePlanFirst"
							: "auth.login.noAccount",
					)}{" "}
					<Link
						to={
							config.data?.managed
								? `/pricing?redirect=${encodeURIComponent(redirectTo)}`
								: `/register?redirect=${encodeURIComponent(redirectTo)}`
						}
						className="text-primary underline-offset-4 hover:underline"
					>
						{t(
							config.data?.managed
								? "auth.login.choosePlanAction"
								: "auth.login.register",
						)}
					</Link>
				</p>
			}
		>
			<div className="space-y-2">
				<Label htmlFor="email">{t("auth.login.email")}</Label>
				<Input
					id="email"
					type="email"
					placeholder={t("auth.login.emailPlaceholder")}
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
				/>
			</div>
			<div className="space-y-2">
				<div className="flex items-center justify-between gap-2">
					<Label htmlFor="password">{t("auth.login.password")}</Label>
					<Link
						to="/forgot-password"
						className="text-xs text-primary underline-offset-4 hover:underline"
					>
						{t("auth.login.forgotPassword")}
					</Link>
				</div>
				<Input
					id="password"
					type="password"
					placeholder={t("auth.login.passwordPlaceholder")}
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
				/>
			</div>
		</AuthFormLayout>
	);
}
