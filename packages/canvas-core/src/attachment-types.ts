const DOCUMENT_TYPES: Record<string, string> = {
	pdf: "application/pdf",
	txt: "text/plain",
	csv: "text/csv",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	ppt: "application/vnd.ms-powerpoint",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	odt: "application/vnd.oasis.opendocument.text",
	ods: "application/vnd.oasis.opendocument.spreadsheet",
	odp: "application/vnd.oasis.opendocument.presentation",
	zip: "application/zip",
};

export function isCanvasAttachmentMimeType(mimeType: string) {
	return (
		mimeType.startsWith("image/") ||
		mimeType === "application/octet-stream" ||
		Object.values(DOCUMENT_TYPES).includes(mimeType)
	);
}

export function getCanvasAttachmentMimeType(attachment: {
	name: string;
	mimeType?: string;
	src?: string;
}) {
	const supplied =
		attachment.mimeType || attachment.src?.match(/^data:([^;,]+)/)?.[1];
	if (supplied && isCanvasAttachmentMimeType(supplied)) return supplied;
	const extension = attachment.name.split(".").pop()?.toLowerCase() ?? "";
	return (
		DOCUMENT_TYPES[extension] ??
		{
			png: "image/png",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			webp: "image/webp",
			gif: "image/gif",
			svg: "image/svg+xml",
		}[extension] ??
		"application/octet-stream"
	);
}
