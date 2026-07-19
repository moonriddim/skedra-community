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
	type CanvasMutationPlan,
	type SavedCanvasView,
	applyCanvasMutationPlan,
	createStackIndexAfter,
} from "@skedra/canvas-core";
import {
	applyPartialUpdatesToYMap,
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

function createTopLevelElementChanges(
	before: CanvasElement,
	after: CanvasElement,
): Record<string, unknown> {
	const beforeRecord = before as unknown as Record<string, unknown>;
	const afterRecord = after as unknown as Record<string, unknown>;
	const changes: Record<string, unknown> = {};
	for (const key of new Set([
		...Object.keys(beforeRecord),
		...Object.keys(afterRecord),
	])) {
		if (
			JSON.stringify(beforeRecord[key]) === JSON.stringify(afterRecord[key])
		) {
			continue;
		}
		changes[key] = Object.hasOwn(afterRecord, key)
			? afterRecord[key]
			: undefined;
	}
	return changes;
}

function encodeCanvasMutation<T>(
	updates: Iterable<EncryptedBoardUpdate>,
	decode: (update: string) => Uint8Array,
	plan: CanvasMutationPlan,
	encode: (update: Uint8Array) => T,
): { update: T; changed: number } {
	const doc = new Y.Doc();
	try {
		for (const update of updates) Y.applyUpdate(doc, decode(update.update));
		const beforeVector = Y.encodeStateVector(doc);
		const yElements = doc.getMap<Y.Map<unknown>>("elementsMap");
		const current = readCanvasMapsFromYDoc(doc).elements;
		const stackContext = new Map(current);
		for (const id of plan.deleteIds) stackContext.delete(id);
		const preparedPlan: CanvasMutationPlan = {
			...plan,
			create: plan.create.map((element) => {
				const prepared = element.stackIndex
					? element
					: {
							...element,
							stackIndex: createStackIndexAfter(
								stackContext.values(),
								element.id,
							),
						};
				stackContext.set(prepared.id, prepared);
				return prepared;
			}),
		};
		const next = new Map(
			applyCanvasMutationPlan(Array.from(current.values()), preparedPlan).map(
				(element) => [element.id, element] as const,
			),
		);
		const changedIds = Array.from(
			new Set([...current.keys(), ...next.keys()]),
		).filter((id) => {
			const before = current.get(id);
			const after = next.get(id);
			return JSON.stringify(before) !== JSON.stringify(after);
		});

		if (changedIds.length === 0) {
			throw new Error("Die Canvas-Mutation hat keine Aenderung erzeugt.");
		}

		doc.transact(() => {
			for (const id of changedIds) {
				const before = current.get(id);
				const after = next.get(id);
				if (!after) {
					yElements.delete(id);
					continue;
				}
				const yElement = yElements.get(id);
				if (!before || !yElement) {
					yElements.set(id, objectToYMap(after));
					continue;
				}
				applyPartialUpdatesToYMap(
					yElement,
					createTopLevelElementChanges(before, after),
				);
			}
		});

		return {
			update: encode(Y.encodeStateAsUpdate(doc, beforeVector)),
			changed: changedIds.length,
		};
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

/** Applies an atomic semantic mutation to a server-managed board update log. */
export function createPlainCanvasMutationUpdate(
	updates: Iterable<EncryptedBoardUpdate>,
	plan: CanvasMutationPlan,
): { update: string; changed: number } {
	return encodeCanvasMutation(
		updates,
		(update) => Buffer.from(update, "base64"),
		plan,
		(update) => Buffer.from(update).toString("base64"),
	);
}

/** Applies and encrypts an atomic semantic mutation for an E2EE board. */
export function encryptCanvasMutationUpdate(
	updates: Iterable<EncryptedBoardUpdate>,
	key: string,
	plan: CanvasMutationPlan,
): { update: string; keyHash: string; changed: number } {
	const mutation = encodeCanvasMutation(
		updates,
		(update) => decryptYjsUpdate(update, key),
		plan,
		(update) => encryptYjsUpdate(update, key),
	);
	return { ...mutation, keyHash: createE2eeKeyHash(key) };
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
