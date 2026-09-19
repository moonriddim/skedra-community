const BOARD_SYNC_TIMEOUT_MS = 30_000;
const boardSyncProcedure =
	/^whiteboard\.(?:list|append|compact)(?:Server|E2ee)Updates?$/;

export function isBoardSyncProcedure(path: string) {
	return boardSyncProcedure.test(path);
}

/** Keep proxy stalls bounded, including a response body that stops arriving. */
export function fetchTrpc(
	url: RequestInfo | URL,
	options?: RequestInit,
	timeoutMs = BOARD_SYNC_TIMEOUT_MS,
): Promise<Response> {
	const pathname = new URL(
		url instanceof Request ? url.url : String(url),
		"http://localhost",
	).pathname;
	const hasBoardSync = decodeURIComponent(pathname.split("/").at(-1) ?? "")
		.split(",")
		.some(isBoardSyncProcedure);
	const signal = hasBoardSync
		? AbortSignal.any([
				...(options?.signal ? [options.signal] : []),
				AbortSignal.timeout(timeoutMs),
			])
		: options?.signal;
	return fetch(url, {
		...options,
		credentials: "include",
		// An empty delta response becomes obsolete as soon as a peer edits the
		// board. Reusing it can leave the cursor stuck on the same cached URL.
		...(hasBoardSync ? { cache: "no-store" as const } : {}),
		signal,
	});
}
