export function withPresentationPreviewVersion(
	url: string,
	version: string | null | undefined,
) {
	const link = new URL(url);
	if (version) link.searchParams.set("v", version);
	else link.searchParams.delete("v");
	return link.toString();
}

/** Start the clipboard write in the click gesture, even while the preview is uploading. */
export async function copyPreparedPresentationLink(link: Promise<string>) {
	const text = link.then((url) => new Blob([url], { type: "text/plain" }));
	// Handle preparation failures even when the browser rejects clipboard access first.
	void text.catch(() => undefined);
	if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
		await navigator.clipboard.write([
			new ClipboardItem({ "text/plain": text }),
		]);
	} else {
		await navigator.clipboard.writeText(await link);
	}
}
