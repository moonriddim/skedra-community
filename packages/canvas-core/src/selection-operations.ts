import { createStackIndexAfter, createStackIndexBefore } from "./ordering";
import type { CanvasElement } from "./types";

export type CanvasFlipAxis = "horizontal" | "vertical";

export interface CanvasClipboardCloneResult {
	elements: CanvasElement[];
	idMap: Map<string, string>;
}

export function getGroupUpdates(
	elements: readonly CanvasElement[],
	groupId: string | null,
) {
	return elements.map((element) => ({
		id: element.id,
		changes: { groupId },
	}));
}

export function getFlipUpdates(
	elements: readonly CanvasElement[],
	axis: CanvasFlipAxis,
) {
	return elements.map((element) => ({
		id: element.id,
		changes:
			axis === "horizontal"
				? { flipX: !element.flipX }
				: { flipY: !element.flipY },
	}));
}

export function getLockUpdates(
	elements: readonly CanvasElement[],
	locked?: boolean,
) {
	const nextLocked = locked ?? !elements.every((element) => element.locked);
	return elements.map((element) => ({
		id: element.id,
		changes: { locked: nextLocked },
	}));
}

/**
 * Clones a complete selection and remaps references that point inside it.
 * Frames, groups, mindmaps and flowcharts therefore survive copy/paste intact.
 */
export function cloneCanvasSelection(options: {
	elements: readonly CanvasElement[];
	existingElements?: Iterable<CanvasElement>;
	createId: () => string;
	offset?: { x: number; y: number };
}): CanvasClipboardCloneResult {
	const offset = options.offset ?? { x: 20, y: 20 };
	const idMap = new Map(
		options.elements.map((element) => [element.id, options.createId()]),
	);
	const groupMap = new Map<string, string>();
	const logicalIdMap = new Map<string, string>();
	for (const element of options.elements) {
		for (const key of [
			"flowchartId",
			"mindmapTreeId",
			"templateSectionId",
		] as const) {
			const value = element.customData?.[key];
			if (typeof value === "string" && !logicalIdMap.has(value)) {
				logicalIdMap.set(value, options.createId());
			}
		}
	}
	const stackBase = Array.from(options.existingElements ?? []);
	const elements = options.elements.map((element) => {
		const id = idMap.get(element.id) ?? options.createId();
		const groupId = element.groupId
			? getOrCreateRemappedId(groupMap, element.groupId, options.createId)
			: null;
		const customData = remapCustomDataReferences(
			element.customData,
			idMap,
			logicalIdMap,
		);
		const clone: CanvasElement = {
			...element,
			id,
			x: element.x + offset.x,
			y: element.y + offset.y,
			groupId,
			frameId: element.frameId
				? (idMap.get(element.frameId) ?? element.frameId)
				: undefined,
			stackIndex: createStackIndexAfter(stackBase, id),
			customData,
		};
		stackBase.push(clone);
		return clone;
	});
	return { elements, idMap };
}

export function createSelectionFrame(options: {
	elements: readonly CanvasElement[];
	existingElements: Iterable<CanvasElement>;
	createId: () => string;
	padding?: number;
	label?: string;
	stroke?: string;
}): {
	frame: CanvasElement;
	updates: Array<{ id: string; changes: Partial<CanvasElement> }>;
} | null {
	if (options.elements.length === 0) return null;
	const padding = options.padding ?? 30;
	const minX = Math.min(...options.elements.map((element) => element.x));
	const minY = Math.min(...options.elements.map((element) => element.y));
	const maxX = Math.max(
		...options.elements.map((element) => element.x + element.width),
	);
	const maxY = Math.max(
		...options.elements.map((element) => element.y + element.height),
	);
	const id = options.createId();
	const frame: CanvasElement = {
		id,
		type: "frame",
		x: minX - padding,
		y: minY - padding,
		width: maxX - minX + padding * 2,
		height: maxY - minY + padding * 2,
		rotation: 0,
		fill: "transparent",
		stroke: options.stroke ?? "#6366f1",
		strokeWidth: 1.5,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		stackIndex: createStackIndexBefore(options.existingElements, id),
		flipX: false,
		flipY: false,
		frameLabel: options.label ?? "Frame",
	};
	return {
		frame,
		updates: options.elements.map((element) => ({
			id: element.id,
			changes: { frameId: id },
		})),
	};
}

function getOrCreateRemappedId(
	map: Map<string, string>,
	value: string,
	createId: () => string,
) {
	const existing = map.get(value);
	if (existing) return existing;
	const next = createId();
	map.set(value, next);
	return next;
}

function remapCustomDataReferences(
	customData: Record<string, unknown> | undefined,
	idMap: Map<string, string>,
	logicalIdMap: Map<string, string>,
) {
	if (!customData) return undefined;
	const remapped = structuredCloneSafe(customData);
	for (const key of [
		"flowchartSourceId",
		"flowchartTargetId",
		"mindmapParentId",
		"mindmapSourceId",
		"mindmapTargetId",
	]) {
		const current = remapped[key];
		if (typeof current === "string" && idMap.has(current)) {
			remapped[key] = idMap.get(current);
		}
	}
	for (const key of ["flowchartId", "mindmapTreeId", "templateSectionId"]) {
		const current = remapped[key];
		if (typeof current === "string" && logicalIdMap.has(current)) {
			remapped[key] = logicalIdMap.get(current);
		}
	}
	return remapped;
}

function structuredCloneSafe<T>(value: T): T {
	if (typeof structuredClone === "function") return structuredClone(value);
	return JSON.parse(JSON.stringify(value)) as T;
}
