import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldShowCanvasProperties } from "./canvas-tool-types.js";

test("structured diagram selections hide the generic properties panel", () => {
	for (const localMode of [true, false]) {
		assert.equal(
			shouldShowCanvasProperties({
				showEditorChrome: true,
				localMode,
				hasPropertyContext: true,
				hasOnlyStructuredDiagramSelection: true,
			}),
			false,
		);
	}

	assert.equal(
		shouldShowCanvasProperties({
			showEditorChrome: true,
			localMode: false,
			hasPropertyContext: true,
			hasOnlyStructuredDiagramSelection: false,
		}),
		true,
	);
});
