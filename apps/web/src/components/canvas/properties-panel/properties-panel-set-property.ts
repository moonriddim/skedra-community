/**
 * Wendet eine Eigenschafts-Aenderung auf Selektion, Text-Edit oder Store an.
 */

import { buildTemplateSectionPaletteUpdates } from "@/lib/canvas/template-tool-utils";
import type { TemplateSectionMeta } from "@/lib/canvas/template-tool-utils";
import {
	FLOWCHART_NO_COLOR,
	FLOWCHART_YES_COLOR,
	buildMindmapBranchColorUpdates,
	getFlowchartConnectorMeta,
} from "@skedra/canvas-core";
import type {
	ArrowHead,
	ArrowMode,
	CanvasElement,
	RoughFillStyle,
	StrokeStyle,
} from "@skedra/canvas-core";
import type {
	CanvasEditorEditingText as EditingText,
	CanvasEditorPendingText as PendingText,
} from "@skedra/canvas-editor";

interface StoreDrawingDefaults {
	setStrokeColor: (color: string) => void;
	setFillColor: (color: string) => void;
	setStrokeWidth: (width: number) => void;
	setStrokeStyle: (style: StrokeStyle) => void;
	setCornerRadiusPercent: (percent: number) => void;
	setRoughness: (value: number) => void;
	setRoughFillStyle: (style: RoughFillStyle) => void;
	setRoughFillScale: (scale: number) => void;
	setArrowMode: (mode: ArrowMode) => void;
	setArrowHeadStart: (head: ArrowHead) => void;
	setArrowHeadEnd: (head: ArrowHead) => void;
	setArrowHeadScale: (scale: number) => void;
	setArrowHeadFilled: (filled: boolean) => void;
}

interface ApplyPropertyChangeOptions {
	key: keyof CanvasElement;
	value: unknown;
	pendingText?: PendingText | null;
	editingTextId?: string | null;
	hasSelection: boolean;
	selected: CanvasElement[];
	elements: Map<string, CanvasElement>;
	selectedTemplateSection: TemplateSectionMeta | null;
	mindmapBranchRoot: CanvasElement | null;
	onUpdatePendingText?: (updates: Partial<PendingText>) => void;
	onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
	onUpdateElements: (
		updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
	) => void;
	onUpdateEditingText?: (updates: Partial<EditingText>) => void;
	store: StoreDrawingDefaults;
}

function buildElementPropertyChange(
	el: CanvasElement,
	key: keyof CanvasElement,
	value: unknown,
): { id: string; changes: Partial<CanvasElement> } {
	const flowchartMeta = getFlowchartConnectorMeta(el);
	if (key !== "stroke" || !flowchartMeta) {
		return { id: el.id, changes: { [key]: value } };
	}

	const defaultLabelColor =
		flowchartMeta.flowchartBranchKind === "yes"
			? FLOWCHART_YES_COLOR
			: flowchartMeta.flowchartBranchKind === "no"
				? FLOWCHART_NO_COLOR
				: undefined;
	const labelFollowsStroke =
		el.textColor == null ||
		el.textColor === el.stroke ||
		el.textColor === defaultLabelColor;

	return {
		id: el.id,
		changes: {
			stroke: value as string,
			...(labelFollowsStroke ? { textColor: undefined } : {}),
		},
	};
}

function syncStoreDrawingDefault(
	store: StoreDrawingDefaults,
	key: keyof CanvasElement,
	value: unknown,
) {
	if (key === "stroke") store.setStrokeColor(value as string);
	else if (key === "fill") store.setFillColor(value as string);
	else if (key === "strokeWidth") store.setStrokeWidth(value as number);
	else if (key === "strokeStyle") store.setStrokeStyle(value as StrokeStyle);
	else if (key === "cornerRadiusPercent")
		store.setCornerRadiusPercent(value as number);
	else if (key === "roughness") store.setRoughness(value as number);
	else if (key === "roughFillStyle")
		store.setRoughFillStyle(value as RoughFillStyle);
	else if (key === "roughFillScale") store.setRoughFillScale(value as number);
	else if (key === "arrowMode") store.setArrowMode(value as ArrowMode);
	else if (key === "arrowHeadStart")
		store.setArrowHeadStart(value as ArrowHead);
	else if (key === "arrowHeadEnd") store.setArrowHeadEnd(value as ArrowHead);
	else if (key === "arrowHeadFilled")
		store.setArrowHeadFilled(value as boolean);
	else if (key === "arrowHeadScale") store.setArrowHeadScale(value as number);
}

export function applyPropertiesPanelPropertyChange({
	key,
	value,
	pendingText,
	editingTextId,
	hasSelection,
	selected,
	elements,
	selectedTemplateSection,
	mindmapBranchRoot,
	onUpdatePendingText,
	onUpdateElement,
	onUpdateElements,
	onUpdateEditingText,
	store,
}: ApplyPropertyChangeOptions) {
	const isTextEditingProperty =
		key === "textColor" ||
		key === "fontFamily" ||
		key === "fontSize" ||
		key === "textAlign" ||
		key === "fontWeight" ||
		key === "fontStyle" ||
		key === "textDecoration";

	if (pendingText && isTextEditingProperty) {
		onUpdatePendingText?.(
			(key === "textColor"
				? { textColor: value as string }
				: { [key]: value }) as Partial<PendingText>,
		);
	} else if (editingTextId && isTextEditingProperty) {
		onUpdateElement(editingTextId, { [key]: value });
		onUpdateEditingText?.({ [key]: value } as Partial<EditingText>);
	} else if (hasSelection) {
		if (key === "cornerRadiusPercent") {
			const percent = Math.min(100, Math.max(0, value as number));
			const updates = selected
				.filter((el) => el.type === "rectangle")
				.map((el) => ({
					id: el.id,
					changes: {
						cornerRadiusPercent: percent,
						cornerRadius: undefined,
					} as Partial<CanvasElement>,
				}));
			if (updates.length > 0) onUpdateElements(updates);
		} else {
			const updates =
				key === "stroke" && mindmapBranchRoot
					? buildMindmapBranchColorUpdates(
							selected[0],
							elements,
							value as string,
						)
					: (key === "stroke" || key === "fill") && selectedTemplateSection
						? buildTemplateSectionPaletteUpdates(selected[0], elements, {
								...(key === "stroke" ? { accent: value as string } : {}),
								...(key === "fill" ? { stickyColor: value as string } : {}),
							})
						: selected.map((el) => buildElementPropertyChange(el, key, value));
			onUpdateElements(updates);
		}
	}

	syncStoreDrawingDefault(store, key, value);
}
