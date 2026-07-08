import type { CanvasElement } from "./types";

export const FLOWCHART_NODE_TYPE = "flowchart-node";
export const FLOWCHART_CONNECTOR_TYPE = "flowchart-connector";
export const FLOWCHART_HORIZONTAL_GAP = 90;
export const FLOWCHART_BRANCH_GAP = 110;
export const FLOWCHART_YES_COLOR = "#0F766E";
export const FLOWCHART_NO_COLOR = "#7C3AED";
export const FLOWCHART_DEFAULT_STROKE = "#1e1e1e";
export const FLOWCHART_DEFAULT_FONT_FAMILY =
	'"Kalam", "Architects Daughter", "Segoe Print", cursive';

export type FlowchartNodeKind = "start" | "step" | "decision" | "end";
export type FlowchartConnectorRoute =
	| "up"
	| "right"
	| "down"
	| "left"
	| "left-up";
export type FlowchartBranchKind = "next" | "yes" | "no";

export interface FlowchartNodePreset {
	type: CanvasElement["type"];
	width: number;
	height: number;
	stroke: string;
	cornerRadius?: number;
	fontSize: number;
	fontWeight: "normal" | "bold";
}

export interface FlowchartNodeMeta {
	skedraType: typeof FLOWCHART_NODE_TYPE;
	flowchartId: string;
	flowchartNodeKind: FlowchartNodeKind;
}

export interface FlowchartConnectorMeta {
	skedraType: typeof FLOWCHART_CONNECTOR_TYPE;
	flowchartId: string;
	flowchartSourceId: string;
	flowchartTargetId: string;
	flowchartRoute: FlowchartConnectorRoute;
	flowchartBranchKind: FlowchartBranchKind;
}

export interface CreateFlowchartNodeOptions {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	type: CanvasElement["type"];
	text: string;
	flowchartId: string;
	nodeKind: FlowchartNodeKind;
	stroke: string;
	fill?: string;
	fontFamily?: string;
	fontSize?: number;
	fontWeight?: "normal" | "bold";
	cornerRadius?: number;
	stackIndex?: string;
}

export interface CreateFlowchartConnectorOptions {
	id: string;
	flowchartId: string;
	source: CanvasElement;
	target: CanvasElement;
	route: FlowchartConnectorRoute;
	branchKind?: FlowchartBranchKind;
	text?: string;
	textColor?: string;
	fontSize?: number;
	arrowTextSide?: "above" | "below";
	stroke?: string;
	stackIndex?: string;
}

const FLOWCHART_NODE_PRESETS: Record<FlowchartNodeKind, FlowchartNodePreset> = {
	start: {
		type: "ellipse",
		width: 160,
		height: 56,
		stroke: "#15803D",
		fontSize: 18,
		fontWeight: "bold",
	},
	step: {
		type: "rectangle",
		width: 220,
		height: 88,
		stroke: "#2563EB",
		cornerRadius: 18,
		fontSize: 18,
		fontWeight: "bold",
	},
	decision: {
		type: "diamond",
		width: 180,
		height: 120,
		stroke: "#D97706",
		fontSize: 19,
		fontWeight: "bold",
	},
	end: {
		type: "ellipse",
		width: 170,
		height: 56,
		stroke: "#EA580C",
		fontSize: 18,
		fontWeight: "bold",
	},
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value != null;
}

export function getFlowchartNodePreset(
	kind: FlowchartNodeKind,
	stroke = FLOWCHART_DEFAULT_STROKE,
): FlowchartNodePreset {
	return { ...FLOWCHART_NODE_PRESETS[kind], stroke };
}

export function isFlowchartNode(
	element: CanvasElement | null | undefined,
): boolean {
	return element?.customData?.skedraType === FLOWCHART_NODE_TYPE;
}

export function getFlowchartNodeMeta(
	element: CanvasElement | null | undefined,
): FlowchartNodeMeta | null {
	if (!element || !isFlowchartNode(element) || !isRecord(element.customData)) {
		return null;
	}
	const { flowchartId, flowchartNodeKind } = element.customData;
	if (
		typeof flowchartId !== "string" ||
		(flowchartNodeKind !== "start" &&
			flowchartNodeKind !== "step" &&
			flowchartNodeKind !== "decision" &&
			flowchartNodeKind !== "end")
	) {
		return null;
	}
	return {
		skedraType: FLOWCHART_NODE_TYPE,
		flowchartId,
		flowchartNodeKind,
	};
}

export function getFlowchartConnectorMeta(
	element: CanvasElement | null | undefined,
): FlowchartConnectorMeta | null {
	if (
		!element ||
		element.customData?.skedraType !== FLOWCHART_CONNECTOR_TYPE ||
		!isRecord(element.customData)
	) {
		return null;
	}
	const {
		flowchartId,
		flowchartSourceId,
		flowchartTargetId,
		flowchartRoute,
		flowchartBranchKind,
	} = element.customData;
	const normalizedBranchKind =
		flowchartBranchKind === undefined
			? flowchartRoute === "down"
				? "no"
				: flowchartRoute === "right"
					? "yes"
					: "next"
			: flowchartBranchKind;
	if (
		typeof flowchartId !== "string" ||
		typeof flowchartSourceId !== "string" ||
		typeof flowchartTargetId !== "string" ||
		(flowchartRoute !== "up" &&
			flowchartRoute !== "right" &&
			flowchartRoute !== "down" &&
			flowchartRoute !== "left" &&
			flowchartRoute !== "left-up") ||
		(normalizedBranchKind !== "next" &&
			normalizedBranchKind !== "yes" &&
			normalizedBranchKind !== "no")
	) {
		return null;
	}
	return {
		skedraType: FLOWCHART_CONNECTOR_TYPE,
		flowchartId,
		flowchartSourceId,
		flowchartTargetId,
		flowchartRoute,
		flowchartBranchKind: normalizedBranchKind,
	};
}

export function createFlowchartNode(
	options: CreateFlowchartNodeOptions,
): CanvasElement {
	return {
		id: options.id,
		type: options.type,
		x: options.x,
		y: options.y,
		width: options.width,
		height: options.height,
		rotation: 0,
		fill: options.fill ?? "transparent",
		stroke: options.stroke,
		strokeWidth: 2,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		stackIndex: options.stackIndex,
		flipX: false,
		flipY: false,
		text: options.text,
		fontSize: options.fontSize ?? 18,
		fontFamily: options.fontFamily ?? FLOWCHART_DEFAULT_FONT_FAMILY,
		fontWeight: options.fontWeight ?? "bold",
		textAlign: "center",
		cornerRadius: options.cornerRadius,
		customData: {
			skedraType: FLOWCHART_NODE_TYPE,
			flowchartId: options.flowchartId,
			flowchartNodeKind: options.nodeKind,
		},
	};
}

export function buildFlowchartNodeKindChanges(
	node: CanvasElement,
	kind: FlowchartNodeKind,
): Partial<CanvasElement> {
	const preset = getFlowchartNodePreset(kind, node.stroke);
	const centerX = node.x + node.width / 2;
	const centerY = node.y + node.height / 2;
	return {
		x: centerX - preset.width / 2,
		y: centerY - preset.height / 2,
		width: preset.width,
		height: preset.height,
		type: preset.type,
		stroke: preset.stroke,
		cornerRadius: preset.cornerRadius,
		fontSize: preset.fontSize,
		fontWeight: preset.fontWeight,
		fill: node.fill ?? "transparent",
		customData: {
			...(isRecord(node.customData) ? node.customData : {}),
			skedraType: FLOWCHART_NODE_TYPE,
			flowchartId: getFlowchartNodeMeta(node)?.flowchartId ?? "",
			flowchartNodeKind: kind,
		},
	};
}

function getFlowchartConnectorStroke(
	source: CanvasElement,
	_branchKind: FlowchartBranchKind,
	stroke?: string,
): string {
	if (stroke) return stroke;
	return source.stroke || "#94A3B8";
}

function buildAbsolutePoints(
	source: CanvasElement,
	target: CanvasElement,
	route: FlowchartConnectorRoute,
): [number, number][] {
	const sourceCenterX = source.x + source.width / 2;
	const sourceCenterY = source.y + source.height / 2;
	const targetCenterX = target.x + target.width / 2;
	const targetCenterY = target.y + target.height / 2;

	if (route === "down") {
		return [
			[sourceCenterX, source.y + source.height],
			[targetCenterX, target.y],
		];
	}

	if (route === "up") {
		return [
			[sourceCenterX, source.y],
			[targetCenterX, target.y + target.height],
		];
	}

	if (route === "left") {
		return [
			[source.x, sourceCenterY],
			[target.x + target.width, targetCenterY],
		];
	}

	if (route === "left-up") {
		return [
			[source.x, sourceCenterY],
			[targetCenterX, sourceCenterY],
			[targetCenterX, target.y + target.height],
		];
	}

	return [
		[source.x + source.width, sourceCenterY],
		[target.x, targetCenterY],
	];
}

export function buildFlowchartConnectorChanges(
	source: CanvasElement,
	target: CanvasElement,
	route: FlowchartConnectorRoute,
): Partial<CanvasElement> {
	const absolutePoints = buildAbsolutePoints(source, target, route);
	const minX = Math.min(...absolutePoints.map(([x]) => x));
	const minY = Math.min(...absolutePoints.map(([, y]) => y));
	const maxX = Math.max(...absolutePoints.map(([x]) => x));
	const maxY = Math.max(...absolutePoints.map(([, y]) => y));

	return {
		x: minX,
		y: minY,
		width: Math.max(1, maxX - minX),
		height: Math.max(1, maxY - minY),
		points: absolutePoints.map(
			([x, y]) => [x - minX, y - minY] as [number, number],
		),
		arrowMode: absolutePoints.length > 2 ? "elbow" : "straight",
		arrowHeadStart: "none",
		arrowHeadEnd: "arrow",
	};
}

export function createFlowchartConnector(
	options: CreateFlowchartConnectorOptions,
): CanvasElement {
	const geometry = buildFlowchartConnectorChanges(
		options.source,
		options.target,
		options.route,
	);
	const branchKind = options.branchKind ?? "next";
	return {
		id: options.id,
		type: "arrow",
		x: geometry.x ?? 0,
		y: geometry.y ?? 0,
		width: geometry.width ?? 1,
		height: geometry.height ?? 1,
		rotation: 0,
		fill: "transparent",
		stroke: getFlowchartConnectorStroke(
			options.source,
			branchKind,
			options.stroke,
		),
		strokeWidth: 2,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		stackIndex: options.stackIndex,
		flipX: false,
		flipY: false,
		text: options.text,
		textColor: options.textColor,
		fontSize: options.fontSize,
		fontWeight: options.text ? "bold" : undefined,
		points: geometry.points,
		arrowMode: geometry.arrowMode,
		arrowHeadStart: geometry.arrowHeadStart,
		arrowHeadEnd: geometry.arrowHeadEnd,
		customData: {
			skedraType: FLOWCHART_CONNECTOR_TYPE,
			flowchartId: options.flowchartId,
			flowchartSourceId: options.source.id,
			flowchartTargetId: options.target.id,
			flowchartRoute: options.route,
			flowchartBranchKind: branchKind,
			arrowTextSide: options.arrowTextSide,
		},
	};
}

export function buildFlowchartConnectorSyncUpdates(
	elements: Map<string, CanvasElement>,
) {
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];
	for (const element of elements.values()) {
		const meta = getFlowchartConnectorMeta(element);
		if (!meta) continue;
		const source = elements.get(meta.flowchartSourceId);
		const target = elements.get(meta.flowchartTargetId);
		if (
			!source ||
			!target ||
			!isFlowchartNode(source) ||
			!isFlowchartNode(target)
		) {
			continue;
		}
		const next = buildFlowchartConnectorChanges(
			source,
			target,
			meta.flowchartRoute,
		);
		const currentPoints = JSON.stringify(element.points ?? []);
		const nextPoints = JSON.stringify(next.points ?? []);
		const geometryChanged =
			element.x !== next.x ||
			element.y !== next.y ||
			element.width !== next.width ||
			element.height !== next.height ||
			currentPoints !== nextPoints;
		if (geometryChanged) {
			updates.push({
				id: element.id,
				changes: next,
			});
		}
	}
	return updates;
}

export function getFlowchartOutgoingNodes(
	nodeId: string,
	route: FlowchartConnectorRoute,
	elements: Map<string, CanvasElement>,
): CanvasElement[] {
	const targets: CanvasElement[] = [];
	for (const element of elements.values()) {
		const meta = getFlowchartConnectorMeta(element);
		if (
			!meta ||
			meta.flowchartSourceId !== nodeId ||
			meta.flowchartRoute !== route
		) {
			continue;
		}
		const target = elements.get(meta.flowchartTargetId);
		if (target && isFlowchartNode(target)) targets.push(target);
	}
	return targets.sort((left, right) => left.x - right.x || left.y - right.y);
}

export function getFlowchartBranchTarget(
	nodeId: string,
	branchKind: FlowchartBranchKind,
	elements: Map<string, CanvasElement>,
): CanvasElement | null {
	for (const element of elements.values()) {
		const meta = getFlowchartConnectorMeta(element);
		if (
			!meta ||
			meta.flowchartSourceId !== nodeId ||
			meta.flowchartBranchKind !== branchKind
		) {
			continue;
		}
		const target = elements.get(meta.flowchartTargetId);
		if (target && isFlowchartNode(target)) return target;
	}
	return null;
}
