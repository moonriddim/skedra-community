import { parseEncryptedAssetReference } from "@/lib/canvas/asset-urls";
import { createAttachmentBlobUrl } from "@/lib/canvas/attachment-utils";
import { useI18n } from "@/lib/i18n";
import { getCanvasAttachmentMimeType } from "@skedra/canvas-core";
import type { KanbanCardAttachment } from "@skedra/canvas-core";
import { Download, ExternalLink, FileText } from "lucide-react";
import { useEffect, useState } from "react";

export function KanbanAttachmentPreview({
	attachment,
	resolvedSrc,
}: { attachment: KanbanCardAttachment; resolvedSrc: string }) {
	const { t } = useI18n();
	const mimeType = getCanvasAttachmentMimeType(attachment);
	const image = mimeType.startsWith("image/");
	const canPreview =
		mimeType === "application/pdf" ||
		/^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(mimeType);
	const [link, setLink] = useState("");
	useEffect(() => {
		setLink("");
		// The resolver returns a placeholder until an encrypted asset is decrypted.
		if (
			parseEncryptedAssetReference(attachment.src) &&
			!resolvedSrc.startsWith("blob:")
		)
			return;
		let objectUrl: string | undefined;
		try {
			if (resolvedSrc.startsWith("data:")) {
				objectUrl = createAttachmentBlobUrl(resolvedSrc, mimeType);
				setLink(objectUrl);
			} else {
				const url = new URL(resolvedSrc, window.location.origin);
				if (["http:", "https:", "blob:"].includes(url.protocol))
					setLink(url.href);
			}
		} catch {
			/* Malformed imports stay visible as files without an unsafe link. */
		}
		return () => {
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [attachment.src, resolvedSrc, mimeType]);
	return (
		<div className="min-w-0">
			<a
				href={link || undefined}
				aria-disabled={!link}
				aria-label={`${t(canPreview ? "kanbanCardDialog.openAttachment" : "kanbanCardDialog.downloadAttachment")}: ${attachment.name}`}
				target={canPreview ? "_blank" : undefined}
				rel="noopener noreferrer"
				download={canPreview ? undefined : attachment.name}
				className="flex min-h-20 items-center justify-center bg-muted/30"
			>
				{image ? (
					<img
						src={resolvedSrc}
						alt={attachment.name}
						className="h-24 w-full object-cover"
						draggable={false}
					/>
				) : (
					<div className="flex items-center gap-2 p-4">
						<FileText className="h-8 w-8 shrink-0" />
						<span className="text-sm font-medium">
							{attachment.name.split(".").pop()?.toUpperCase() ||
								t("kanbanCardDialog.attachment")}
						</span>
					</div>
				)}
			</a>
			<div className="flex flex-wrap gap-2 px-2 pt-2">
				{canPreview && (
					<a
						href={link || undefined}
						aria-disabled={!link}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex min-h-11 items-center gap-1 rounded px-2 text-sm text-primary"
					>
						<ExternalLink className="h-4 w-4" />
						{t("kanbanCardDialog.openAttachment")}
					</a>
				)}
				<a
					href={link || undefined}
					aria-disabled={!link}
					download={attachment.name}
					className="inline-flex min-h-11 items-center gap-1 rounded px-2 text-sm text-primary"
				>
					<Download className="h-4 w-4" />
					{t("kanbanCardDialog.downloadAttachment")}
				</a>
			</div>
		</div>
	);
}
