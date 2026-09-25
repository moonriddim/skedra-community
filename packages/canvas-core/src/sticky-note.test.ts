import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildStickyNoteFontSizeChange,
	buildStickyNoteModeChange,
	getStickyNoteContent,
	getStickyNoteTypography,
	normalizeStickyChecklist,
	sanitizeStickyChecklistForStorage,
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

test("checklist-to-note conversion keeps the size of each entry", () => {
	const note = {
		...checklistNote,
		customData: {
			...checklistNote.customData,
			stickyTitleFontSize: 28,
			stickyChecklist: [
				{ id: "a", text: "Small", completed: false, fontSize: 8 },
				{ id: "b", text: "Large", completed: true, fontSize: 64 },
			],
		},
	};
	const changes = buildStickyNoteModeChange(note, "note");
	assert.equal(changes.text, "Heading\n- Small\n- Large");
	assert.deepEqual(changes.customData?.stickyTextFontSizes, [28, 8, 64]);
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

test("checklist sizes survive storage and malformed sizes are bounded", () => {
	const items = normalizeStickyChecklist([
		{ id: "a", text: "Small", completed: false, fontSize: 8 },
		{ id: "b", text: "Large", completed: true, fontSize: 96 },
		{ id: "c", text: "Invalid", fontSize: Number.NaN },
		{ id: "d", text: "Bounded", fontSize: 900 },
	]);
	assert.deepEqual(
		sanitizeStickyChecklistForStorage(items).map((item) => item.fontSize),
		[8, 96, undefined, 256],
	);
});

test("whole-note resizing scales individual lines without dropping unrelated metadata", () => {
	const note = {
		...checklistNote,
		fontSize: 20,
		customData: {
			...checklistNote.customData,
			stickyTextFontSizes: [12, 40],
			stickyTitleFontSize: 30,
			owner: "preserve",
			stickyChecklist: [
				{ id: "a", text: "Item", completed: true, fontSize: 18 },
			],
		},
	};
	const changes = buildStickyNoteFontSizeChange(note, 40);
	assert.deepEqual(getStickyNoteTypography({ ...note, ...changes }), {
		textFontSizes: [24, 80],
		titleFontSize: 60,
	});
	assert.equal(changes.customData?.owner, "preserve");
	assert.equal(
		getStickyNoteContent({ ...note, ...changes }).checklist[0].fontSize,
		36,
	);
	assert.equal(
		getStickyNoteContent({ ...note, ...changes }).checklist[0].completed,
		true,
	);
	assert.equal(note.customData.stickyTextFontSizes[0], 12);
});
