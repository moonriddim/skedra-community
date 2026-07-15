import { useCanvasStore } from "@/hooks/use-canvas-store";
import { useI18n } from "@/lib/i18n";
import type { CanvasObjectSnapMode } from "@skedra/canvas-core";
import { CanvasEditorSnapMenu } from "@skedra/canvas-editor";
import { useShallow } from "zustand/react/shallow";

/** Floating one-shot snap override opened with Shift + right-click. */
export function CanvasSnapMenuOverlay() {
	const { t } = useI18n();
	const state = useCanvasStore(
		useShallow((store) => ({
			snapToObjects: store.snapToObjects,
			toggleSnapToObjects: store.toggleSnapToObjects,
			showSnapPoints: store.showSnapPoints,
			toggleShowSnapPoints: store.toggleShowSnapPoints,
			snapMenu: store.snapMenu,
			setSnapMenu: store.setSnapMenu,
			setSnapOverrideMode: store.setSnapOverrideMode,
			snapToEndpoints: store.snapToEndpoints,
			toggleSnapToEndpoints: store.toggleSnapToEndpoints,
			snapToMidpoints: store.snapToMidpoints,
			toggleSnapToMidpoints: store.toggleSnapToMidpoints,
			snapToDivisions: store.snapToDivisions,
			toggleSnapToDivisions: store.toggleSnapToDivisions,
			snapDivisionCount: store.snapDivisionCount,
			setSnapDivisionCount: store.setSnapDivisionCount,
			snapToCenters: store.snapToCenters,
			toggleSnapToCenters: store.toggleSnapToCenters,
			snapToGeometricCenters: store.snapToGeometricCenters,
			toggleSnapToGeometricCenters: store.toggleSnapToGeometricCenters,
			snapToQuadrants: store.snapToQuadrants,
			toggleSnapToQuadrants: store.toggleSnapToQuadrants,
			snapToIntersections: store.snapToIntersections,
			toggleSnapToIntersections: store.toggleSnapToIntersections,
			snapToExtensions: store.snapToExtensions,
			toggleSnapToExtensions: store.toggleSnapToExtensions,
			snapToInsertions: store.snapToInsertions,
			toggleSnapToInsertions: store.toggleSnapToInsertions,
			snapToNearest: store.snapToNearest,
			toggleSnapToNearest: store.toggleSnapToNearest,
		})),
	);
	if (!state.snapMenu) return null;

	const snapModes = {
		endpoint: state.snapToEndpoints,
		midpoint: state.snapToMidpoints,
		division: state.snapToDivisions,
		center: state.snapToCenters,
		"geometric-center": state.snapToGeometricCenters,
		quadrant: state.snapToQuadrants,
		intersection: state.snapToIntersections,
		extension: state.snapToExtensions,
		insertion: state.snapToInsertions,
		nearest: state.snapToNearest,
	} satisfies Record<CanvasObjectSnapMode, boolean>;
	const toggles = {
		endpoint: state.toggleSnapToEndpoints,
		midpoint: state.toggleSnapToMidpoints,
		division: state.toggleSnapToDivisions,
		center: state.toggleSnapToCenters,
		"geometric-center": state.toggleSnapToGeometricCenters,
		quadrant: state.toggleSnapToQuadrants,
		intersection: state.toggleSnapToIntersections,
		extension: state.toggleSnapToExtensions,
		insertion: state.toggleSnapToInsertions,
		nearest: state.toggleSnapToNearest,
	} satisfies Record<CanvasObjectSnapMode, () => void>;

	return (
		<CanvasEditorSnapMenu
			x={state.snapMenu.x}
			y={state.snapMenu.y}
			kind={state.snapMenu.kind}
			enabled={state.snapToObjects}
			modes={snapModes}
			showPoints={state.showSnapPoints}
			divisionCount={state.snapDivisionCount}
			translate={(key, fallback) => {
				const translated = t(key);
				return translated === key ? fallback : translated;
			}}
			onToggleEnabled={state.toggleSnapToObjects}
			onToggleMode={(mode) => toggles[mode]()}
			onToggleShowPoints={state.toggleShowSnapPoints}
			onDivisionCountChange={state.setSnapDivisionCount}
			onSelectOverride={state.setSnapOverrideMode}
			onClose={() => state.setSnapMenu(null)}
		/>
	);
}
