import type {
	CanvasElement,
	FlowchartConnectorRoute,
	FlowchartNodeKind,
	MindmapDirection,
} from "@skedra/canvas-core";
import { createContext, useContext } from "react";
import type { PendingText } from "./text-editor";

export type AddFlowchartStepOptions =
	| "next"
	| "yes"
	| "no"
	| {
			branch?: "next" | "yes" | "no";
			route?: FlowchartConnectorRoute;
			nodeKind?: FlowchartNodeKind;
			label?: string;
	  };

export interface MindmapChildOptions {
	direction?: MindmapDirection;
	position?: "before" | "after";
	preserveParentSelection?: boolean;
	startEditing?: boolean;
}

export interface MindmapSiblingOptions {
	position?: "before" | "after";
	preserveAnchorSelection?: boolean;
	startEditing?: boolean;
}

export interface CanvasClientPoint {
	clientX: number;
	clientY: number;
}

export interface CanvasCommands {
	openHelp: () => void;
	pasteElement: (element: CanvasElement) => void;
	startTextPlacement: (text: PendingText) => void;
	openKanbanCard: (id: string) => void;
	openKanbanList: (id: string) => void;
	addKanbanCard: (listId: string) => void;
	addTemplateSticky: (sectionId: string) => void;
	addFlowchartStep: (nodeId: string, options?: AddFlowchartStepOptions) => void;
	addFlowchartBranch: (nodeId: string, branch: "yes" | "no") => void;
	addMindmapChild: (parentId: string, options?: MindmapChildOptions) => void;
	addMindmapSibling: (nodeId: string, options?: MindmapSiblingOptions) => void;
	toggleStickyChecklistItem: (elementId: string, itemId: string) => void;
	insertWaypoint: (
		elementId: string,
		insertIndex: number,
		point: [number, number],
	) => void;
	showKanbanCardPlacementPreview: (point: CanvasClientPoint) => void;
	showStickyNotePlacementPreview: (point: CanvasClientPoint) => void;
}

const CanvasCommandsContext = createContext<CanvasCommands | null>(null);

export function CanvasCommandsProvider({
	value,
	children,
}: {
	value: CanvasCommands;
	children: React.ReactNode;
}) {
	return (
		<CanvasCommandsContext.Provider value={value}>
			{children}
		</CanvasCommandsContext.Provider>
	);
}

export function useCanvasCommands(): CanvasCommands {
	const commands = useContext(CanvasCommandsContext);
	if (!commands) {
		throw new Error("useCanvasCommands must be used inside SkedraCanvas");
	}
	return commands;
}
