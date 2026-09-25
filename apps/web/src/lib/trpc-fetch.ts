import { HttpRequestError } from "./request-errors";

/**
 * Basis-Timeout für Board-Sync-Requests:
 * - bis zum Eintreffen der Response-Header (plus Upload-Zuschlag, s. u.) und
 * - als Stillstands-Timeout beim Lesen des Bodys: Solange Daten fließen, läuft
 *   ein großer Download weiter; erst wenn 30 s lang nichts ankommt, wird
 *   abgebrochen. Eine feste Gesamtfrist ließ große Seiten über langsame
 *   Verbindungen scheitern, obwohl sie noch vorankamen.
 */
const BOARD_SYNC_TIMEOUT_MS = 30_000;

/**
 * Konservativ angenommene minimale Upload-Rate (Bytes/s). Große Updates oder
 * Snapshots bekommen dadurch mehr Zeit bis zu den Response-Headern, denn den
 * Upload-Fortschritt eines fetch-Bodys kann der Browser nicht melden.
 * 3 MB → rund 94 s zusätzlich.
 */
const BOARD_SYNC_MIN_UPLOAD_BYTES_PER_SECOND = 32 * 1024;

const boardSyncProcedure =
	/^whiteboard\.(?:list|append|compact)(?:Server|E2ee)(?:Updates?|UpdatePage)$/;

export function isBoardSyncProcedure(path: string) {
	return boardSyncProcedure.test(path);
}

/** Erzeugt einen Abbruchgrund, der sich wie `AbortSignal.timeout()` verhält. */
function createTimeoutError(message: string) {
	return new DOMException(message, "TimeoutError");
}

/** Ungefähre Größe des Request-Bodys; tRPC sendet Mutationen als JSON-String. */
function getRequestBodyBytes(body: BodyInit | null | undefined) {
	if (typeof body === "string") return body.length;
	if (body instanceof Blob) return body.size;
	if (body instanceof ArrayBuffer) return body.byteLength;
	if (ArrayBuffer.isView(body)) return body.byteLength;
	return 0;
}

/**
 * Reicht den Response-Body durch und bricht ab, wenn zwischen zwei Chunks
 * länger als `idleMs` nichts ankommt. Der Abbruch läuft über denselben
 * AbortController wie der fetch, damit auch die Verbindung freigegeben wird.
 */
function withBodyStallTimeout(
	response: Response,
	controller: AbortController,
	idleMs: number,
) {
	if (!response.body) return response;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const arm = () => {
		clearTimeout(timer);
		timer = setTimeout(
			() =>
				controller.abort(
					createTimeoutError("Board sync response stalled while downloading."),
				),
			idleMs,
		);
	};
	arm();
	const reader = response.body.getReader();
	const body = new ReadableStream<Uint8Array>({
		async pull(stream) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					clearTimeout(timer);
					stream.close();
					return;
				}
				// Jeder Chunk beweist Fortschritt → Stillstands-Timer neu starten.
				arm();
				stream.enqueue(value);
			} catch (error) {
				clearTimeout(timer);
				// Beim eigenen Abbruch den Timeout-Grund statt eines generischen
				// AbortError melden.
				stream.error(
					controller.signal.aborted ? controller.signal.reason : error,
				);
			}
		},
		cancel(reason) {
			clearTimeout(timer);
			return reader.cancel(reason);
		},
	});
	return new Response(body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
}

/** Keep proxy stalls bounded, including a response body that stops arriving. */
export async function fetchTrpc(
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
	if (!hasBoardSync) {
		return fetch(url, { ...options, credentials: "include" });
	}

	// Eigener Controller: bricht bei Header-Timeout oder Body-Stillstand ab.
	const timeoutController = new AbortController();
	const headerTimeoutMs =
		timeoutMs +
		Math.ceil(
			(getRequestBodyBytes(options?.body) /
				BOARD_SYNC_MIN_UPLOAD_BYTES_PER_SECOND) *
				1000,
		);
	const headerTimer = setTimeout(
		() =>
			timeoutController.abort(
				createTimeoutError("Board sync request timed out."),
			),
		headerTimeoutMs,
	);
	const signal = AbortSignal.any([
		...(options?.signal ? [options.signal] : []),
		timeoutController.signal,
	]);

	let response: Response;
	try {
		response = await fetch(url, {
			...options,
			credentials: "include",
			// An empty delta response becomes obsolete as soon as a peer edits the
			// board. Do not let the browser or an intermediary reuse it.
			cache: "no-store",
			signal,
		});
	} catch (error) {
		// Den Timeout-Grund durchreichen, falls fetch nur einen AbortError meldet.
		throw timeoutController.signal.aborted
			? timeoutController.signal.reason
			: error;
	} finally {
		clearTimeout(headerTimer);
	}

	const contentType = response.headers
		.get("content-type")
		?.split(";")[0]
		.trim()
		.toLowerCase();
	let message: string | undefined;
	if (
		response.redirected &&
		response.status === 405 &&
		(
			options?.method ?? (url instanceof Request ? url.method : "GET")
		).toUpperCase() === "POST"
	) {
		message =
			"Board sync received HTTP 405 after a redirect. Check the API URL and proxy redirects: sync writes require POST; 301/302/303 redirects can change POST to GET.";
	} else if (
		contentType &&
		contentType !== "application/json" &&
		!contentType.endsWith("+json")
	) {
		const hint =
			response.status === 413
				? "The request is too large. Check the body-size limit on both the outer proxy and Skedra's internal NGINX."
				: response.status === 403
					? "A proxy or firewall rule may have blocked the request (for example an exploit filter)."
					: response.status === 502 ||
							response.status === 503 ||
							response.status === 504
						? "Check the reverse proxy and API availability."
						: "Check the API URL, proxy routing, and redirects.";
		message = `Board sync expected JSON but received HTTP ${response.status} (${contentType}). ${hint}`;
	}
	if (message) {
		// Do not display a proxy's HTML body or URLs containing share tokens.
		// Cancel unread error pages so they do not occupy a connection slot.
		void response.body?.cancel().catch(() => undefined);
		throw new HttpRequestError({ message, status: response.status });
	}
	return withBodyStallTimeout(response, timeoutController, timeoutMs);
}
