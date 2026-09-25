export const CANVAS_UPDATE_COMPACT_AFTER_COUNT = 500;
export const CANVAS_UPDATE_COMPACT_AFTER_BYTES = 1_500_000;

// Frequent live notifications must not repeatedly cancel a slow proxy response.
export const CANVAS_LIVE_REFETCH_OPTIONS = { cancelRefetch: false } as const;

export interface CanvasUpdateLogSize {
	updateCount: number;
	compactableBytes: number;
}

/**
 * `compactableBytes` excludes the first base/snapshot row. A large board state is
 * therefore not compacted after every subsequent edit; only the accumulated
 * delta log is compared with the byte threshold.
 */
export function shouldCompactCanvasUpdateLog({
	updateCount,
	compactableBytes,
}: CanvasUpdateLogSize) {
	return (
		updateCount >= CANVAS_UPDATE_COMPACT_AFTER_COUNT ||
		compactableBytes >= CANVAS_UPDATE_COMPACT_AFTER_BYTES
	);
}

/** Poll-Intervall, solange der SSE-Live-Kanal verbunden ist (nur Absicherung). */
export const CANVAS_UPDATE_POLL_LIVE_MS = 8_000;
/** Poll-Intervall für einen sichtbaren Tab ohne Live-Kanal. */
export const CANVAS_UPDATE_POLL_MS = 1_500;
/**
 * Poll-Intervall für versteckte Tabs. Sie schließen ihren Live-Kanal (siehe
 * `createVisibilityGatedConnection`) und sollen danach den Server nicht im
 * Sekundentakt abfragen.
 */
export const CANVAS_UPDATE_POLL_HIDDEN_MS = 10_000;

export function getCanvasUpdatePollInterval({
	liveConnected,
	hidden,
}: {
	liveConnected: boolean;
	hidden: boolean;
}) {
	if (liveConnected) return CANVAS_UPDATE_POLL_LIVE_MS;
	return hidden ? CANVAS_UPDATE_POLL_HIDDEN_MS : CANVAS_UPDATE_POLL_MS;
}

/** Erste Wartezeit nach einer fehlgeschlagenen Komprimierung. */
export const CANVAS_COMPACTION_RETRY_BASE_MS = 30_000;
/** Obergrenze der Wartezeit zwischen zwei Komprimierungsversuchen. */
export const CANVAS_COMPACTION_RETRY_MAX_MS = 15 * 60_000;

/**
 * Exponentielles Backoff nach fehlgeschlagener Komprimierung.
 * Vorher wurde nach jedem eingehenden Update erneut der komplette
 * Board-Zustand hochgeladen – bei einem Proxy-Limit also dauerhaft und bei
 * jeder Änderung. `failures` ist die Anzahl der Fehlschläge in Folge (≥ 1).
 */
export function getCompactionRetryDelayMs(failures: number) {
	const exponent = Math.max(0, failures - 1);
	return Math.min(
		CANVAS_COMPACTION_RETRY_BASE_MS * 2 ** exponent,
		CANVAS_COMPACTION_RETRY_MAX_MS,
	);
}

/** Lesbare MB-Angabe für Fehlermeldungen (1 Nachkommastelle). */
function formatMegabytes(chars: number) {
	return (chars / 1_000_000).toFixed(1);
}

/**
 * Meldung für ein lokales Update, das größer ist als das API-Limit. Es bleibt
 * in IndexedDB erhalten, wird aber nicht sinnlos alle paar Sekunden erneut
 * hochgeladen.
 */
export function createSyncPayloadTooLargeError(
	chars: number,
	maxChars: number,
) {
	return new Error(
		`Eine Änderung ist zu groß für die Synchronisierung (${formatMegabytes(chars)} MB, erlaubt sind ${formatMegabytes(maxChars)} MB). Sie bleibt lokal gespeichert. Große Bilder oder SVGs bitte verkleinern.`,
	);
}
