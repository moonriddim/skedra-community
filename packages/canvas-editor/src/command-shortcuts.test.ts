import assert from "node:assert/strict";
import test from "node:test";
import {
	getCanvasEditorUiShortcutLabels,
	matchesCanvasEditorUiShortcut,
} from "./command-shortcuts";

function keyboardEvent(
	key: string,
	updates: Partial<
		Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "altKey">
	> = {},
) {
	return {
		key,
		ctrlKey: updates.ctrlKey ?? false,
		metaKey: updates.metaKey ?? false,
		shiftKey: updates.shiftKey ?? false,
		altKey: updates.altKey ?? false,
	};
}

test("canvas UI entry points share display labels and keyboard matching", () => {
	assert.deepEqual(getCanvasEditorUiShortcutLabels("find-on-canvas"), [
		"Mod+F",
	]);
	assert.equal(
		matchesCanvasEditorUiShortcut(
			keyboardEvent("f", { ctrlKey: true }),
			"find-on-canvas",
		),
		true,
	);
	assert.equal(
		matchesCanvasEditorUiShortcut(
			keyboardEvent("p", { metaKey: true, shiftKey: true, altKey: true }),
			"command-browser",
		),
		true,
	);
	assert.equal(
		matchesCanvasEditorUiShortcut(
			keyboardEvent("f", { ctrlKey: true, altKey: true }),
			"find-on-canvas",
		),
		false,
	);
});
