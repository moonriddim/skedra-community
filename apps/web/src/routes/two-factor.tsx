import { AuthFormLayout } from "@/components/auth/auth-form-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

function safeRedirect(value: string | null) {
	return value?.startsWith("/") &&
		!value.startsWith("//") &&
		!value.includes("\\")
		? value
		: "/library";
}

export function TwoFactorPage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const [mode, setMode] = useState<"totp" | "backup">("totp");
	const [code, setCode] = useState("");
	const [trustDevice, setTrustDevice] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const redirectTo = safeRedirect(searchParams.get("redirect"));

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setLoading(true);
		setError("");
		try {
			const result =
				mode === "totp"
					? await authClient.twoFactor.verifyTotp({
							code: code.replace(/\s/gu, ""),
							trustDevice,
						})
					: await authClient.twoFactor.verifyBackupCode({
							code: code.trim(),
							trustDevice,
						});

			if (result.error) {
				setError(result.error.message ?? t("auth.twoFactor.failed"));
				return;
			}
			navigate(redirectTo, { replace: true });
		} catch {
			setError(t("auth.twoFactor.failed"));
		} finally {
			setLoading(false);
		}
	};

	return (
		<AuthFormLayout
			title={t("auth.twoFactor.title")}
			description={t(
				mode === "totp"
					? "auth.twoFactor.description"
					: "auth.twoFactor.backupDescription",
			)}
			error={error}
			loading={loading}
			submitLabel={t("auth.twoFactor.submit")}
			onSubmit={handleSubmit}
			alternateActions={
				<Button
					type="button"
					variant="ghost"
					className="w-full"
					onClick={() => {
						setMode((current) => (current === "totp" ? "backup" : "totp"));
						setCode("");
						setError("");
					}}
				>
					{t(
						mode === "totp"
							? "auth.twoFactor.useBackupCode"
							: "auth.twoFactor.useAuthenticator",
					)}
				</Button>
			}
			footer={
				<Link
					to="/login"
					className="text-sm text-primary underline-offset-4 hover:underline"
				>
					{t("auth.twoFactor.backToLogin")}
				</Link>
			}
		>
			<div className="space-y-2">
				<Label htmlFor="two-factor-code">
					{t(
						mode === "totp"
							? "auth.twoFactor.code"
							: "auth.twoFactor.backupCode",
					)}
				</Label>
				<Input
					id="two-factor-code"
					inputMode={mode === "totp" ? "numeric" : "text"}
					autoComplete="one-time-code"
					value={code}
					onChange={(event) => setCode(event.target.value)}
					placeholder={mode === "totp" ? "123456" : "XXXX-XXXX"}
					required
					autoFocus
				/>
			</div>
			<label className="flex items-center gap-3 text-sm text-muted-foreground">
				<input
					type="checkbox"
					checked={trustDevice}
					onChange={(event) => setTrustDevice(event.target.checked)}
				/>
				<span>{t("auth.twoFactor.trustDevice")}</span>
			</label>
		</AuthFormLayout>
	);
}
