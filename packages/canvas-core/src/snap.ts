import { type BBox, getBBox } from "./geometry";
import type { CanvasElement } from "./types";

const SNAP_THRESHOLD = 6;
const SNAP_POINT_THRESHOLD = 12;
const SNAP_POINT_VISIBILITY_DISTANCE = 28;

export type SnapAnchorKind =
	| "corner"
	| "edge-midpoint"
	| "center"
	| "endpoint"
	| "segment-midpoint";

export interface SnapPointOptions {
	includeCenters: boolean;
	includeMidpoints: boolean;
}

export interface SnapAnchor {
	elementId: string;
	kind: SnapAnchorKind;
	x: number;
	y: number;
}

export interface SnapPointIndicator extends SnapAnchor {
	active: boolean;
}

export interface SnapGuide {
	orientation: "h" | "v";
	pos: number;
	from: number;
	to: number;
}

export interface SnapResult {
	dx: number;
	dy: number;
	guides: SnapGuide[];
}

interface SnapPoint {
	pos: number;
	min: number;
	max: number;
}

function createAnchor(
	elementId: string,
	kind: SnapAnchorKind,
	x: number,
	y: number,
): SnapAnchor {
	return { elementId, kind, x, y };
}

function getPathAnchors(
	el: CanvasElement,
	options: SnapPointOptions,
): SnapAnchor[] {
	const points = el.points ?? [];
	if (points.length === 0) return [];

	const anchors: SnapAnchor[] = el.closed
		? []
		: [
				createAnchor(
					el.id,
					"endpoint",
					el.x + points[0][0],
					el.y + points[0][1],
				),
			];
	const lastPoint = points[points.length - 1];
	if (!el.closed && lastPoint && points.length > 1) {
		anchors.push(
			createAnchor(el.id, "endpoint", el.x + lastPoint[0], el.y + lastPoint[1]),
		);
	}

	if (!options.includeMidpoints || points.length < 2) {
		return anchors;
	}

	if (el.type === "arrow" && el.arrowMode === "curve" && points.length >= 3) {
		const [start, ctrl, end] = points;
		const t = 0.5;
		const mt = 1 - t;
		anchors.push(
			createAnchor(
				el.id,
				"segment-midpoint",
				el.x + mt * mt * start[0] + 2 * mt * t * ctrl[0] + t * t * end[0],
				el.y + mt * mt * start[1] + 2 * mt * t * ctrl[1] + t * t * end[1],
			),
		);
		return anchors;
	}

	const segmentCount = el.closed ? points.length : points.length - 1;
	for (let index = 0; index < segmentCount; index++) {
		const [x1, y1] = points[index];
		const [x2, y2] = points[(index + 1) % points.length];
		anchors.push(
			createAnchor(
				el.id,
				"segment-midpoint",
				el.x + (x1 + x2) / 2,
				el.y + (y1 + y2) / 2,
			),
		);
	}

	return anchors;
}

function getShapeAnchors(
	el: CanvasElement,
	options: SnapPointOptions,
): SnapAnchor[] {
	const bbox = getBBox(el);
	const left = bbox.x;
	const right = bbox.x + bbox.width;
	const top = bbox.y;
	const bottom = bbox.y + bbox.height;
	const centerX = bbox.x + bbox.width / 2;
	const centerY = bbox.y + bbox.height / 2;

	switch (el.type) {
		case "ellipse":
			return [
				createAnchor(el.id, "edge-midpoint", centerX, top),
				createAnchor(el.id, "edge-midpoint", right, centerY),
				createAnchor(el.id, "edge-midpoint", centerX, bottom),
				createAnchor(el.id, "edge-midpoint", left, centerY),
				...(options.includeCenters
					? [createAnchor(el.id, "center", centerX, centerY)]
					: []),
			];
		case "diamond":
			return [
				createAnchor(el.id, "corner", centerX, top),
				createAnchor(el.id, "corner", right, centerY),
				createAnchor(el.id, "corner", centerX, bottom),
				createAnchor(el.id, "corner", left, centerY),
				...(options.includeCenters
					? [createAnchor(el.id, "center", centerX, centerY)]
					: []),
			];
		default:
			return [
				createAnchor(el.id, "corner", left, top),
				createAnchor(el.id, "corner", right, top),
				createAnchor(el.id, "corner", right, bottom),
				createAnchor(el.id, "corner", left, bottom),
				...(options.includeMidpoints
					? [
							createAnchor(el.id, "edge-midpoint", centerX, top),
							createAnchor(el.id, "edge-midpoint", right, centerY),
							createAnchor(el.id, "edge-midpoint", centerX, bottom),
							createAnchor(el.id, "edge-midpoint", left, centerY),
						]
					: []),
				...(options.includeCenters
					? [createAnchor(el.id, "center", centerX, centerY)]
					: []),
			];
	}
}

function getElementSnapAnchors(
	el: CanvasElement,
	options: SnapPointOptions,
): SnapAnchor[] {
	if (el.type === "line" || el.type === "arrow" || el.type === "freehand") {
		return getPathAnchors(el, options);
	}
	return getShapeAnchors(el, options);
}

function distanceToBBoxPoint(bbox: BBox, x: number, y: number) {
	const dx = Math.max(bbox.x - x, 0, x - (bbox.x + bbox.width));
	const dy = Math.max(bbox.y - y, 0, y - (bbox.y + bbox.height));
	return Math.hypot(dx, dy);
}

function isSameAnchor(a: SnapAnchor, b: SnapAnchor) {
	return (
		a.elementId === b.elementId &&
		a.kind === b.kind &&
		a.x === b.x &&
		a.y === b.y
	);
}

function getSnapPoints(el: CanvasElement): { h: SnapPoint[]; v: SnapPoint[] } {
	const left = el.x;
	const right = el.x + el.width;
	const top = el.y;
	const bottom = el.y + el.height;
	const cx = el.x + el.width / 2;
	const cy = el.y + el.height / 2;

	return {
		v: [
			{ pos: left, min: top, max: bottom },
			{ pos: cx, min: top, max: bottom },
			{ pos: right, min: top, max: bottom },
		],
		h: [
			{ pos: top, min: left, max: right },
			{ pos: cy, min: left, max: right },
			{ pos: bottom, min: left, max: right },
		],
	};
}

function createMovingSnapElement(movingBBox: {
	x: number;
	y: number;
	width: number;
	height: number;
}): CanvasElement {
	return {
		...movingBBox,
		id: "",
		type: "rectangle",
		rotation: 0,
		fill: "",
		stroke: "",
		strokeWidth: 0,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
	};
}

export function calcSnap(
	movingBBox: { x: number; y: number; width: number; height: number },
	others: Map<string, CanvasElement>,
	excludeIds: Set<string>,
): SnapResult {
	const movingSnaps = getSnapPoints(createMovingSnapElement(movingBBox));

	let bestDx = Number.POSITIVE_INFINITY;
	let bestDy = Number.POSITIVE_INFINITY;
	const guides: SnapGuide[] = [];

	const otherSnapPoints: { h: SnapPoint[]; v: SnapPoint[] }[] = [];
	for (const [id, el] of others) {
		if (excludeIds.has(id)) continue;
		if (el.type === "freehand") continue;
		otherSnapPoints.push(getSnapPoints(el));
	}

	for (const mSnap of movingSnaps.v) {
		for (const oSnaps of otherSnapPoints) {
			for (const oSnap of oSnaps.v) {
				const diff = oSnap.pos - mSnap.pos;
				// Nur uebernehmen, wenn dieser Versatz strikt kleiner ist als der
				// bisher beste (das fruehere <= war redundant zum folgenden <).
				if (
					Math.abs(diff) < SNAP_THRESHOLD &&
					Math.abs(diff) < Math.abs(bestDx)
				) {
					bestDx = diff;
				}
			}
		}
	}

	for (const mSnap of movingSnaps.h) {
		for (const oSnaps of otherSnapPoints) {
			for (const oSnap of oSnaps.h) {
				const diff = oSnap.pos - mSnap.pos;
				// Nur uebernehmen, wenn dieser Versatz strikt kleiner ist als der
				// bisher beste (das fruehere <= war redundant zum folgenden <).
				if (
					Math.abs(diff) < SNAP_THRESHOLD &&
					Math.abs(diff) < Math.abs(bestDy)
				) {
					bestDy = diff;
				}
			}
		}
	}

	const snapDx = Math.abs(bestDx) <= SNAP_THRESHOLD ? bestDx : 0;
	const snapDy = Math.abs(bestDy) <= SNAP_THRESHOLD ? bestDy : 0;

	const snappedMoving = {
		...movingBBox,
		x: movingBBox.x + snapDx,
		y: movingBBox.y + snapDy,
	};
	const snappedSnaps = getSnapPoints(createMovingSnapElement(snappedMoving));

	if (snapDx !== 0) {
		for (const mSnap of snappedSnaps.v) {
			for (const oSnaps of otherSnapPoints) {
				for (const oSnap of oSnaps.v) {
					if (Math.abs(oSnap.pos - mSnap.pos) < 0.5) {
						guides.push({
							orientation: "v",
							pos: oSnap.pos,
							from: Math.min(mSnap.min, oSnap.min),
							to: Math.max(mSnap.max, oSnap.max),
						});
					}
				}
			}
		}
	}

	if (snapDy !== 0) {
		for (const mSnap of snappedSnaps.h) {
			for (const oSnaps of otherSnapPoints) {
				for (const oSnap of oSnaps.h) {
					if (Math.abs(oSnap.pos - mSnap.pos) < 0.5) {
						guides.push({
							orientation: "h",
							pos: oSnap.pos,
							from: Math.min(mSnap.min, oSnap.min),
							to: Math.max(mSnap.max, oSnap.max),
						});
					}
				}
			}
		}
	}

	return { dx: snapDx, dy: snapDy, guides };
}

export function findClosestSnapAnchor(
	point: { x: number; y: number },
	others: Map<string, CanvasElement>,
	excludeIds: Set<string>,
	options: SnapPointOptions,
	threshold = SNAP_POINT_THRESHOLD,
): SnapAnchor | null {
	let bestAnchor: SnapAnchor | null = null;
	let bestDistance = threshold;

	for (const [id, el] of others) {
		if (excludeIds.has(id) || el.locked) continue;

		for (const anchor of getElementSnapAnchors(el, options)) {
			const distance = Math.hypot(anchor.x - point.x, anchor.y - point.y);
			if (distance <= bestDistance) {
				bestDistance = distance;
				bestAnchor = anchor;
			}
		}
	}

	return bestAnchor;
}

export function getVisibleSnapPointIndicators(
	point: { x: number; y: number },
	others: Map<string, CanvasElement>,
	excludeIds: Set<string>,
	options: SnapPointOptions,
	activeAnchor: SnapAnchor | null,
	showInactivePoints: boolean,
): SnapPointIndicator[] {
	if (!showInactivePoints && !activeAnchor) return [];

	let anchorSource: CanvasElement | null = null;

	if (activeAnchor) {
		anchorSource = others.get(activeAnchor.elementId) ?? null;
	}

	if (!anchorSource && showInactivePoints) {
		let closest: { distance: number; element: CanvasElement } | null = null;

		for (const [id, el] of others) {
			if (excludeIds.has(id) || el.locked) continue;
			const distance = distanceToBBoxPoint(getBBox(el), point.x, point.y);
			if (distance > SNAP_POINT_VISIBILITY_DISTANCE) continue;
			if (!closest || distance < closest.distance) {
				closest = { distance, element: el };
			}
		}

		anchorSource = closest?.element ?? null;
	}

	const indicators = anchorSource
		? getElementSnapAnchors(anchorSource, options).map((anchor) => ({
				...anchor,
				active: activeAnchor ? isSameAnchor(anchor, activeAnchor) : false,
			}))
		: [];

	if (
		activeAnchor &&
		!indicators.some((indicator) => isSameAnchor(indicator, activeAnchor))
	) {
		indicators.push({ ...activeAnchor, active: true });
	}

	return indicators;
}
