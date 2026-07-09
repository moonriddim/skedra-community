/**
 * Pointer-Geste nach PointerUp zuruecksetzen.
 */

import type { PointerState } from "./pointer-types";

export function resetPointerGestureState(
	stateRef: React.MutableRefObject<PointerState>,
): void {
	stateRef.current.action = "none";
	stateRef.current.resizeHandle = null;
	stateRef.current.resizeStartBBox = null;
	stateRef.current.dragPointElementId = null;
	stateRef.current.dragPointIndex = -1;
	stateRef.current.drawFromCenter = false;
	stateRef.current.erasedIds = new Set();
	stateRef.current.laserTrailId = null;
}
