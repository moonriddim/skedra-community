import type { CanvasThemeState } from "@/lib/canvas/canvas-defaults";
import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import {
	getDefaultKanbanBoardLists,
	getDefaultKanbanCardTitle,
} from "@/lib/canvas/kanban-options";
import {
	encodeYDocStateBase64,
	objectToYMap,
} from "@/lib/canvas/yjs-document-helpers";
import {
	type CanvasElement,
	createCanvasTemplateElements,
} from "@skedra/canvas-core";
import * as Y from "yjs";
import { createFlowchartTemplate } from "./flowchart";
import { createMindmapTemplate } from "./mindmap";
import { createRetrospectiveTemplate } from "./retrospective";
import { createSwotTemplate } from "./swot";
import { createWireframeTemplate } from "./wireframe";

export interface WhiteboardTemplate {
	id: string;
	name: string;
	description: string;
	icon: string;
	create: (
		centerX: number,
		centerY: number,
		theme?: CanvasThemeState,
	) => CanvasElement[];
}

export const TEMPLATES: WhiteboardTemplate[] = [
	{
		id: "kanban",
		name: "Kanban-Board",
		description:
			"3 Listen (To Do, In Bearbeitung, Erledigt) zur Aufgabenverwaltung",
		icon: "📋",
		create: (cx, cy, theme) =>
			createCanvasTemplateElements({
				id: "kanban",
				x: cx,
				y: cy,
				defaults: getCanvasElementFactoryDefaults(theme),
				kanbanLists: getDefaultKanbanBoardLists(),
				defaultKanbanCardTitle: getDefaultKanbanCardTitle(),
			}),
	},
	{
		id: "mindmap",
		name: "Mindmap",
		description: "Leichtes Startgerüst mit wenigen Ästen zum Weiterbauen",
		icon: "🧠",
		create: (cx, cy, theme) => createMindmapTemplate(cx, cy, theme),
	},
	{
		id: "flowchart",
		name: "Flowchart",
		description: "Klare Prozesskette mit Entscheidungspfaden",
		icon: "📊",
		create: (cx, cy, theme) => createFlowchartTemplate(cx, cy, { theme }),
	},
	{
		id: "wireframe",
		name: "Low-Fidelity-Wireframe",
		description:
			"Editierbares Desktop- und Mobile-Grundgerüst für frühe Produktideen",
		icon: "▱",
		create: (cx, cy) => createWireframeTemplate(cx, cy),
	},
	{
		id: "retrospective",
		name: "Retrospektive",
		description: "Mad, Sad, Glad plus fokussierte Maßnahmen",
		icon: "🔄",
		create: (cx, cy) => createRetrospectiveTemplate(cx, cy),
	},
	{
		id: "swot",
		name: "SWOT-Analyse",
		description: "Vier Felder mit Leitfragen und Prioritäten",
		icon: "📈",
		create: (cx, cy) => createSwotTemplate(cx, cy),
	},
];

/**
 * Wandelt ein Array von CanvasElementen in einen Base64-kodierten Y.Doc-Zustand um,
 * der an die createWithState-Mutation übergeben werden kann.
 */
export function createBase64StateFromElements(
	elements: CanvasElement[],
): string {
	const ydoc = new Y.Doc();
	const elementsMap = ydoc.getMap<Y.Map<unknown>>("elementsMap");

	ydoc.transact(() => {
		for (const element of elements) {
			elementsMap.set(element.id, objectToYMap(element));
		}
	});

	return encodeYDocStateBase64(ydoc);
}
