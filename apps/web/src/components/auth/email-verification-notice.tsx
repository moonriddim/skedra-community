import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

export function EmailVerificationNotice({
	email,
	redirectTo,
	onResend,
	onChangeEmail,
}: {
	email: string;
	redirectTo: string;
	onResend: () => Promise<void>;
	onChangeEmail: () => void;
}) {
	const { t } = useI18n();
	const [sending, setSending] = useState(false);
	const [resent, setResent] = useState(false);
	const [failed, setFailed] = useState(false);
	const [coolingDown, setCoolingDown] = useState(false);
	useEffect(() => {
		if (!coolingDown) return;
		const timer = setTimeout(() => setCoolingDown(false), 60_000);
		return () => clearTimeout(timer);
	}, [coolingDown]);

	const resend = async () => {
		if (sending || coolingDown) return;
		setSending(true);
		setFailed(false);
		setResent(false);
		try {
			await onResend();
			setResent(true);
			setCoolingDown(true);
		} catch {
			setFailed(true);
		} finally {
			setSending(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 max-lg:min-h-dvh max-lg:py-6">
			<Card className="w-full max-w-md">
				<CardHeader className="items-center text-center">
					<BrandLogo
						className="justify-center"
						markClassName="h-14 w-14"
						wordmarkClassName="text-2xl"
					/>
					<CardTitle className="text-2xl">
						{t("auth.register.verificationTitle")}
					</CardTitle>
					<CardDescription>
						{t("auth.register.verificationDescription", { email })}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm text-muted-foreground">
					<p>{t("auth.register.verificationHint")}</p>
					{resent && (
						<output className="block">
							{t("auth.register.verificationResent")}
						</output>
					)}
					{failed && (
						<p role="alert" className="text-destructive">
							{t("auth.register.verificationFailed")}
						</p>
					)}
				</CardContent>
				<CardFooter className="flex flex-col gap-3">
					<Button
						className="w-full"
						onClick={resend}
						disabled={sending || coolingDown}
					>
						{sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{t(
							coolingDown
								? "auth.register.verificationCooldown"
								: "auth.register.verificationResend",
						)}
					</Button>
					<Button asChild variant="outline" className="w-full">
						<Link to={`/login?redirect=${encodeURIComponent(redirectTo)}`}>
							{t("auth.register.login")}
						</Link>
					</Button>
					<Button
						variant="ghost"
						className="w-full"
						onClick={onChangeEmail}
						disabled={sending}
					>
						{t("auth.register.changeEmail")}
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
