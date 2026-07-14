import assert from "node:assert/strict";
import { test } from "node:test";
import type { CanvasDrawingStyle } from "@skedra/canvas-core";
import { CanvasPathEditorController } from "./path-editor-controller";
import { buildCanvasSinglePathElement } from "./single-path";

const style: CanvasDrawingStyle = {
	stroke: "#111111",
	fill: "#22c55e",
	arrowMode: "curve",
};

function pointer(raw: [number, number], snapped = raw) {
	return { raw, snapped, zoom: 1 };
}

test("one shared gesture closes a multi-line at its start point", () => {
	const editor = new CanvasPathEditorController();
	editor.begin("line", [0, 0], style);
	editor.release(pointer([0, 0]), style);
	editor.begin("line", [0, 0], style);
	editor.release(pointer([100, 0]), style);
	editor.begin("line", [100, 0], style);
	editor.release(pointer([100, 100]), style);

	const hover = editor.move(pointer([5, 0]), style);
	assert.equal(hover.startSnap?.active, true);

	const completed = editor.release(pointer([5, 0]), style);
	assert.equal(completed.kind, "complete");
	if (completed.kind !== "complete") return;
	assert.equal(completed.element.closed, true);
	assert.equal(completed.element.fill, "#22c55e");
	assert.equal(completed.element.arrowMode, "curve");
	assert.deepEqual(completed.element.points, [
		[0, 0],
		[100, 0],
		[100, 100],
	]);
});

test("arrows remain open and use the same preview/commit state machine", () => {
	const editor = new CanvasPathEditorController();
	editor.begin("arrow", [10, 20], { ...style, arrowMode: "elbow" });
	editor.release(pointer([10, 20]), { ...style, arrowMode: "elbow" });
	editor.begin("arrow", [10, 20], { ...style, arrowMode: "elbow" });
	editor.release(pointer([90, 60]), { ...style, arrowMode: "elbow" });

	const completed = editor.finish({ ...style, arrowMode: "elbow" }, true);
	assert.equal(completed.kind, "complete");
	if (completed.kind !== "complete") return;
	assert.equal(completed.element.closed, undefined);
	assert.equal(completed.element.fill, "transparent");
	assert.equal(completed.element.arrowHeadEnd, "arrow");
});

test("single-drag paths share curve and elbow point construction", () => {
	const curve = buildCanvasSinglePathElement({
		id: "curve",
		tool: "line",
		start: { x: 10, y: 20 },
		end: { x: 110, y: 80 },
		style,
	});
	assert.deepEqual(curve.points, [
		[0, 0],
		[50, 30],
		[100, 60],
	]);

	const elbow = buildCanvasSinglePathElement({
		id: "elbow",
		tool: "arrow",
		start: { x: 10, y: 20 },
		end: { x: 110, y: 60 },
		style: { ...style, arrowMode: "elbow" },
	});
	assert.deepEqual(elbow.points, [
		[0, 0],
		[50, 0],
		[50, 40],
		[100, 40],
	]);
});
