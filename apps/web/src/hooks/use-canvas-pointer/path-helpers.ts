import type { CanvasElement } from "@skedra/canvas-core";

import type { useCanvasStore } from "../use-canvas-store";

type CanvasStoreState = ReturnType<typeof useCanvasStore.getState>;

export function dedupeSequentialPoints(
	points: [number, number][],
): [number, number][] {
	return points.filter((point, index) => {
		if (index === 0) return true;
		const previous = points[index - 1];
		return previous[0] !== point[0] || previous[1] !== point[1];
	});
}

function getPolylineBounds(points: [number, number][]) {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const [x, y] of points) {
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	};
}

function toRelativePoints(points: [number, number][]) {
	const bounds = getPolylineBounds(points);
	return {
		...bounds,
		points: points.map(
			([x, y]) => [x - bounds.x, y - bounds.y] as [number, number],
		),
	};
}

export function buildPathPreview(
	tool: "line" | "arrow",
	absolutePoints: [number, number][],
	store: CanvasStoreState,
): CanvasElement {
	const { x, y, width, height, points } = toRelativePoints(
		dedupeSequentialPoints(absolutePoints),
	);
	return {
		id: "__preview",
		type: tool,
		x,
		y,
		width,
		height,
		rotation: 0,
		fill: "transparent",
		stroke: store.strokeColor,
		strokeWidth: store.strokeWidth,
		strokeStyle: store.strokeStyle,
		roughness: store.roughness,
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		points,
		...(tool === "arrow"
			? {
					arrowMode: store.arrowMode,
					arrowHeadStart: store.arrowHeadStart,
					arrowHeadEnd: store.arrowHeadEnd,
					arrowHeadScale: store.arrowHeadScale,
				}
			: {}),
	};
}

export function buildPathElement(
	tool: "line" | "arrow",
	absolutePoints: [number, number][],
	store: CanvasStoreState,
): Omit<CanvasElement, "id"> {
	const preview = buildPathPreview(tool, absolutePoints, store);
	return { ...preview };
}

export function appendPreviewPoint(
	points: [number, number][],
	hoverPoint: [number, number],
	mode?: CanvasElement["arrowMode"],
): [number, number][] {
	if (mode === "elbow") {
		return appendElbowSegment(points, hoverPoint, true);
	}
	return [...points, hoverPoint];
}

export function commitPathPoint(
	points: [number, number][],
	nextPoint: [number, number],
	mode?: CanvasElement["arrowMode"],
): [number, number][] {
	if (mode === "elbow") {
		return dedupeSequentialPoints(appendElbowSegment(points, nextPoint, false));
	}
	return dedupeSequentialPoints([...points, nextPoint]);
}

function appendElbowSegment(
	points: [number, number][],
	nextPoint: [number, number],
	includePreviewTail: boolean,
): [number, number][] {
	const lastPoint = points[points.length - 1];
	if (!lastPoint)
		return includePreviewTail ? [nextPoint, nextPoint] : [nextPoint];
	const relX = nextPoint[0] - lastPoint[0];
	const relY = nextPoint[1] - lastPoint[1];
	const segmentPoints = computeElbowPoints(relX, relY)
		.slice(1)
		.map(([x, y]) => [lastPoint[0] + x, lastPoint[1] + y] as [number, number]);
	const merged = [...points, ...segmentPoints];
	if (!includePreviewTail) return merged;
	const committed = dedupeSequentialPoints(merged);
	const tail = committed[committed.length - 1] ?? nextPoint;
	return [...committed, tail];
}

export function computeElbowPoints(
	relX: number,
	relY: number,
): [number, number][] {
	const midX = relX / 2;
	const midY = relY / 2;
	const absDx = Math.abs(relX);
	const absDy = Math.abs(relY);
	if (absDx > absDy) {
		return [
			[0, 0],
			[midX, 0],
			[midX, relY],
			[relX, relY],
		];
	}
	return [
		[0, 0],
		[0, midY],
		[relX, midY],
		[relX, relY],
	];
}
