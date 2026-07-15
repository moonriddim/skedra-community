import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildFrameConstraintsChange,
	buildFrameDropUpdates,
	buildFrameResizeChildUpdates,
	buildFrameSizeUpdates,
	findPlainFrameAtPoint,
	readFrameConstraints,
} from "./frame-membership";
import type { CanvasElement } from "./types";

function element(
	id: string,
	overrides: Partial<CanvasElement> = {},
): CanvasElement {
	return {
		id,
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 80,
		rotation: 0,
		fill: "transparent",
		stroke: "#111111",
		strokeWidth: 1,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		...overrides,
	} as CanvasElement;
}

function frame(id: string, overrides: Partial<CanvasElement> = {}) {
	return element(id, {
		type: "frame",
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		frameLabel: "Frame",
		...overrides,
	});
}

function toMap(items: CanvasElement[]) {
	return new Map(items.map((item) => [item.id, item]));
}

test("dropped elements adopt the plain frame under their center", () => {
	const screen = frame("screen");
	const box = element("box", { x: 50, y: 50 });
	const outside = element("outside", { x: 900, y: 900 });
	const elements = toMap([screen, box, outside]);

	const updates = buildFrameDropUpdates(elements, ["box", "outside"]);
	assert.deepEqual(updates, [{ id: "box", changes: { frameId: "screen" } }]);
});

test("elements dragged out of a frame release their membership", () => {
	const screen = frame("screen");
	const box = element("box", { x: 900, y: 900, frameId: "screen" });
	const elements = toMap([screen, box]);

	const updates = buildFrameDropUpdates(elements, ["box"]);
	assert.deepEqual(updates, [{ id: "box", changes: { frameId: undefined } }]);
});

test("membership stays stable while the center remains inside the frame", () => {
	const screen = frame("screen");
	const overlay = frame("overlay", { x: 0, y: 0 });
	const box = element("box", { x: 50, y: 50, frameId: "screen" });
	const elements = toMap([screen, overlay, box]);

	/* Ueberlappender zweiter Frame stiehlt keine bestehenden Kinder. */
	assert.deepEqual(buildFrameDropUpdates(elements, ["box"]), []);
});

test("special frame members are ignored by frame adoption", () => {
	const list = frame("list", { customData: { skedraType: "kanban-list" } });
	const card = element("card", {
		x: 10,
		y: 60,
		frameId: "list",
		customData: { skedraType: "kanban-card" },
	});
	const elements = toMap([list, card]);

	assert.deepEqual(buildFrameDropUpdates(elements, ["card"]), []);
});

test("findPlainFrameAtPoint skips special frames and excluded ids", () => {
	const screen = frame("screen");
	const list = frame("list", {
		x: 0,
		y: 0,
		customData: { skedraType: "kanban-list" },
	});
	const elements = toMap([screen, list]);

	assert.equal(findPlainFrameAtPoint(elements, 10, 10)?.id, "screen");
	assert.equal(
		findPlainFrameAtPoint(elements, 10, 10, new Set(["screen"])),
		null,
	);
});

test("constraints default to start/start and round-trip through customData", () => {
	const box = element("box");
	assert.deepEqual(readFrameConstraints(box), {
		horizontal: "start",
		vertical: "start",
	});

	const changed = buildFrameConstraintsChange(box, { horizontal: "end" });
	const updated = { ...box, ...changed };
	assert.deepEqual(readFrameConstraints(updated), {
		horizontal: "end",
		vertical: "start",
	});
});

test("frame resize honors constraints per axis", () => {
	const screen = frame("screen", { width: 400, height: 300 });
	const anchoredEnd = element("end", {
		x: 300,
		y: 0,
		width: 80,
		height: 40,
		frameId: "screen",
		customData: { frameConstraints: { horizontal: "end", vertical: "start" } },
	});
	const centered = element("center", {
		x: 150,
		y: 100,
		width: 100,
		height: 40,
		frameId: "screen",
		customData: {
			frameConstraints: { horizontal: "center", vertical: "start" },
		},
	});
	const scaled = element("scaled", {
		x: 100,
		y: 100,
		width: 200,
		height: 100,
		frameId: "screen",
		customData: {
			frameConstraints: { horizontal: "scale", vertical: "scale" },
		},
	});
	const anchored = element("anchored", {
		x: 20,
		y: 20,
		frameId: "screen",
	});
	const elements = toMap([screen, anchoredEnd, centered, scaled, anchored]);

	/* Frame von 400x300 auf 800x600 vergroessern (linke obere Ecke fix). */
	const updates = buildFrameResizeChildUpdates(
		elements,
		"screen",
		{ x: 0, y: 0, width: 400, height: 300 },
		{ x: 0, y: 0, width: 800, height: 600 },
	);
	const byId = new Map(updates.map((update) => [update.id, update.changes]));

	/* end: Abstand zur rechten Kante bleibt 20 → x = 800 - 20 - 80 */
	assert.equal(byId.get("end")?.x, 700);
	/* center: Mittelpunkt bei 50% → 400 - 50 */
	assert.equal(byId.get("center")?.x, 350);
	/* scale: Position und Groesse verdoppeln sich */
	assert.equal(byId.get("scaled")?.x, 200);
	assert.equal(byId.get("scaled")?.width, 400);
	assert.equal(byId.get("scaled")?.height, 200);
	/* start (Default): keine Aenderung noetig */
	assert.equal(byId.has("anchored"), false);
});

test("buildFrameSizeUpdates resizes the frame and its children together", () => {
	const screen = frame("screen", { width: 400, height: 300 });
	const scaled = element("scaled", {
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		frameId: "screen",
		customData: {
			frameConstraints: { horizontal: "scale", vertical: "scale" },
		},
	});
	const elements = toMap([screen, scaled]);

	const updates = buildFrameSizeUpdates(elements, "screen", {
		width: 200,
		height: 150,
	});
	const frameUpdate = updates.find((update) => update.id === "screen");
	const childUpdate = updates.find((update) => update.id === "scaled");
	assert.deepEqual(frameUpdate?.changes, { width: 200, height: 150 });
	assert.equal(childUpdate?.changes.width, 200);
	assert.equal(childUpdate?.changes.height, 150);
});
