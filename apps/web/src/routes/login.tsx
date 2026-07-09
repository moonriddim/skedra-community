import { AuthFormLayout } from "@/components/auth/auth-form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";

export function LoginPage() {
	const { data: session, isPending } = authClient.useSession();
	const { t } = useI18n();
	const [searchParams] = useSearchParams();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const redirectTo = searchParams.get("redirect") || "/";

	if (!isPending && session?.user) {
		return <Navigate to={redirectTo} replace />;
	}

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError("");
		setLoading(true);

		try {
			const result = await authClient.signIn.email({ email, password });
			if (result.error) {
				setError(result.error.message ?? t("auth.login.failed"));
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
			description={t("auth.login.description")}
			error={error}
			loading={loading}
			submitLabel={t("auth.login.submit")}
			onSubmit={handleSubmit}
			footer={
				<p className="text-center text-sm text-muted-foreground">
					{t("auth.login.noAccount")}{" "}
					<Link
						to={`/register?redirect=${encodeURIComponent(redirectTo)}`}
						className="text-primary underline-offset-4 hover:underline"
					>
						{t("auth.login.register")}
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
