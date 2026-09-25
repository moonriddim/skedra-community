/**
 * Macht Elemente „portabel“: Verschlüsselte Asset-Verweise werden durch die
 * entschlüsselten Bilddaten (data:-URLs) ersetzt.
 *
 * Hintergrund: Ein Asset-Verweis funktioniert nur im Board, zu dem das Asset
 * gehört. Der Server prüft den Zugriff auf genau dieses Board, bei E2EE hängt
 * der Schlüssel am Board-Schlüssel, und beim Löschen des Boards werden seine
 * Assets entfernt. Exportierte Dateien und Bibliotheks-Einträge verlassen das
 * Board aber. Deshalb werden die Bilder dort eingebettet – wie Excalidraw es
 * mit seinen „files“ in .excalidraw-Dateien macht. Beim Import lädt
 * `externalizeInlineImageElements` sie ins Ziel-Board wieder hoch.
 */

import { decryptImageAsset } from "@skedra/canvas-core";
import {
	type AssetAccessTokens,
	parseEncryptedAssetReference,
	withAssetAccessParams,
} from "./asset-urls";

export interface PortableAssetContext {
	/** Board, zu dem die Assets gehören (Teil der Verschlüsselung). */
	whiteboardId?: string;
	/** Board-Schlüssel bei E2EE; bei server-verschlüsselten Boards `null`. */
	e2eeKey?: string | null;
	/** Share-Tokens für Gäste (Collab-/Präsentations-Links). */
	tokens?: AssetAccessTokens;
	/** Für Tests austauschbar. */
	fetchAsset?: (url: string) => Promise<ArrayBuffer>;
}

export interface PortableAssetResult<T> {
	value: T;
	/** Anzahl der Verweise, die nicht eingebettet werden konnten. */
	failed: number;
}

/** Wandelt Bytes in eine base64-data:-URL um (in Blöcken, ohne Stack-Überlauf). */
function bytesToDataUrl(bytes: Uint8Array, mimeType: string) {
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
	}
	return `data:${mimeType};base64,${btoa(binary)}`;
}

/** Sammelt alle Strings, die verschlüsselte Asset-Verweise sind (beliebig tief). */
export function collectAssetReferences(value: unknown, into: Set<string>) {
	if (typeof value === "string") {
		if (parseEncryptedAssetReference(value)) into.add(value);
		return;
	}
	if (!value || typeof value !== "object") return;
	for (const item of Array.isArray(value) ? value : Object.values(value)) {
		collectAssetReferences(item, into);
	}
}

/** Ersetzt Strings anhand der Map; alle anderen Werte bleiben unverändert. */
export function replaceStrings(
	value: unknown,
	replacements: Map<string, string>,
): unknown {
	if (typeof value === "string") return replacements.get(value) ?? value;
	if (!value || typeof value !== "object") return value;
	if (Array.isArray(value)) {
		return value.map((item) => replaceStrings(item, replacements));
	}
	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [
			key,
			replaceStrings(item, replacements),
		]),
	);
}

async function defaultFetchAsset(url: string) {
	const response = await fetch(url, { credentials: "include" });
	if (!response.ok) throw new Error(`Asset request failed: ${response.status}`);
	return response.arrayBuffer();
}

/**
 * Bettet alle Asset-Verweise in `value` (z. B. eine Element-Liste) als
 * data:-URLs ein. Nicht ladbare Verweise bleiben stehen und werden gezählt.
 */
export async function embedEncryptedAssetReferences<T>(
	value: T,
	context: PortableAssetContext,
): Promise<PortableAssetResult<T>> {
	const references = new Set<string>();
	collectAssetReferences(value, references);
	if (references.size === 0) return { value, failed: 0 };

	const fetchAsset = context.fetchAsset ?? defaultFetchAsset;
	const replacements = new Map<string, string>();
	let failed = 0;
	for (const source of references) {
		const parsed = parseEncryptedAssetReference(source);
		// Ohne Board-ID bzw. Schlüssel lässt sich das Asset nicht entschlüsseln.
		if (
			!parsed ||
			!context.whiteboardId ||
			(!context.e2eeKey && !parsed.reference.key)
		) {
			failed++;
			continue;
		}
		try {
			const ciphertext = await fetchAsset(
				withAssetAccessParams(parsed.url, context.tokens),
			);
			const plaintext = await decryptImageAsset({
				ciphertext,
				boardKey: context.e2eeKey,
				whiteboardId: context.whiteboardId,
				reference: parsed.reference,
			});
			replacements.set(
				source,
				bytesToDataUrl(new Uint8Array(plaintext), parsed.reference.mimeType),
			);
		} catch {
			failed++;
		}
	}
	if (replacements.size === 0) return { value, failed };
	return { value: replaceStrings(value, replacements) as T, failed };
}
