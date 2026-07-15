import assert from "node:assert/strict";
import test from "node:test";
import {
	frameLabelHitTest,
	getFrameLabelHitBox,
	isCanvasTextEditableElement,
	isPlainCanvasFrame,
} from "./element-capabilities";
import type { CanvasElement } from "./types";

test("keeps inline text capability centralized for every element type", () => {
	const editable: CanvasElement["type"][] = [
		"text",
		"rectangle",
		"ellipse",
		"diamond",
		"frame",
		"line",
		"arrow",
	];
	const nonEditable: CanvasElement["type"][] = ["image", "freehand"];

	for (const type of editable) {
		assert.equal(isCanvasTextEditableElement({ type }), true, type);
	}
	for (const type of nonEditable) {
		assert.equal(isCanvasTextEditableElement({ type }), false, type);
	}
});

test("plain frames exclude special frame roles", () => {
	assert.equal(isPlainCanvasFrame({ type: "frame" }), true);
	assert.equal(isPlainCanvasFrame({ type: "frame", customData: {} }), true);
	assert.equal(
		isPlainCanvasFrame({
			type: "frame",
			customData: { skedraType: "kanban-list" },
		}),
		false,
	);
	assert.equal(
		isPlainCanvasFrame({
			type: "frame",
			customData: { skedraType: "template-section" },
		}),
		false,
	);
	assert.equal(isPlainCanvasFrame({ type: "rectangle" }), false);
	assert.equal(isPlainCanvasFrame(null), false);
});

test("frame label hit box sits above the frame edge", () => {
	const frame = {
		type: "frame",
		x: 100,
		y: 200,
		width: 300,
		frameLabel: "Screen",
	} as CanvasElement;

	const box = getFrameLabelHitBox(frame);
	assert.equal(box.x, frame.x);
	assert.ok(box.y < frame.y, "label box starts above the frame");
	assert.ok(box.y + box.height >= frame.y, "label box reaches the frame edge");
	assert.ok(box.width <= frame.width);

	/* Punkt knapp ueber der linken oberen Ecke trifft das Label */
	assert.equal(frameLabelHitTest(frame, 110, 192), true);
	/* Punkt im Frame-Koerper trifft das Label nicht */
	assert.equal(frameLabelHitTest(frame, 110, 260), false);
	/* Kanban-Listen haben kein klickbares Frame-Label */
	assert.equal(
		frameLabelHitTest(
			{
				...frame,
				customData: { skedraType: "kanban-list" },
			} as CanvasElement,
			110,
			192,
		),
		false,
	);
});
