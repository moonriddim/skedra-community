export function isMultiSelectModifier(event: {
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
}) {
	return event.ctrlKey || event.metaKey || event.shiftKey;
}

function pointInPolygon(
	x: number,
	y: number,
	polygon: [number, number][],
): boolean {
	if (polygon.length < 3) return false;

	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const [xi, yi] = polygon[i];
		const [xj, yj] = polygon[j];
		const intersects =
			yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
		if (intersects) inside = !inside;
	}
	return inside;
}

export function isLassoPathLargeEnough(points: [number, number][]): boolean {
	if (points.length < 3) return false;
	let length = 0;
	for (let i = 1; i < points.length; i++) {
		const dx = points[i][0] - points[i - 1][0];
		const dy = points[i][1] - points[i - 1][1];
		length += Math.hypot(dx, dy);
	}
	return length > 8;
}

export function elementMatchesLasso(
	bbox: { x: number; y: number; width: number; height: number },
	polygon: [number, number][],
): boolean {
	if (polygon.length < 3) return false;

	const centerX = bbox.x + bbox.width / 2;
	const centerY = bbox.y + bbox.height / 2;
	if (pointInPolygon(centerX, centerY, polygon)) return true;

	const corners: [number, number][] = [
		[bbox.x, bbox.y],
		[bbox.x + bbox.width, bbox.y],
		[bbox.x + bbox.width, bbox.y + bbox.height],
		[bbox.x, bbox.y + bbox.height],
	];
	for (const [x, y] of corners) {
		if (pointInPolygon(x, y, polygon)) return true;
	}

	for (const [x, y] of polygon) {
		if (
			x >= bbox.x &&
			x <= bbox.x + bbox.width &&
			y >= bbox.y &&
			y <= bbox.y + bbox.height
		) {
			return true;
		}
	}

	return false;
}

export function lassoPathToSvgD(points: [number, number][]): string | null {
	if (points.length < 2) return null;
	const [firstX, firstY] = points[0];
	let d = `M ${firstX} ${firstY}`;
	for (let i = 1; i < points.length; i++) {
		d += ` L ${points[i][0]} ${points[i][1]}`;
	}
	return `${d} Z`;
}
