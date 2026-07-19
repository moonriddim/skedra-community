import { buildLayerReorderUpdates } from "@skedra/canvas-core";
import {
	CanvasEditorContextMenu,
	type CanvasEditorContextMenuProps,
	CanvasEditorGanttStudio,
	CanvasEditorLayerPanel,
	CanvasEditorSnapMenu,
	type CanvasEditorSnapMenuProps,
	CanvasEditorWireframePanel,
} from "@skedra/canvas-editor";
import type { CSSProperties } from "react";
import type { SkedraObjectSnapMode } from "./commands.js";
import type {
	SkedraGanttChartDocument,
	SkedraWireframeComponentId,
	SkedraWireframePresetId,
	SkedraWireframeViewport,
} from "./factories.js";
import type { CanvasElement } from "./types.js";

export type SkedraEditorTranslate = (
	key: string,
	fallback: string,
	params?: Record<string, string | number>,
) => string;

export type SkedraLayerReorderPosition = "above" | "below";

export interface SkedraGanttChartOption {
	id: string;
	title: string;
}

export interface SkedraCanvasElementUpdate {
	id: string;
	changes: Partial<CanvasElement>;
}

export type SkedraObjectSnapModeState = Record<SkedraObjectSnapMode, boolean>;

export interface SkedraLayerPanelProps {
	elements: Map<string, CanvasElement>;
	selectedIds: Set<string>;
	translate?: SkedraEditorTranslate;
	className?: string;
	style?: CSSProperties;
	onSelect: (id: string, additive: boolean) => void;
	onToggleLock: (id: string, locked: boolean) => void;
	onReorder: (
		movedId: string,
		targetId: string,
		position: SkedraLayerReorderPosition,
	) => void;
	onRenameFrame?: (id: string, label: string) => void;
	onClose?: () => void;
}

export interface SkedraWireframeInsertionTarget {
	frameId?: string;
	viewport?: SkedraWireframeViewport;
	point: { x: number; y: number } | null;
}

export interface SkedraWireframePanelProps {
	elements: Map<string, CanvasElement>;
	selectedElements: readonly CanvasElement[];
	translate?: SkedraEditorTranslate;
	className?: string;
	style?: CSSProperties;
	onInsertPreset: (preset: SkedraWireframePresetId) => void;
	onInsertComponent: (
		component: SkedraWireframeComponentId,
		target: SkedraWireframeInsertionTarget | null,
	) => void;
	onClose?: () => void;
}

export interface SkedraGanttPanelProps {
	document: SkedraGanttChartDocument | null;
	translate?: SkedraEditorTranslate;
	/** BCP-47 locale for the timeline's month/day header labels. */
	locale?: string;
	/** ISO date rendered as the "today" marker. Defaults to the system date. */
	today?: string;
	className?: string;
	style?: CSSProperties;
	charts?: readonly SkedraGanttChartOption[];
	activeChartId?: string | null;
	onSelectChart?: (chartId: string) => void;
	/**
	 * Called after every committed edit (drag, cell change, …). The interactive
	 * studio applies changes live, so this fires continuously rather than on an
	 * explicit apply button.
	 */
	onApply: (document: SkedraGanttChartDocument) => void;
	onCreate?: () => void;
	onDelete?: () => void;
	onClose?: () => void;
}

export interface SkedraSnapMenuProps {
	x: number;
	y: number;
	kind: "running" | "override";
	enabled: boolean;
	modes: SkedraObjectSnapModeState;
	showPoints?: boolean;
	divisionCount?: number;
	translate?: SkedraEditorTranslate;
	onToggleEnabled?: () => void;
	onToggleMode?: (mode: SkedraObjectSnapMode) => void;
	onToggleShowPoints?: () => void;
	onDivisionCountChange?: (count: number) => void;
	onSelectOverride?: (mode: SkedraObjectSnapMode) => void;
	onClose: () => void;
}

export interface SkedraContextMenuProps {
	x: number;
	y: number;
	hasSelection: boolean;
	selectionCount: number;
	isLocked: boolean;
	isInFrame: boolean;
	isGrouped: boolean;
	readOnly?: boolean;
	canPaste: boolean;
	canPasteFormat: boolean;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void | Promise<void>;
	onDuplicate: () => void;
	onDelete: () => void;
	onSelectAll: () => void;
	onToggleLock: () => void;
	onCopyFormat: () => void;
	onPasteFormat: () => void;
	onBringForward: () => void;
	onSendBackward: () => void;
	onBringToFront: () => void;
	onSendToBack: () => void;
	onFlipHorizontal: () => void;
	onFlipVertical: () => void;
	onCopyMirrorHorizontal: () => void;
	onCopyMirrorVertical: () => void;
	onRotate: (angle: number) => void;
	onCopyRotate: (angle: number) => void;
	onAddLink: () => void;
	onEmbedInFrame: () => void;
	onRemoveFromFrame: () => void;
	onGroup: () => void;
	onUngroup: () => void;
	snapToObjects: boolean;
	onToggleSnap: () => void;
	showSnapPoints: boolean;
	onToggleSnapPoints: () => void;
	snapModes: SkedraObjectSnapModeState;
	onToggleSnapMode: (mode: SkedraObjectSnapMode) => void;
	snapDivisionCount: number;
	onSnapDivisionCountChange: (count: number) => void;
	gridEnabled: boolean;
	onToggleGrid: () => void;
	gridSnapEnabled: boolean;
	onToggleGridSnap: () => void;
	gridSize: number;
	onGridSizeChange: (size: number) => void;
	translate?: SkedraEditorTranslate;
	onClose: () => void;
}

const fallbackTranslate: SkedraEditorTranslate = (_key, fallback) => fallback;

/** Public SDK access to the same layer-reorder planner used by Community. */
export function getSkedraLayerReorderUpdates(
	elements: Iterable<CanvasElement>,
	movedId: string,
	targetId: string,
	position: SkedraLayerReorderPosition,
): SkedraCanvasElementUpdate[] {
	return buildLayerReorderUpdates(
		elements,
		movedId,
		targetId,
		position,
	) as SkedraCanvasElementUpdate[];
}

/** Public layer surface backed by the same shared editor UI as Community. */
export function SkedraLayerPanel({
	translate = fallbackTranslate,
	...props
}: SkedraLayerPanelProps) {
	return <CanvasEditorLayerPanel {...props} translate={translate} />;
}

/** Public wireframe catalog backed by the same shared editor UI as Community. */
export function SkedraWireframePanel({
	translate = fallbackTranslate,
	...props
}: SkedraWireframePanelProps) {
	return <CanvasEditorWireframePanel {...props} translate={translate} />;
}

/** Public interactive Gantt studio shared with the Community canvas. */
export function SkedraGanttPanel({
	translate = fallbackTranslate,
	onApply,
	...props
}: SkedraGanttPanelProps) {
	// The public `onApply` name is kept for SDK compatibility; internally it is
	// the studio's live `onChange` callback.
	return (
		<CanvasEditorGanttStudio
			{...props}
			translate={translate}
			onChange={onApply}
		/>
	);
}

/** Public object-snap menu backed by the shared editor interaction surface. */
export function SkedraSnapMenu(props: SkedraSnapMenuProps) {
	return <CanvasEditorSnapMenu {...(props as CanvasEditorSnapMenuProps)} />;
}

/** Public context menu backed by the same shared editor UI as Community. */
export function SkedraContextMenu({
	translate = fallbackTranslate,
	...props
}: SkedraContextMenuProps) {
	return (
		<CanvasEditorContextMenu
			{...(props as CanvasEditorContextMenuProps)}
			translate={translate}
		/>
	);
}
