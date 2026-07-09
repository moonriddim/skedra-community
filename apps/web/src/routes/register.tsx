import { AuthFormLayout } from "@/components/auth/auth-form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";

export function RegisterPage() {
	const { data: session, isPending } = authClient.useSession();
	const { t } = useI18n();
	const [searchParams] = useSearchParams();
	const redirectTo = searchParams.get("redirect") || "/";
	const inviteToken = searchParams.get("invite");
	const [name, setName] = useState("");
	const [email, setEmail] = useState(searchParams.get("email") ?? "");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

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
			error={error}
			loading={loading}
			submitLabel={t("auth.register.submit")}
			onSubmit={handleSubmit}
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
		</AuthFormLayout>
	);
}
