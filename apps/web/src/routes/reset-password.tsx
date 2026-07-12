import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordWithToken } from "@/lib/auth-password";
import { useI18n } from "@/lib/i18n";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

export function ResetPasswordPage() {
	const { t } = useI18n();
	const [searchParams] = useSearchParams();
	const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [acknowledgedE2eeRisk, setAcknowledgedE2eeRisk] = useState(false);
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError("");

		if (password.length < 8) {
			setError(t("auth.resetPassword.passwordTooShort"));
			return;
		}
		if (password !== confirm) {
			setError(t("auth.resetPassword.passwordMismatch"));
			return;
		}
		if (!token) {
			setError(t("auth.resetPassword.invalidToken"));
			return;
		}
		if (!acknowledgedE2eeRisk) {
			setError(t("auth.resetPassword.e2eeWarningRequired"));
			return;
		}

		setLoading(true);
		try {
			const result = await resetPasswordWithToken(token, password);
			if (result.error) {
				setError(result.error.message ?? t("auth.resetPassword.failed"));
			} else {
				setDone(true);
			}
		} catch {
			setError(t("auth.resetPassword.failed"));
		} finally {
			setLoading(false);
		}
	};

	if (!token) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>{t("auth.resetPassword.title")}</CardTitle>
						<CardDescription>
							{t("auth.resetPassword.invalidToken")}
						</CardDescription>
					</CardHeader>
					<CardFooter>
						<Button asChild className="w-full">
							<Link to="/forgot-password">
								{t("auth.forgotPassword.title")}
							</Link>
						</Button>
					</CardFooter>
				</Card>
			</div>
		);
	}

	if (done) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>{t("auth.resetPassword.title")}</CardTitle>
						<CardDescription>{t("auth.resetPassword.success")}</CardDescription>
					</CardHeader>
					<CardFooter>
						<Button asChild className="w-full">
							<Link to="/login">{t("auth.resetPassword.backToLogin")}</Link>
						</Button>
					</CardFooter>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>{t("auth.resetPassword.title")}</CardTitle>
					<CardDescription>
						{t("auth.resetPassword.description")}
					</CardDescription>
				</CardHeader>
				<form onSubmit={handleSubmit}>
					<CardContent className="space-y-4">
						{error ? (
							<div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
								{error}
							</div>
						) : null}
						<div className="space-y-2">
							<Label htmlFor="password">
								{t("auth.resetPassword.newPassword")}
							</Label>
							<Input
								id="password"
								type="password"
								required
								minLength={8}
								value={password}
								onChange={(event) => setPassword(event.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="confirm">
								{t("auth.resetPassword.confirmPassword")}
							</Label>
							<Input
								id="confirm"
								type="password"
								required
								minLength={8}
								value={confirm}
								onChange={(event) => setConfirm(event.target.value)}
							/>
						</div>
						<label className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
							<input
								type="checkbox"
								className="mt-1"
								checked={acknowledgedE2eeRisk}
								onChange={(event) =>
									setAcknowledgedE2eeRisk(event.target.checked)
								}
							/>
							<span>
								<span className="block font-medium">
									{t("auth.resetPassword.e2eeWarningTitle")}
								</span>
								<span className="mt-1 block text-muted-foreground">
									{t("auth.resetPassword.e2eeWarningDescription")}
								</span>
							</span>
						</label>
					</CardContent>
					<CardFooter className="flex flex-col gap-3">
						<Button type="submit" className="w-full" disabled={loading}>
							{loading ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							{t("auth.resetPassword.submit")}
						</Button>
					</CardFooter>
				</form>
			</Card>
		</div>
	);
}
