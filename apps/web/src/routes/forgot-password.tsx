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
import { requestPasswordReset } from "@/lib/auth-password";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

export function ForgotPasswordPage() {
	const { t } = useI18n();
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState("");
	const [localResetUrl, setLocalResetUrl] = useState<string | null>(null);

	const peekLink = trpc.instance.peekPasswordResetLink.useQuery(
		{ email },
		{ enabled: submitted && !!email, retry: false },
	);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError("");
		setLocalResetUrl(null);
		setLoading(true);

		try {
			const result = await requestPasswordReset(email.trim());
			if (result.error) {
				setError(result.error.message ?? t("auth.forgotPassword.failed"));
			} else {
				setSubmitted(true);
			}
		} catch {
			setError(t("auth.forgotPassword.failed"));
		} finally {
			setLoading(false);
		}
	};

	if (submitted) {
		const fallbackUrl = peekLink.data?.url ?? localResetUrl;

		return (
			<div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>{t("auth.forgotPassword.title")}</CardTitle>
						<CardDescription>
							{t("auth.forgotPassword.success")}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{fallbackUrl ? (
							<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
								<p className="font-medium text-foreground">
									{t("auth.forgotPassword.localLinkReady")}
								</p>
								<p className="mt-1 text-muted-foreground">
									{t("auth.forgotPassword.localLinkHint")}
								</p>
								<Button asChild className="mt-3 w-full" variant="outline">
									<a href={fallbackUrl}>
										<ExternalLink className="mr-2 h-4 w-4" />
										{t("auth.forgotPassword.openLocalResetLink")}
									</a>
								</Button>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								{t("auth.forgotPassword.devHint")}
							</p>
						)}
					</CardContent>
					<CardFooter>
						<Button asChild variant="ghost" className="w-full">
							<Link to="/login">{t("auth.forgotPassword.backToLogin")}</Link>
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
					<CardTitle>{t("auth.forgotPassword.title")}</CardTitle>
					<CardDescription>
						{t("auth.forgotPassword.description")}
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
							<Label htmlFor="email">{t("auth.forgotPassword.email")}</Label>
							<Input
								id="email"
								type="email"
								required
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								placeholder={t("auth.forgotPassword.emailPlaceholder")}
							/>
						</div>
					</CardContent>
					<CardFooter className="flex flex-col gap-3">
						<Button type="submit" className="w-full" disabled={loading}>
							{loading ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							{t("auth.forgotPassword.submit")}
						</Button>
						<Button asChild variant="ghost" className="w-full">
							<Link to="/login">{t("auth.forgotPassword.backToLogin")}</Link>
						</Button>
					</CardFooter>
				</form>
			</Card>
		</div>
	);
}
