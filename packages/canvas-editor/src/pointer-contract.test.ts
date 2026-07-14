import assert from "node:assert/strict";
import test from "node:test";
import {
	CANVAS_EDITOR_TOOL_IDS,
	handleCanvasEditorTemporaryPanKeyDown,
	resolveCanvasEditorKeyboardAction,
	resolveCanvasEditorPointerDown,
	shouldCancelCanvasEditorLostPointerCapture,
} from "./index";

test("every editor tool resolves a pointer action", () => {
	for (const tool of CANVAS_EDITOR_TOOL_IDS) {
		assert.notEqual(
			resolveCanvasEditorPointerDown({ tool, button: 0 }),
			"ignore",
			tool,
		);
	}
});

test("multi paths, lasso modifier and browser pan follow one contract", () => {
	assert.equal(
		resolveCanvasEditorPointerDown({
			tool: "line",
			button: 0,
			pathDrawMode: "multi",
		}),
		"path",
	);
	assert.equal(
		resolveCanvasEditorPointerDown({ tool: "select", button: 0, altKey: true }),
		"lasso",
	);
	assert.equal(
		resolveCanvasEditorPointerDown({ tool: "rectangle", button: 1 }),
		"pan",
	);
});

test("normal pointer-capture release does not cancel completed pointer-up", () => {
	assert.equal(shouldCancelCanvasEditorLostPointerCapture("none"), false);
	assert.equal(shouldCancelCanvasEditorLostPointerCapture("draw"), true);
	assert.equal(shouldCancelCanvasEditorLostPointerCapture("resize"), true);
});

test("temporary pan always prevents browser scrolling", () => {
	let prevented = 0;
	let temporaryPan = false;
	handleCanvasEditorTemporaryPanKeyDown(
		{
			repeat: false,
			preventDefault: () => {
				prevented += 1;
			},
		},
		(pressed) => {
			temporaryPan = pressed;
		},
	);
	assert.equal(prevented, 1);
	assert.equal(temporaryPan, true);
});

test("read-only mode blocks mutations in every host", () => {
	assert.equal(
		resolveCanvasEditorPointerDown({
			tool: "rectangle",
			button: 0,
			readOnly: true,
		}),
		"ignore",
	);
	assert.equal(
		resolveCanvasEditorPointerDown({
			tool: "select",
			button: 0,
			readOnly: true,
		}),
		"select",
	);
});

test("shared keyboard contract owns editor commands and tool shortcuts", () => {
	assert.deepEqual(
		resolveCanvasEditorKeyboardAction({
			key: "d",
			code: "KeyD",
			ctrlKey: true,
			metaKey: false,
			shiftKey: false,
			altKey: false,
		}),
		{ type: "command", command: "duplicate" },
	);
	assert.deepEqual(
		resolveCanvasEditorKeyboardAction({
			key: "V",
			code: "KeyV",
			ctrlKey: false,
			metaKey: false,
			shiftKey: true,
			altKey: false,
		}),
		{ type: "command", command: "flip-vertical" },
	);
	assert.deepEqual(
		resolveCanvasEditorKeyboardAction({
			key: "?",
			code: "Slash",
			ctrlKey: false,
			metaKey: false,
			shiftKey: true,
			altKey: false,
		}),
		{ type: "open-help" },
	);
});

test("keyboard resolver owns viewport, flowchart, and formatting gestures", () => {
	assert.deepEqual(
		resolveCanvasEditorKeyboardAction({
			key: "ArrowRight",
			code: "ArrowRight",
			ctrlKey: true,
			metaKey: false,
			shiftKey: false,
			altKey: false,
		}),
		{ type: "flowchart-create", direction: "right" },
	);
	assert.deepEqual(
		resolveCanvasEditorKeyboardAction({
			key: "v",
			code: "KeyV",
			ctrlKey: true,
			metaKey: false,
			shiftKey: true,
			altKey: false,
		}),
		{ type: "paste-plain-text" },
	);
	assert.deepEqual(
		resolveCanvasEditorKeyboardAction({
			key: "PageDown",
			code: "PageDown",
			ctrlKey: false,
			metaKey: false,
			shiftKey: true,
			altKey: false,
		}),
		{ type: "pan-viewport", x: -100, y: 0 },
	);
});

test("keyboard resolver preserves modifier precedence and selection shortcuts", () => {
	const resolve = (
		key: string,
		overrides: Partial<
			Pick<
				KeyboardEvent,
				"code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
			>
		> = {},
		hasSelection = false,
	) =>
		resolveCanvasEditorKeyboardAction(
			{
				key,
				code: overrides.code ?? key,
				ctrlKey: overrides.ctrlKey ?? false,
				metaKey: overrides.metaKey ?? false,
				shiftKey: overrides.shiftKey ?? false,
				altKey: overrides.altKey ?? false,
			},
			{ hasSelection },
		);

	assert.deepEqual(
		resolve("v", { ctrlKey: true, altKey: true, shiftKey: true }),
		{ type: "paste-plain-text" },
	);
	assert.deepEqual(
		resolve("c", { ctrlKey: true, altKey: true, shiftKey: true }),
		{ type: "copy-format" },
	);
	assert.deepEqual(
		resolve("p", { metaKey: true, altKey: true, shiftKey: true }),
		{ type: "open-command-palette" },
	);
	assert.deepEqual(
		resolve("ArrowUp", { ctrlKey: true, altKey: true, shiftKey: true }),
		{ type: "align", edge: "top" },
	);
	assert.deepEqual(resolve("ArrowLeft", { altKey: true }), {
		type: "flowchart-navigate",
		direction: "left",
	});
	assert.deepEqual(
		resolve("<", {
			code: "Comma",
			ctrlKey: true,
			altKey: true,
			shiftKey: true,
		}),
		{ type: "adjust-font-size", delta: -2 },
	);
	assert.deepEqual(resolve("+", { ctrlKey: true, altKey: true }), {
		type: "zoom",
		factor: 1.25,
	});
	assert.deepEqual(resolve("'", { ctrlKey: true, shiftKey: true }), {
		type: "toggle-grid",
	});
	assert.deepEqual(resolve("s", {}, true), {
		type: "focus-property",
		property: "stroke",
	});
	assert.equal(resolve("s"), null);
});
