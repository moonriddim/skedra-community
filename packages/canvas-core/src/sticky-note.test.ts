import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildStickyNoteModeChange,
	getStickyNoteContent,
} from "./sticky-note.js";
import type { CanvasElement } from "./types.js";

const checklistNote: CanvasElement = {
	id: "note",
	type: "rectangle",
	x: 0,
	y: 0,
	width: 200,
	height: 200,
	rotation: 0,
	fill: "#fff3bf",
	stroke: "#ced4da",
	strokeWidth: 1,
	strokeStyle: "solid",
	opacity: 100,
	locked: false,
	groupId: null,
	flipX: false,
	flipY: false,
	text: "Heading",
	customData: {
		skedraType: "sticky-note",
		stickyNoteMode: "checklist",
		stickyChecklist: [
			{ id: "one", text: "First", completed: false },
			{ id: "two", text: "Second", completed: true },
		],
	},
};

test("preserves Web sticky content when switching a checklist to a note", () => {
	const change = buildStickyNoteModeChange(checklistNote, "note");
	assert.equal(change.text, "Heading\n- First\n- Second");
	assert.deepEqual(change.customData?.stickyChecklist, []);
	assert.equal(change.customData?.stickyNoteMode, "note");
});

test("infers legacy checklist notes through the shared reader", () => {
	const legacy = {
		...checklistNote,
		customData: {
			...checklistNote.customData,
			stickyNoteMode: undefined,
		},
	};
	assert.equal(getStickyNoteContent(legacy).mode, "checklist");
});
