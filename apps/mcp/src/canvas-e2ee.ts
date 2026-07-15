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
import type { CanvasElement, SavedCanvasView } from "@skedra/canvas-core";
import {
	objectToYMap,
	readCanvasMapsFromYDoc,
} from "@skedra/canvas-io/yjs-document";
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

/** Reads the canonical Web-compatible Canvas state from a Y.Doc. */
function readBoardState(doc: Y.Doc) {
	const state = readCanvasMapsFromYDoc(doc);
	return {
		elements: Array.from(state.elements.values()),
		views: Array.from(state.views.values()).sort((a, b) =>
			a.name.localeCompare(b.name),
		),
	};
}

function encodeElementsDocument<T>(
	elements: CanvasElement[],
	encode: (update: Uint8Array) => T,
): T {
	const doc = new Y.Doc();
	try {
		const map = doc.getMap<Y.Map<unknown>>("elementsMap");
		doc.transact(() => {
			for (const element of elements) {
				map.set(
					element.id,
					objectToYMap(element as unknown as Record<string, unknown>),
				);
			}
		});
		return encode(Y.encodeStateAsUpdate(doc));
	} finally {
		doc.destroy();
	}
}

function readBoardUpdates(
	updates: Iterable<EncryptedBoardUpdate>,
	decode: (update: string) => Uint8Array,
	failure: "entschluesselt" | "gelesen",
): DecryptedBoardState {
	const doc = new Y.Doc();
	let appliedUpdates = 0;
	try {
		for (const [index, update] of Array.from(updates).entries()) {
			try {
				Y.applyUpdate(doc, decode(update.update));
				appliedUpdates += 1;
			} catch (error) {
				const updateLabel = update.id ?? String(index + 1);
				const message = error instanceof Error ? error.message : "UNKNOWN";
				throw new Error(
					`Board-Update ${updateLabel} konnte nicht ${failure} werden: ${message}`,
				);
			}
		}
		return { ...readBoardState(doc), appliedUpdates };
	} finally {
		doc.destroy();
	}
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
	return {
		update: encodeElementsDocument(elements, (update) =>
			encryptYjsUpdate(update, key),
		),
		keyHash: createE2eeKeyHash(key),
	};
}

/** Baut ein unverschluesseltes Yjs-Update fuer serververwaltete Boards. */
export function createPlainElementsUpdate(elements: CanvasElement[]): string {
	return encodeElementsDocument(elements, (update) =>
		Buffer.from(update).toString("base64"),
	);
}

/**
 * Rekonstruiert den aktuellen Board-Zustand aus dem verschluesselten Update-Log.
 * Der MCP sieht Klartext nur lokal, nachdem ihm der echte Board-Key gegeben wurde.
 */
export function decryptBoardState(
	updates: Iterable<EncryptedBoardUpdate>,
	key: string,
): DecryptedBoardState {
	return readBoardUpdates(
		updates,
		(update) => decryptYjsUpdate(update, key),
		"entschluesselt",
	);
}

/** Rekonstruiert serverseitig entschluesselte Base64-Yjs-Updates. */
export function readPlainBoardState(
	updates: Iterable<EncryptedBoardUpdate>,
): DecryptedBoardState {
	return readBoardUpdates(
		updates,
		(update) => Buffer.from(update, "base64"),
		"gelesen",
	);
}
