import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildBringForwardUpdates,
	buildBringToFrontUpdates,
	buildSendBackwardUpdates,
	buildSendToBackUpdates,
	createStackIndexAfter,
	createStackIndexAfterElement,
	createStackIndexBeforeElement,
	normalizeCanvasElementStackIndexes,
	sortCanvasElements,
} from "./ordering.js";
import type { CanvasElement } from "./types.js";

function element(id: string, stackIndex?: string): CanvasElement {
	return {
		id,
		type: "rectangle",
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		rotation: 0,
		fill: "transparent",
		stroke: "#000",
		strokeWidth: 1,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		stackIndex,
		flipX: false,
		flipY: false,
	};
}

test("normalizes missing stack indexes into deterministic stack order", () => {
	const normalized = normalizeCanvasElementStackIndexes([
		element("b"),
		element("a"),
		element("c"),
	]);

	assert.deepEqual(
		normalized.map((item) => item.id),
		["a", "b", "c"],
	);
	assert.ok(normalized.every((item) => typeof item.stackIndex === "string"));
});

test("sorts by stackIndex", () => {
	const normalized = normalizeCanvasElementStackIndexes([
		element("a"),
		element("b"),
	]);
	const sorted = sortCanvasElements([normalized[1], normalized[0]]);

	assert.deepEqual(
		sorted.map((item) => item.id),
		["a", "b"],
	);
});

test("builds stack movement updates", () => {
	const elements = normalizeCanvasElementStackIndexes([
		element("a"),
		element("b"),
		element("c"),
	]);

	const bringForward = applyUpdates(
		elements,
		buildBringForwardUpdates(elements, new Set(["a"])),
	);
	assert.deepEqual(
		sortCanvasElements(bringForward).map((item) => item.id),
		["b", "a", "c"],
	);
	assert.deepEqual(
		buildBringForwardUpdates(elements, new Set(["a"])).map(
			(update) => update.id,
		),
		["a"],
	);

	const sendBackward = applyUpdates(
		elements,
		buildSendBackwardUpdates(elements, new Set(["c"])),
	);
	assert.deepEqual(
		sortCanvasElements(sendBackward).map((item) => item.id),
		["a", "c", "b"],
	);
	assert.deepEqual(
		buildSendBackwardUpdates(elements, new Set(["c"])).map(
			(update) => update.id,
		),
		["c"],
	);

	const bringToFront = applyUpdates(
		elements,
		buildBringToFrontUpdates(elements, new Set(["a"])),
	);
	assert.deepEqual(
		sortCanvasElements(bringToFront).map((item) => item.id),
		["b", "c", "a"],
	);
	assert.deepEqual(
		buildBringToFrontUpdates(elements, new Set(["a"])).map(
			(update) => update.id,
		),
		["a"],
	);

	const sendToBack = applyUpdates(
		elements,
		buildSendToBackUpdates(elements, new Set(["c"])),
	);
	assert.deepEqual(
		sortCanvasElements(sendToBack).map((item) => item.id),
		["c", "a", "b"],
	);
	assert.deepEqual(
		buildSendToBackUpdates(elements, new Set(["c"])).map((update) => update.id),
		["c"],
	);
});

test("keeps unaffected stack indexes stable when moving groups", () => {
	const elements = normalizeCanvasElementStackIndexes([
		element("a"),
		element("b"),
		element("c"),
		element("d"),
	]);
	const updates = buildBringToFrontUpdates(elements, new Set(["b", "c"]));
	const updatedIds = updates.map((update) => update.id);
	const next = applyUpdates(elements, updates);

	assert.deepEqual(updatedIds, ["b", "c"]);
	assert.deepEqual(
		sortCanvasElements(next).map((item) => item.id),
		["a", "d", "b", "c"],
	);
	assert.equal(
		next.find((item) => item.id === "a")?.stackIndex,
		elements.find((item) => item.id === "a")?.stackIndex,
	);
	assert.equal(
		next.find((item) => item.id === "d")?.stackIndex,
		elements.find((item) => item.id === "d")?.stackIndex,
	);
});

test("creates stack indexes around existing elements", () => {
	const elements = normalizeCanvasElementStackIndexes([
		element("a"),
		element("b"),
		element("c"),
	]);
	const beforeB = {
		...element("before-b"),
		stackIndex: createStackIndexBeforeElement(elements, "b"),
	};
	const afterB = {
		...element("after-b"),
		stackIndex: createStackIndexAfterElement(elements, "b"),
	};

	assert.deepEqual(
		sortCanvasElements([...elements, beforeB]).map((item) => item.id),
		["a", "before-b", "b", "c"],
	);
	assert.deepEqual(
		sortCanvasElements([...elements, afterB]).map((item) => item.id),
		["a", "b", "after-b", "c"],
	);
});

test("creates distinct concurrent stack indexes with tie breakers", () => {
	const elements = normalizeCanvasElementStackIndexes([
		element("a"),
		element("b"),
	]);
	const first = {
		...element("client-a"),
		stackIndex: createStackIndexAfter(elements, "client-a"),
	};
	const second = {
		...element("client-b"),
		stackIndex: createStackIndexAfter(elements, "client-b"),
	};

	assert.notEqual(first.stackIndex, second.stackIndex);
	assert.deepEqual(
		sortCanvasElements([...elements, second, first]).map((item) => item.id),
		["a", "b", "client-a", "client-b"],
	);
});

function applyUpdates(
	elements: CanvasElement[],
	updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
) {
	const byId = new Map(updates.map((update) => [update.id, update.changes]));
	return elements.map((item) => ({ ...item, ...(byId.get(item.id) ?? {}) }));
}
