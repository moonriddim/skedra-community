import {
	CanvasEditorPropertiesPanel,
	type CanvasEditorPropertiesPanelProps,
} from "@skedra/canvas-editor";
import type { CSSProperties } from "react";
import type {
	SkedraAlignment,
	SkedraDistribution,
	SkedraFlowchartStepOptions,
	SkedraKanbanCardDetails,
	SkedraLayerCommand,
} from "./commands.js";
import type { CanvasElement } from "./types.js";

/** Public, self-contained properties contract for the bundled React SDK. */
export interface SkedraPropertiesPanelProps {
	selected: CanvasElement[];
	mode?: "selection" | "defaults";
	readOnly?: boolean;
	className?: string;
	style?: CSSProperties;
	ariaLabel?: string;
	translate?: (key: string, fallback: string) => string;
	canvasBackground?: {
		value: string;
		options: readonly string[];
		onChange: (value: string) => void;
	};
	pathDrawMode?: "normal" | "multi";
	onPathDrawModeChange?: (mode: "normal" | "multi") => void;
	onSetProperties: (properties: Partial<CanvasElement>) => void;
	onSetGeometryWidth?: (width: number) => void;
	onSetGeometryHeight?: (height: number) => void;
	onSetEllipseDiameter?: (diameter: number) => void;
	onPlaceDefaultElement?: () => void;
	onDelete: () => void;
	onGroup: () => void;
	onUngroup: () => void;
	onAlign: (alignment: SkedraAlignment) => void;
	onDistribute: (axis: SkedraDistribution) => void;
	onLayer: (command: SkedraLayerCommand) => void;
	onFlip: (axis: "horizontal" | "vertical") => void;
	onLock: (locked?: boolean) => void;
	onCropImage: (
		id: string,
		crop: { x: number; y: number; width: number; height: number },
	) => void;
	onStartImageCrop?: (id: string) => void;
	onAddFlowchartStep: (
		nodeId: string,
		options?: SkedraFlowchartStepOptions,
	) => void;
	onSetFlowchartNodeKind: (
		nodeId: string,
		kind: "start" | "step" | "decision" | "end",
	) => void;
	onUpdateKanbanCard: (
		cardId: string,
		details: SkedraKanbanCardDetails,
	) => void;
	onUpdateKanbanList: (
		listId: string,
		details: { name?: string; description?: string; wipLimit?: number | null },
	) => void;
	onOpenKanbanCard?: (cardId: string) => void;
	onOpenKanbanList?: (listId: string) => void;
	onAddKanbanCard?: (listId: string) => void;
	onAddTemplateSticky?: (sectionId: string) => void;
	onCopy?: () => void;
	onExportFrame?: (format: "png" | "svg") => void;
}

export function SkedraPropertiesPanel(props: SkedraPropertiesPanelProps) {
	return (
		<CanvasEditorPropertiesPanel
			{...(props as CanvasEditorPropertiesPanelProps)}
		/>
	);
}
