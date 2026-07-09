/**
 * Y.js Canvas-State lesen/schreiben fuer die Public REST API.
 */

import { type CanvasElement, createStackIndexAfter } from "@skedra/canvas-core";
import type { AddCanvasElementInput } from "@skedra/shared";
import { decryptBytes, encryptBytes } from "@skedra/shared/server-crypto";
import * as Y from "yjs";
import { getYjsEncryptionOptions } from "./yjs-encryption";

const DEFAULT_STROKE = "#1e1e1e";

function yMapToObject(yMap: Y.Map<unknown>): Record<string, unknown> {
	const obj: Record<string, unknown> = {};
	yMap.forEach((value, key) => {
		obj[key] = value;
	});
	return obj;
}

function objectToYMap(obj: Record<string, unknown>): Y.Map<unknown> {
	const yMap = new Y.Map<unknown>();
	for (const [key, value] of Object.entries(obj)) {
		if (value === undefined) continue;
		yMap.set(key, value);
	}
	return yMap;
}

function loadDocFromState(yjsState: Uint8Array | null) {
	const doc = new Y.Doc();
	if (yjsState && yjsState.length > 0) {
		const decrypted = decryptBytes(yjsState, getYjsEncryptionOptions());
		Y.applyUpdate(doc, decrypted);
	}
	return doc;
}

function encodeDocState(doc: Y.Doc) {
	const update = Y.encodeStateAsUpdate(doc);
	return encryptBytes(Buffer.from(update), getYjsEncryptionOptions());
}

/** Liest alle Canvas-Elemente aus dem verschluesselten Y.js-State. */
export function readElementsFromYjsState(yjsState: Uint8Array | null) {
	const doc = loadDocFromState(yjsState);
	try {
		const yElements = doc.getMap<Y.Map<unknown>>("elementsMap");
		const elements: Record<string, unknown>[] = [];
		yElements.forEach((yEl, id) => {
			elements.push({ id, ...yMapToObject(yEl) });
		});
		return elements;
	} finally {
		doc.destroy();
	}
}

function normalizeElement(
	input: AddCanvasElementInput,
	stackIndex: string,
): Record<string, unknown> {
	const id = input.id ?? crypto.randomUUID();
	return {
		id,
		type: input.type,
		x: input.x,
		y: input.y,
		width: input.width,
		height: input.height,
		rotation: input.rotation ?? 0,
		fill: input.fill ?? "transparent",
		stroke: input.stroke ?? DEFAULT_STROKE,
		strokeWidth: input.strokeWidth ?? 2,
		strokeStyle: "solid",
		opacity: input.opacity ?? 100,
		locked: false,
		groupId: null,
		stackIndex: input.stackIndex ?? stackIndex,
		flipX: false,
		flipY: false,
		...(input.text !== undefined ? { text: input.text } : {}),
		...(input.fontSize !== undefined ? { fontSize: input.fontSize } : {}),
		...(input.customData !== undefined ? { customData: input.customData } : {}),
	};
}

/** Fuegt Elemente zum Board hinzu und gibt den neuen verschluesselten State zurueck. */
export function addElementsToYjsState(
	yjsState: Uint8Array | null,
	inputs: AddCanvasElementInput[],
) {
	const doc = loadDocFromState(yjsState);
	try {
		const yElements = doc.getMap<Y.Map<unknown>>("elementsMap");
		const orderItems: CanvasElement[] = [];
		yElements.forEach((yEl, id) => {
			orderItems.push(readStackOrderElement(yEl, id));
		});

		const created: Record<string, unknown>[] = [];

		doc.transact(() => {
			for (const input of inputs) {
				const id = input.id ?? crypto.randomUUID();
				const stackIndex =
					input.stackIndex ?? createStackIndexAfter(orderItems, id);
				const element = normalizeElement({ ...input, id }, stackIndex);
				const elementId = element.id as string;
				yElements.set(elementId, objectToYMap(element));
				created.push(element);
				orderItems.push(element as unknown as CanvasElement);
			}
		});

		return {
			state: encodeDocState(doc),
			elements: created,
		};
	} finally {
		doc.destroy();
	}
}

function readStackOrderElement(yEl: Y.Map<unknown>, id: string): CanvasElement {
	return {
		id,
		type: "rectangle",
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rotation: 0,
		fill: "transparent",
		stroke: DEFAULT_STROKE,
		strokeWidth: 1,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		stackIndex:
			typeof yEl.get("stackIndex") === "string"
				? (yEl.get("stackIndex") as string)
				: undefined,
		flipX: false,
		flipY: false,
	};
}

/** Aktualisiert ein Element im Y.js-State. */
export function updateElementInYjsState(
	yjsState: Uint8Array | null,
	elementId: string,
	updates: Record<string, unknown>,
) {
	const doc = loadDocFromState(yjsState);
	try {
		const yElements = doc.getMap<Y.Map<unknown>>("elementsMap");
		const yEl = yElements.get(elementId);
		if (!yEl) {
			return {
				state: encodeDocState(doc),
				element: null as Record<string, unknown> | null,
			};
		}

		doc.transact(() => {
			for (const [key, value] of Object.entries(updates)) {
				if (value === undefined) {
					yEl.delete(key);
					continue;
				}
				yEl.set(key, cloneYValue(value));
			}
		});

		const element = { id: elementId, ...yMapToObject(yEl) };
		return { state: encodeDocState(doc), element };
	} finally {
		doc.destroy();
	}
}

function cloneYValue(value: unknown): unknown {
	if (value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map((item) => cloneYValue(item));
	const copy: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
		copy[key] = cloneYValue(item);
	}
	return copy;
}

/** Loescht ein Element aus dem Y.js-State. */
export function deleteElementFromYjsState(
	yjsState: Uint8Array | null,
	elementId: string,
) {
	const doc = loadDocFromState(yjsState);
	try {
		const yElements = doc.getMap<Y.Map<unknown>>("elementsMap");
		const existed = yElements.has(elementId);
		if (existed) {
			doc.transact(() => {
				yElements.delete(elementId);
			});
		}
		return { state: encodeDocState(doc), deleted: existed };
	} finally {
		doc.destroy();
	}
}
