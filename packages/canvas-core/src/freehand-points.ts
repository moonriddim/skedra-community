/**
 * Kompakte Speicherung von Freihand-Strichen.
 *
 * Pointer-Events liefern viele Punkte mit langen Nachkommastellen. Yjs speichert
 * solche Zahlen als 64-Bit-Float (9 Byte pro Wert); Vielfache von 1/16 passen
 * exakt in 32 Bit (5 Byte), ganze Zahlen noch kleiner. Zusätzlich werden Punkte
 * verworfen, die sich auf dem Bildschirm praktisch nicht bewegt haben. Beides
 * ist unsichtbar, macht einen Strich aber etwa halb so groß.
 */

/** Rasterweite in Canvas-Einheiten (1/16 px bei Zoom 1). */
export const FREEHAND_POINT_STEP = 1 / 16;

/** Mindestabstand zwischen zwei gespeicherten Punkten in Bildschirm-Pixeln. */
export const FREEHAND_MIN_SCREEN_DISTANCE = 0.5;

/** Rundet eine Koordinate auf das Raster; vermeidet `-0` im gespeicherten Wert. */
export function quantizeFreehandCoordinate(value: number) {
	const rounded = Math.round(value / FREEHAND_POINT_STEP) * FREEHAND_POINT_STEP;
	return rounded === 0 ? 0 : rounded;
}

/**
 * Hängt einen Punkt an einen laufenden Strich an, sofern er sich weit genug
 * vom letzten Punkt entfernt hat. Gibt `true` zurück, wenn der Punkt
 * gespeichert wurde (dann lohnt sich ein neues Vorschau-Rendering).
 *
 * @param zoom Aktueller Viewport-Zoom; bestimmt, wie klein „unsichtbar“ ist.
 */
export function appendFreehandPoint(
	points: [number, number][],
	x: number,
	y: number,
	zoom: number,
) {
	const next: [number, number] = [
		quantizeFreehandCoordinate(x),
		quantizeFreehandCoordinate(y),
	];
	const last = points.at(-1);
	if (last) {
		const minDistance = FREEHAND_MIN_SCREEN_DISTANCE / Math.max(zoom, 0.01);
		if (Math.hypot(next[0] - last[0], next[1] - last[1]) < minDistance) {
			return false;
		}
	}
	points.push(next);
	return true;
}
