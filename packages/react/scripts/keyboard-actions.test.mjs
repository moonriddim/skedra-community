import assert from "node:assert/strict";
import test from "node:test";
import { handleSkedraSdkKeyboardAction } from "../dist/keyboard-actions.js";

const actions = [
	{ type: "command", command: "copy" },
	{ type: "tool", tool: "rectangle" },
	{ type: "toggle-tool-lock" },
	{ type: "toggle-object-snap" },
	{ type: "insert-image" },
	{ type: "open-help" },
	{ type: "open-command-palette" },
	{ type: "focus-property", property: "stroke" },
	{ type: "eyedropper", target: "fill" },
	{ type: "paste-plain-text" },
	{ type: "copy-canvas-as-png" },
	{ type: "copy-format" },
	{ type: "paste-format" },
	{ type: "add-link" },
	{ type: "adjust-font-size", delta: 2 },
	{ type: "align", edge: "left" },
	{ type: "flowchart-create", direction: "right" },
	{ type: "flowchart-navigate", direction: "down" },
	{ type: "zoom", factor: 1.25 },
	{ type: "reset-zoom" },
	{ type: "fit", target: "selection" },
	{ type: "pan-viewport", x: 10, y: -20 },
	{ type: "toggle-theme" },
	{ type: "toggle-zen" },
	{ type: "toggle-grid" },
	{ type: "activate-selection" },
];

test("dispatches every shared keyboard action in the SDK host", () => {
	const calls = [];
	const handlers = new Proxy(
		{},
		{
			get:
				(_target, property) =>
				(...args) =>
					calls.push([property, ...args]),
		},
	);
	for (const action of actions) {
		assert.equal(handleSkedraSdkKeyboardAction(action, handlers), true);
	}
	assert.equal(calls.length, actions.length);
	assert.deepEqual(calls[0], ["command", "copy"]);
	assert.deepEqual(calls.at(-1), ["activateSelection"]);
});
