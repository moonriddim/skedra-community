import assert from "node:assert/strict";
import { test } from "node:test";
import {
	getFlowchartRouteForDirection,
	navigateFlowchartInDirection,
} from "./flowchart-navigation.js";
import type { CanvasElement } from "./types.js";

function node(id: string, x: number, y: number): CanvasElement {
	return {
		id,
		type: "rectangle",
		x,
		y,
		width: 100,
		height: 60,
		rotation: 0,
		fill: "transparent",
		stroke: "#000",
		strokeWidth: 1,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		customData: {
			skedraType: "flowchart-node",
			flowchartId: "flow",
			flowchartNodeKind: "step",
		},
	};
}

function connector(
	id: string,
	sourceId: string,
	targetId: string,
	route: "right" | "down",
	branchKind: "yes" | "no" | "next" = "next",
): CanvasElement {
	return {
		id,
		type: "arrow",
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rotation: 0,
		fill: "transparent",
		stroke: "#000",
		strokeWidth: 1,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		points: [
			[0, 0],
			[1, 1],
		],
		customData: {
			skedraType: "flowchart-connector",
			flowchartId: "flow",
			flowchartSourceId: sourceId,
			flowchartTargetId: targetId,
			flowchartRoute: route,
			flowchartBranchKind: branchKind,
		},
	};
}

test("maps keyboard directions to connector routes", () => {
	assert.equal(getFlowchartRouteForDirection("up"), "up");
	assert.equal(getFlowchartRouteForDirection("right"), "right");
	assert.equal(getFlowchartRouteForDirection("down"), "down");
	assert.equal(getFlowchartRouteForDirection("left"), "left");
});

test("navigates to connected flowchart targets first", () => {
	const elements = new Map<string, CanvasElement>([
		["source", node("source", 0, 0)],
		["connected", node("connected", 300, 0)],
		["nearest", node("nearest", 160, 0)],
		["edge", connector("edge", "source", "connected", "right", "yes")],
	]);

	assert.equal(
		navigateFlowchartInDirection("source", "right", elements)?.id,
		"connected",
	);
});

test("falls back to nearest node in the requested direction", () => {
	const elements = new Map<string, CanvasElement>([
		["source", node("source", 0, 0)],
		["right", node("right", 180, 0)],
		["far-right", node("far-right", 360, 0)],
		["down", node("down", 0, 180)],
	]);

	assert.equal(
		navigateFlowchartInDirection("source", "right", elements)?.id,
		"right",
	);
	assert.equal(
		navigateFlowchartInDirection("source", "down", elements)?.id,
		"down",
	);
});
