/** Konfiguration fuer den Laserpointer — gleiche Logik wie Excalidraw (@excalidraw/laser-pointer). */

import { LaserPointer } from "@excalidraw/laser-pointer";
import type { LaserPointerOptions } from "@excalidraw/laser-pointer";
import type { LaserTrail } from "@skedra/canvas-core";

export const LASER_COLOR = "#ef4444";
const LASER_SIZE = 3;
const LASER_DECAY_MS = 1000;
const LASER_DECAY_LENGTH = 50;
export const LASER_MIN_POINT_DISTANCE = 1.5;

function average(a: number, b: number): number {
	return (a + b) / 2;
}

function easeOut(t: number): number {
	const clamped = Math.min(1, Math.max(0, t));
	return 1 - (1 - clamped) * (1 - clamped);
}

/** Excalidraw-kompatible sizeMapping: Tail fadet von hinten nach vorne + zeitlich. */
function laserSizeMapping(c: {
	pressure: number;
	currentIndex: number;
	totalLength: number;
}): number {
	const timeFade = Math.max(
		0,
		1 - (performance.now() - c.pressure) / LASER_DECAY_MS,
	);
	const lengthFade =
		(LASER_DECAY_LENGTH -
			Math.min(LASER_DECAY_LENGTH, c.totalLength - c.currentIndex)) /
		LASER_DECAY_LENGTH;
	return Math.min(easeOut(lengthFade), easeOut(timeFade));
}

function createLaserPointerOptions(
	active: boolean,
): Partial<LaserPointerOptions> {
	return {
		simplify: 0,
		streamline: 0.4,
		keepHead: active,
		sizeMapping: laserSizeMapping,
	};
}

/** Konvertiert Stroke-Outline-Punkte in einen SVG-Pfad (wie @excalidraw/common). */
function getSvgPathFromStroke(points: number[][], closed = true): string {
	const len = points.length;
	if (len < 4) return "";

	let a = points[0];
	let b = points[1];
	const c = points[2];

	let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} T`;

	for (let i = 2, max = len - 1; i < max; i++) {
		a = points[i];
		b = points[i + 1];
		result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `;
	}

	if (closed) result += "Z";
	return result;
}

/** Baut aus gespeicherten Trail-Punkten den gefuellten SVG-Pfad. */
export function trailToSvgPath(trail: LaserTrail, zoom: number): string {
	const pointer = new LaserPointer(createLaserPointerOptions(!trail.closed));

	for (const point of trail.points) {
		pointer.addPoint([point.x, point.y, point.t]);
	}

	if (trail.closed) {
		pointer.close();
	}

	const outline = pointer.getStrokeOutline(LASER_SIZE / zoom);
	if (outline.length < 4) return "";

	return getSvgPathFromStroke(outline.map(([x, y]) => [x, y]));
}

/** Prueft ob der Trail noch sichtbar ist (fuer Aufraeumen). */
export function isLaserTrailVisible(trail: LaserTrail, zoom: number): boolean {
	return trailToSvgPath(trail, zoom) !== "";
}
