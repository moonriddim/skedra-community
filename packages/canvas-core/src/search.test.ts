import assert from "node:assert/strict";
import test from "node:test";
import { findCanvasSearchMatches } from "./search";
import type { CanvasElement } from "./types";

function element(
	id: string,
	type: CanvasElement["type"],
	updates: Partial<CanvasElement>,
): CanvasElement {
	return {
		id,
		type,
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		rotation: 0,
		fill: "transparent",
		stroke: "#000",
		strokeWidth: 2,
		strokeStyle: "solid",
		opacity: 1,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		...updates,
	};
}

test("canvas search finds every occurrence and treats punctuation literally", () => {
	const matches = findCanvasSearchMatches(
		[
			element("text", "text", {
				text: "API v1.0 then api v1.0",
			}),
		],
		"API v1.0",
	);

	assert.equal(matches.length, 2);
	assert.deepEqual(
		matches.map((match) => match.matchStart),
		[0, 14],
	);
});

test("canvas search groups frames first and then orders elements spatially", () => {
	const matches = findCanvasSearchMatches(
		[
			element("lower", "rectangle", { y: 300, text: "Roadmap" }),
			element("upper", "text", { y: 20, text: "roadmap" }),
			element("frame", "frame", { y: 500, frameLabel: "Roadmap frame" }),
		],
		"roadmap",
	);

	assert.deepEqual(
		matches.map((match) => [match.elementId, match.kind]),
		[
			["frame", "frame"],
			["upper", "text"],
			["lower", "text"],
		],
	);
});

test("canvas search ignores empty queries and elements without searchable text", () => {
	const elements = [element("shape", "rectangle", {})];
	assert.deepEqual(findCanvasSearchMatches(elements, "  "), []);
	assert.deepEqual(findCanvasSearchMatches(elements, "shape"), []);
});
