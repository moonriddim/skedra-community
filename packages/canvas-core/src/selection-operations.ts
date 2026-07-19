import { getCornerRadiusPercent } from "./corner-radius";
import { getCombinedBBox } from "./geometry";
import { createStackIndexAfter, createStackIndexBefore } from "./ordering";
import {
	DEFAULT_CLOUD_ARC_RADIUS,
	buildCloudArcRadiusChanges,
} from "./shape-geometry";
import type { CanvasElement } from "./types";

export type CanvasFlipAxis = "horizontal" | "vertical";

export interface CanvasClipboardCloneResult {
	elements: CanvasElement[];
	idMap: Map<string, string>;
}

export type CanvasSelectionTransform =
	| { type: "flip"; axis: CanvasFlipAxis }
	| { type: "rotate"; angle: number };

/** Host-neutral format clipboard shared by Community and the React SDK. */
export interface CanvasElementFormat {
	stroke?: string;
	fill?: string;
	strokeWidth?: number;
	strokeStyle?: CanvasElement["strokeStyle"];
	opacity?: number;
	cornerRadiusPercent?: number;
	arrowHeadScale?: number;
	arrowHeadFilled?: boolean;
	cloudArcRadius?: number;
	fontSize?: number;
	fontFamily?: string;
}

export function getCanvasElementFormat(
	element: CanvasElement,
): CanvasElementFormat {
	return {
		stroke: element.stroke,
		fill: element.fill,
		strokeWidth: element.strokeWidth,
		strokeStyle: element.strokeStyle,
		opacity: element.opacity,
		cornerRadiusPercent:
			element.type === "rectangle"
				? getCornerRadiusPercent(element)
				: undefined,
		arrowHeadScale:
			element.type === "arrow" ? (element.arrowHeadScale ?? 1) : undefined,
		arrowHeadFilled:
			element.type === "arrow" ? (element.arrowHeadFilled ?? true) : undefined,
		cloudArcRadius:
			element.type === "cloud"
				? (element.cloudArcRadius ?? DEFAULT_CLOUD_ARC_RADIUS)
				: undefined,
		fontSize: element.fontSize,
		fontFamily: element.fontFamily,
	};
}

/** Builds all format-paste mutations without depending on host storage. */
export function buildCanvasElementFormatUpdates(
	elements: readonly CanvasElement[],
	format: CanvasElementFormat,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	return elements.map((element) => ({
		id: element.id,
		changes: {
			stroke: format.stroke,
			fill: format.fill,
			strokeWidth: format.strokeWidth,
			strokeStyle: format.strokeStyle,
			opacity: format.opacity,
			...(element.type === "rectangle" &&
			format.cornerRadiusPercent !== undefined
				? {
						cornerRadiusPercent: format.cornerRadiusPercent,
						cornerRadius: undefined,
					}
				: {}),
			...(element.type === "arrow" && format.arrowHeadScale !== undefined
				? { arrowHeadScale: format.arrowHeadScale }
				: {}),
			...(element.type === "arrow" && format.arrowHeadFilled !== undefined
				? { arrowHeadFilled: format.arrowHeadFilled }
				: {}),
			...(element.type === "cloud" && format.cloudArcRadius !== undefined
				? buildCloudArcRadiusChanges(element, format.cloudArcRadius)
				: {}),
			...(element.fontSize !== undefined && format.fontSize !== undefined
				? { fontSize: format.fontSize }
				: {}),
			...(element.fontFamily !== undefined && format.fontFamily !== undefined
				? { fontFamily: format.fontFamily }
				: {}),
		},
	}));
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
	basePoint?: { x: number; y: number },
) {
	const unlocked = elements.filter((element) => !element.locked);
	const bounds = getCombinedBBox(unlocked);
	if (!bounds) return [];
	const mirrorX = basePoint?.x ?? bounds.x + bounds.width / 2;
	const mirrorY = basePoint?.y ?? bounds.y + bounds.height / 2;

	return unlocked.map((element) => ({
		id: element.id,
		changes:
			axis === "horizontal"
				? {
						x:
							mirrorX * 2 - (element.x + element.width / 2) - element.width / 2,
						flipX: !element.flipX,
						rotation: normalizeCanvasRotation(-element.rotation),
					}
				: {
						y:
							mirrorY * 2 -
							(element.y + element.height / 2) -
							element.height / 2,
						flipY: !element.flipY,
						rotation: normalizeCanvasRotation(-element.rotation),
					},
	}));
}

export function normalizeCanvasRotation(rotation: number): number {
	const normalized = rotation % 360;
	if (Object.is(normalized, -0)) return 0;
	return normalized < 0 ? normalized + 360 : normalized;
}

export function getRotateUpdates(
	elements: readonly CanvasElement[],
	angleDelta: number,
	basePoint?: { x: number; y: number },
) {
	const unlocked = elements.filter((element) => !element.locked);
	const bounds = getCombinedBBox(unlocked);
	if (!bounds) return [];
	const base =
		basePoint ??
		({
			x: bounds.x + bounds.width / 2,
			y: bounds.y + bounds.height / 2,
		} as const);
	const radians = (angleDelta * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);

	return unlocked.map((element) => {
		const centerX = element.x + element.width / 2;
		const centerY = element.y + element.height / 2;
		const dx = centerX - base.x;
		const dy = centerY - base.y;
		const nextCenterX = base.x + dx * cos - dy * sin;
		const nextCenterY = base.y + dx * sin + dy * cos;
		return {
			id: element.id,
			changes: {
				x: nextCenterX - element.width / 2,
				y: nextCenterY - element.height / 2,
				rotation: normalizeCanvasRotation(element.rotation + angleDelta),
			},
		};
	});
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
			"ganttChartId",
			"ganttTaskId",
			"mindmapTreeId",
			"sequenceDiagramId",
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

/**
 * Clones and transforms a selection as one host-neutral operation. Clones are
 * temporarily treated as unlocked so locked source artwork can still produce
 * a transformed copy while preserving its persisted lock state.
 */
export function cloneTransformedCanvasSelection(options: {
	elements: readonly CanvasElement[];
	existingElements?: Iterable<CanvasElement>;
	createId: () => string;
	transform: CanvasSelectionTransform;
	origin?: { x: number; y: number };
}): CanvasClipboardCloneResult {
	const cloned = cloneCanvasSelection({
		elements: options.elements,
		existingElements: options.existingElements,
		createId: options.createId,
		offset: { x: 0, y: 0 },
	});
	const transformable = cloned.elements.map((element) => ({
		...element,
		locked: false,
	}));
	const transformOrigin =
		options.origin ??
		(options.transform.type === "flip"
			? getAdjacentMirrorOrigin(transformable, options.transform.axis)
			: undefined);
	const updates =
		options.transform.type === "flip"
			? getFlipUpdates(transformable, options.transform.axis, transformOrigin)
			: getRotateUpdates(
					transformable,
					options.transform.angle,
					transformOrigin,
				);
	const changesById = new Map(
		updates.map((update) => [update.id, update.changes]),
	);
	return {
		...cloned,
		elements: cloned.elements.map((element) => ({
			...element,
			...changesById.get(element.id),
		})),
	};
}

function getAdjacentMirrorOrigin(
	elements: readonly CanvasElement[],
	axis: CanvasFlipAxis,
) {
	const bounds = getCombinedBBox([...elements]);
	if (!bounds) return undefined;
	return axis === "horizontal"
		? {
				x: bounds.x + bounds.width,
				y: bounds.y + bounds.height / 2,
			}
		: {
				x: bounds.x + bounds.width / 2,
				y: bounds.y + bounds.height,
			};
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
	for (const key of [
		"flowchartId",
		"ganttChartId",
		"ganttTaskId",
		"ganttSourceTaskId",
		"ganttTargetTaskId",
		"mindmapTreeId",
		"sequenceDiagramId",
		"templateSectionId",
	]) {
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
