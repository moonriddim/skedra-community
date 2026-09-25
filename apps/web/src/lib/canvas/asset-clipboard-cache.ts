/**
 * Bilder beim Kopieren zwischen Boards mitnehmen.
 *
 * Das Problem: Asset-Verweise gelten nur im eigenen Board (Zugriff + Board-ID
 * in der Verschlüsselung, bei E2EE zusätzlich der Board-Schlüssel). Im
 * Ziel-Board wären kopierte Bilder daher leer. Die Zwischenablage muss beim
 * Kopieren aber *synchron* beschrieben werden – für Download und
 * Entschlüsselung ist dann keine Zeit.
 *
 * Die Lösung (ähnlich wie Excalidraw, das Bilddaten im Speicher hält und
 * mitkopiert): Sobald Elemente mit Bildern ausgewählt werden, bereitet dieser
 * Cache die Bilder im Hintergrund als data:-URLs vor. Beim Kopieren werden sie
 * dann sofort eingebettet. Fügt man im *selben* Board wieder ein, werden die
 * data:-URLs über den Rückwärts-Index wieder zu den ursprünglichen Verweisen –
 * es entsteht kein doppelter Upload. In einem anderen Board lädt der
 * Einfüge-Schritt die Bilder als neue Assets dieses Boards hoch.
 */

import {
	type PortableAssetContext,
	collectAssetReferences,
	embedEncryptedAssetReferences,
	replaceStrings,
} from "./portable-assets";

interface CacheEntry {
	/** Board, zu dem der Verweis gehört. */
	whiteboardId: string;
	ref: string;
	dataUrl: string;
}

/**
 * Obergrenze des Caches in Zeichen (~40 MB Speicher als UTF-16). Ältere
 * Einträge werden zuerst verworfen; sie lassen sich jederzeit neu vorbereiten.
 */
const MAX_CACHE_CHARS = 20_000_000;

const byRef = new Map<string, CacheEntry>();
const byDataUrl = new Map<string, CacheEntry>();
const inFlight = new Set<string>();
let cachedChars = 0;

/** Schlüssel pro Board, damit gleiche Verweise nie boardübergreifend matchen. */
const refKey = (whiteboardId: string, ref: string) => `${whiteboardId}\n${ref}`;

function remember(entry: CacheEntry) {
	const key = refKey(entry.whiteboardId, entry.ref);
	if (byRef.has(key)) return;
	byRef.set(key, entry);
	byDataUrl.set(entry.dataUrl, entry);
	cachedChars += entry.dataUrl.length;
	// Map behält die Einfügereihenfolge: vorn stehen die ältesten Einträge.
	for (const [oldestKey, oldest] of byRef) {
		if (cachedChars <= MAX_CACHE_CHARS || oldest === entry) break;
		byRef.delete(oldestKey);
		byDataUrl.delete(oldest.dataUrl);
		cachedChars -= oldest.dataUrl.length;
	}
}

/**
 * Bereitet die Bilder der übergebenen Elemente (z. B. der Auswahl) im
 * Hintergrund vor. Bereits vorbereitete oder laufende Verweise werden
 * übersprungen; Fehler bleiben still (der Kopier-Fallback versucht es erneut).
 */
export async function prepareClipboardAssets(
	value: unknown,
	context: PortableAssetContext & { whiteboardId?: string },
) {
	const { whiteboardId } = context;
	if (!whiteboardId) return;
	const found = new Set<string>();
	collectAssetReferences(value, found);
	const refs = [...found].filter((ref) => {
		const key = refKey(whiteboardId, ref);
		return !byRef.has(key) && !inFlight.has(key);
	});
	if (refs.length === 0) return;
	for (const ref of refs) inFlight.add(refKey(whiteboardId, ref));
	try {
		// Ein Array aus Verweisen: Position i des Ergebnisses gehört zu refs[i].
		const { value: embedded } = await embedEncryptedAssetReferences(
			refs,
			context,
		);
		for (const [index, ref] of refs.entries()) {
			const dataUrl = embedded[index];
			if (dataUrl !== ref && dataUrl.startsWith("data:")) {
				remember({ whiteboardId, ref, dataUrl });
			}
		}
	} finally {
		for (const ref of refs) inFlight.delete(refKey(whiteboardId, ref));
	}
}

/**
 * Ersetzt synchron alle bereits vorbereiteten Verweise durch data:-URLs.
 * `missing` zählt Verweise, die (noch) nicht vorbereitet waren.
 */
export function embedPreparedClipboardAssets<T>(
	value: T,
	whiteboardId: string | undefined,
): { value: T; missing: number } {
	const found = new Set<string>();
	collectAssetReferences(value, found);
	if (found.size === 0 || !whiteboardId) {
		return { value, missing: found.size };
	}
	const replacements = new Map<string, string>();
	for (const ref of found) {
		const entry = byRef.get(refKey(whiteboardId, ref));
		if (entry) replacements.set(ref, entry.dataUrl);
	}
	return {
		value:
			replacements.size > 0
				? (replaceStrings(value, replacements) as T)
				: value,
		missing: found.size - replacements.size,
	};
}

/** Enthält `value` data:-URLs, die aus Verweisen *dieses* Boards stammen? */
export function hasRestorableClipboardAssets(
	value: unknown,
	whiteboardId: string | undefined,
) {
	if (!whiteboardId || byDataUrl.size === 0) return false;
	let found = false;
	const visit = (item: unknown) => {
		if (found) return;
		if (typeof item === "string") {
			found = byDataUrl.get(item)?.whiteboardId === whiteboardId;
			return;
		}
		if (!item || typeof item !== "object") return;
		for (const child of Array.isArray(item) ? item : Object.values(item)) {
			visit(child);
		}
	};
	visit(value);
	return found;
}

/**
 * Macht beim Einfügen ins *selbe* Board aus eingebetteten Bildern wieder die
 * ursprünglichen Asset-Verweise (kein erneuter Upload, kein Aufblähen).
 */
export function restoreClipboardAssetRefs<T>(
	value: T,
	whiteboardId: string | undefined,
): T {
	if (!hasRestorableClipboardAssets(value, whiteboardId)) return value;
	const replacements = new Map<string, string>();
	for (const [dataUrl, entry] of byDataUrl) {
		if (entry.whiteboardId === whiteboardId)
			replacements.set(dataUrl, entry.ref);
	}
	return replaceStrings(value, replacements) as T;
}

/** Nur für Tests: leert den Cache. */
export function clearClipboardAssetCache() {
	byRef.clear();
	byDataUrl.clear();
	inFlight.clear();
	cachedChars = 0;
}
