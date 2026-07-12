/**
 * Node-seitiges E2EE-Kit für den MCP.
 *
 * Erzeugt aus Canvas-Elementen ein verschlüsseltes Yjs-Update, das der Web-Client
 * mit demselben Board-Schlüssel entschlüsseln kann. Der Envelope ist bit-kompatibel
 * zum Web (`apps/web/src/lib/e2ee.ts`): AES-GCM-256, 12-Byte-IV, `data` = Ciphertext
 * inkl. angehängtem 16-Byte-Auth-Tag (wie WebCrypto es liefert).
 */

import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";
import {
	type CanvasElement,
	type SavedCanvasView,
	normalizeCanvasElementStackIndexes,
} from "@skedra/canvas-core";
import * as Y from "yjs";

const E2EE_KEY_HASH_PREFIX = "skedra-e2ee-key-v1:";
const ENVELOPE_VERSION = 1 as const;
const ENVELOPE_ALG = "AES-GCM-256" as const;

export interface EncryptedBoardUpdate {
	id?: string;
	clientId?: string;
	update: string;
	createdAt?: string;
}

export interface DecryptedBoardState {
	elements: CanvasElement[];
	views: SavedCanvasView[];
	appliedUpdates: number;
}

/** Base64url-String → 32-Byte-Schlüssel (wirft bei falscher Länge). */
function keyToBytes(key: string): Buffer {
	const bytes = Buffer.from(key.trim(), "base64url");
	if (bytes.length !== 32) {
		throw new Error("Ungültiger E2EE-Schlüssel (erwartet 32 Bytes base64url).");
	}
	return bytes;
}

/**
 * SHA-256(prefix || keyBytes) als Hex — identisch zum Web und zur Board-Erstellung.
 * Dient dem Server als Nachweis, dass der Aufrufer den Schlüssel besitzt.
 */
export function createE2eeKeyHash(key: string): string {
	return createHash("sha256")
		.update(E2EE_KEY_HASH_PREFIX)
		.update(keyToBytes(key))
		.digest("hex");
}

/** Verschlüsselt ein rohes Yjs-Update zum Web-kompatiblen JSON-Envelope. */
function encryptYjsUpdate(update: Uint8Array, key: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", keyToBytes(key), iv);
	const ciphertext = Buffer.concat([
		cipher.update(Buffer.from(update)),
		cipher.final(),
	]);
	// WebCrypto hängt das 16-Byte-Auth-Tag an den Ciphertext an — hier nachbauen.
	const data = Buffer.concat([ciphertext, cipher.getAuthTag()]);
	return JSON.stringify({
		v: ENVELOPE_VERSION,
		alg: ENVELOPE_ALG,
		iv: iv.toString("base64url"),
		data: data.toString("base64url"),
	});
}

/** Entschluesselt einen Web-kompatiblen AES-GCM-Envelope zu rohen Bytes. */
function decryptYjsUpdate(envelopeText: string, key: string): Uint8Array {
	let envelope: unknown;
	try {
		envelope = JSON.parse(envelopeText);
	} catch {
		throw new Error("Ungueltiger E2EE-Envelope.");
	}
	if (
		!envelope ||
		typeof envelope !== "object" ||
		(envelope as { v?: unknown }).v !== ENVELOPE_VERSION ||
		(envelope as { alg?: unknown }).alg !== ENVELOPE_ALG ||
		typeof (envelope as { iv?: unknown }).iv !== "string" ||
		typeof (envelope as { data?: unknown }).data !== "string"
	) {
		throw new Error("Nicht unterstuetzter E2EE-Envelope.");
	}

	const parsed = envelope as { iv: string; data: string };
	const encrypted = Buffer.from(parsed.data, "base64url");
	if (encrypted.length <= 16) {
		throw new Error("Ungueltiger E2EE-Ciphertext.");
	}
	const ciphertext = encrypted.subarray(0, encrypted.length - 16);
	const authTag = encrypted.subarray(encrypted.length - 16);
	const decipher = createDecipheriv(
		"aes-256-gcm",
		keyToBytes(key),
		Buffer.from(parsed.iv, "base64url"),
	);
	decipher.setAuthTag(authTag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Klont Plain-Objekte JSON-basiert (für verschachtelte customData etc.). */
function cloneYValue(value: unknown) {
	if (value == null || typeof value !== "object") return value;
	return JSON.parse(JSON.stringify(value));
}

/** Plain-Objekt → Y.Map (gleiche Struktur wie der Web-Canvas erwartet). */
function objectToYMap(obj: Record<string, unknown>): Y.Map<unknown> {
	const yMap = new Y.Map<unknown>();
	for (const [key, value] of Object.entries(obj)) {
		if (value === undefined) continue;
		yMap.set(key, cloneYValue(value));
	}
	return yMap;
}

/** Y.Map -> Plain-Objekt fuer MCP-Ausgaben. */
function yMapToObject<T>(yMap: Y.Map<unknown>): T {
	const obj: Record<string, unknown> = {};
	yMap.forEach((value, key) => {
		obj[key] =
			value instanceof Y.Map
				? yMapToObject<Record<string, unknown>>(value)
				: cloneYValue(value);
	});
	return obj as T;
}

function readCanvasElements(doc: Y.Doc): CanvasElement[] {
	const elements: CanvasElement[] = [];
	doc.getMap<Y.Map<unknown>>("elementsMap").forEach((value, id) => {
		if (!(value instanceof Y.Map)) return;
		const element = {
			...yMapToObject<Record<string, unknown>>(value),
			id,
		} as Record<string, unknown>;
		if (typeof element.type === "string") {
			elements.push(element as unknown as CanvasElement);
		}
	});
	return normalizeCanvasElementStackIndexes(elements);
}

function readSavedViews(doc: Y.Doc): SavedCanvasView[] {
	const views: SavedCanvasView[] = [];
	doc.getMap<Y.Map<unknown>>("viewsMap").forEach((value, id) => {
		if (!(value instanceof Y.Map)) return;
		const view = {
			...yMapToObject<Record<string, unknown>>(value),
			id,
		} as Record<string, unknown>;
		if (typeof view.name === "string") {
			views.push(view as unknown as SavedCanvasView);
		}
	});
	return views.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Baut aus Elementen ein Yjs-Update und verschlüsselt es. Die Elemente werden in
 * die `elementsMap` geschrieben (gleicher Map-Name wie im Web). Für ein leeres Board
 * ist das der volle State; auf ein bestehendes Board angewendet mergen die neuen
 * Element-IDs konfliktfrei (Yjs-CRDT).
 */
export function encryptElementsUpdate(
	elements: CanvasElement[],
	key: string,
): { update: string; keyHash: string } {
	const doc = new Y.Doc();
	const map = doc.getMap<Y.Map<unknown>>("elementsMap");
	doc.transact(() => {
		for (const element of elements) {
			map.set(
				element.id,
				objectToYMap(element as unknown as Record<string, unknown>),
			);
		}
	});
	const rawUpdate = Y.encodeStateAsUpdate(doc);
	doc.destroy();

	return {
		update: encryptYjsUpdate(rawUpdate, key),
		keyHash: createE2eeKeyHash(key),
	};
}

/** Baut ein unverschluesseltes Yjs-Update fuer serververwaltete Boards. */
export function createPlainElementsUpdate(elements: CanvasElement[]): string {
	const doc = new Y.Doc();
	const map = doc.getMap<Y.Map<unknown>>("elementsMap");
	doc.transact(() => {
		for (const element of elements) {
			map.set(
				element.id,
				objectToYMap(element as unknown as Record<string, unknown>),
			);
		}
	});
	const update = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
	doc.destroy();
	return update;
}

/**
 * Rekonstruiert den aktuellen Board-Zustand aus dem verschluesselten Update-Log.
 * Der MCP sieht Klartext nur lokal, nachdem ihm der echte Board-Key gegeben wurde.
 */
export function decryptBoardState(
	updates: Iterable<EncryptedBoardUpdate>,
	key: string,
): DecryptedBoardState {
	const doc = new Y.Doc();
	let appliedUpdates = 0;
	try {
		for (const [index, update] of Array.from(updates).entries()) {
			try {
				Y.applyUpdate(doc, decryptYjsUpdate(update.update, key));
				appliedUpdates += 1;
			} catch (error) {
				const updateLabel = update.id ?? String(index + 1);
				const message = error instanceof Error ? error.message : "UNKNOWN";
				throw new Error(
					`Board-Update ${updateLabel} konnte nicht entschluesselt werden: ${message}`,
				);
			}
		}

		return {
			elements: readCanvasElements(doc),
			views: readSavedViews(doc),
			appliedUpdates,
		};
	} finally {
		doc.destroy();
	}
}

/** Rekonstruiert serverseitig entschluesselte Base64-Yjs-Updates. */
export function readPlainBoardState(
	updates: Iterable<EncryptedBoardUpdate>,
): DecryptedBoardState {
	const doc = new Y.Doc();
	let appliedUpdates = 0;
	try {
		for (const [index, update] of Array.from(updates).entries()) {
			try {
				Y.applyUpdate(doc, Buffer.from(update.update, "base64"));
				appliedUpdates += 1;
			} catch (error) {
				const updateLabel = update.id ?? String(index + 1);
				const message = error instanceof Error ? error.message : "UNKNOWN";
				throw new Error(
					`Board-Update ${updateLabel} konnte nicht gelesen werden: ${message}`,
				);
			}
		}
		return {
			elements: readCanvasElements(doc),
			views: readSavedViews(doc),
			appliedUpdates,
		};
	} finally {
		doc.destroy();
	}
}
