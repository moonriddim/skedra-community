import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
	ProfileImageProcessingError,
	deleteProfileImage,
	prepareProfileImage,
	uploadProfileImage,
} from "@/lib/profile-image";
import { getUserInitials } from "@/lib/user-initials";
import { Camera, Check, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

interface ProfileImageEditorProps {
	user?: {
		name: string;
		image?: string | null;
	};
	onChanged: () => Promise<void>;
}

export function ProfileImageEditor({
	user,
	onChanged,
}: ProfileImageEditorProps) {
	const { t } = useI18n();
	const inputRef = useRef<HTMLInputElement>(null);
	const [pendingAction, setPendingAction] = useState<
		"upload" | "remove" | null
	>(null);
	const [message, setMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const disabled = !user || pendingAction !== null;

	const processingErrorMessage = (error: ProfileImageProcessingError) =>
		t(`profileSettings.profileCard.errors.${error.code}`);

	const handleFileChange = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file || disabled) return;
		setPendingAction("upload");
		setMessage(null);
		try {
			const prepared = await prepareProfileImage(file);
			await uploadProfileImage(prepared);
			await onChanged();
			setMessage({
				type: "success",
				text: t("profileSettings.profileCard.uploadSuccess"),
			});
		} catch (error) {
			setMessage({
				type: "error",
				text:
					error instanceof ProfileImageProcessingError
						? processingErrorMessage(error)
						: t("profileSettings.profileCard.errors.upload"),
			});
		} finally {
			setPendingAction(null);
		}
	};

	const handleRemove = async () => {
		if (disabled || !user?.image) return;
		setPendingAction("remove");
		setMessage(null);
		try {
			await deleteProfileImage();
			await onChanged();
			setMessage({
				type: "success",
				text: t("profileSettings.profileCard.removeSuccess"),
			});
		} catch {
			setMessage({
				type: "error",
				text: t("profileSettings.profileCard.errors.remove"),
			});
		} finally {
			setPendingAction(null);
		}
	};

	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
			<div className="relative w-fit">
				<Avatar className="h-20 w-20 border-2 border-border shadow-sm">
					{user?.image ? (
						<AvatarImage
							src={user.image}
							alt={user.name}
							className="object-cover"
						/>
					) : null}
					<AvatarFallback className="bg-primary text-xl font-bold text-primary-foreground">
						{getUserInitials(user?.name ?? "")}
					</AvatarFallback>
				</Avatar>
				<button
					type="button"
					disabled={disabled}
					onClick={() => inputRef.current?.click()}
					className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-transparent transition hover:bg-black/45 hover:text-white focus-visible:bg-black/45 focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none"
					aria-label={t("profileSettings.profileCard.upload")}
				>
					{pendingAction === "upload" ? (
						<Loader2 className="h-5 w-5 animate-spin text-white" />
					) : (
						<Camera className="h-5 w-5" />
					)}
				</button>
			</div>

			<div className="min-w-0 flex-1">
				<p className="font-medium text-foreground">
					{t("profileSettings.profileCard.avatar")}
				</p>
				<p className="mt-0.5 text-sm text-muted-foreground">
					{t("profileSettings.profileCard.avatarHint")}
				</p>
				<div className="mt-3 flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled}
						onClick={() => inputRef.current?.click()}
					>
						{pendingAction === "upload" ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Upload className="mr-2 h-4 w-4" />
						)}
						{user?.image
							? t("profileSettings.profileCard.replace")
							: t("profileSettings.profileCard.upload")}
					</Button>
					{user?.image ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={disabled}
							onClick={handleRemove}
							className="text-muted-foreground hover:text-destructive"
						>
							{pendingAction === "remove" ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Trash2 className="mr-2 h-4 w-4" />
							)}
							{t("profileSettings.profileCard.remove")}
						</Button>
					) : null}
				</div>
				{message ? (
					<p
						className={`mt-2 flex items-center gap-1.5 text-xs ${
							message.type === "error"
								? "text-destructive"
								: "text-emerald-600 dark:text-emerald-400"
						}`}
					>
						{message.type === "success" ? (
							<Check className="h-3.5 w-3.5" />
						) : null}
						{message.text}
					</p>
				) : null}
			</div>

			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				className="sr-only"
				onChange={handleFileChange}
			/>
		</div>
	);
}
