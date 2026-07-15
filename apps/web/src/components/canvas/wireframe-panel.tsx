/** Community adapter for the shared wireframe catalog. */

import { TOOL_FONT_FAMILY } from "@/lib/canvas/canvas-defaults";
import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import { useI18n } from "@/lib/i18n";
import { templateText } from "@/lib/templates/shared";
import {
	type CanvasElement,
	createWireframeComponentElements,
	createWireframePresetElements,
} from "@skedra/canvas-core";
import { CanvasEditorWireframePanel } from "@skedra/canvas-editor";

interface WireframePanelProps {
	elements: Map<string, CanvasElement>;
	selectedElements: CanvasElement[];
	onInsertElements: (elements: CanvasElement[]) => void;
	onFitElements: (elements: CanvasElement[]) => void;
	getViewportCenter: () => { x: number; y: number };
	onClose: () => void;
}

export function WireframePanel({
	elements,
	selectedElements,
	onInsertElements,
	onFitElements,
	getViewportCenter,
	onClose,
}: WireframePanelProps) {
	const { t } = useI18n();

	return (
		<CanvasEditorWireframePanel
			elements={elements}
			selectedElements={selectedElements}
			translate={(key, fallback) => {
				const translated = t(key);
				return translated === key ? fallback : translated;
			}}
			onInsertPreset={(preset) => {
				const center = getViewportCenter();
				const created = createWireframePresetElements({
					preset,
					x: center.x,
					y: center.y,
					defaults: getCanvasElementFactoryDefaults(),
					fontFamily: TOOL_FONT_FAMILY,
					text: templateText,
				});
				onInsertElements(created);
				onFitElements(created);
			}}
			onInsertComponent={(component, target) => {
				const point = target?.point ?? getViewportCenter();
				onInsertElements(
					createWireframeComponentElements({
						component,
						x: point.x,
						y: point.y,
						frameId: target?.frameId,
						viewport: target?.viewport,
						defaults: getCanvasElementFactoryDefaults(),
						fontFamily: TOOL_FONT_FAMILY,
						text: templateText,
					}),
				);
			}}
			onClose={onClose}
		/>
	);
}
