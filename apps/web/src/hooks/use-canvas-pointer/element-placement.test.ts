import assert from "node:assert/strict";
import test from "node:test";
import {
	createElementPlacementDraft,
	placeElementDraft,
} from "@skedra/canvas-core";
import {
	type CanvasElement,
	type CanvasMutationPlan,
	CanvasScene,
	getCombinedBBox,
} from "@skedra/canvas-core";
import type { CanvasStoreState } from "../use-canvas-store";
import { handlePlacementPointerDown } from "./pointer-placement-down";

function rectangle(id: string, x: number, locked = false): CanvasElement {
	return {
		id,
		type: "rectangle",
		x,
		y: 20,
		width: 100,
		height: 80,
		rotation: 0,
		flipX: false,
		flipY: false,
		fill: "#fff",
		stroke: "#000",
		strokeWidth: 1,
		strokeStyle: "solid",
		opacity: 100,
		locked,
		groupId: "template",
	};
}

test("placement moves locked template parts and linked paths together without mutating the draft", () => {
	const elements = [
		rectangle("a", 10),
		rectangle("b", 250, true),
		{
			...rectangle("edge", 110),
			type: "arrow" as const,
			width: 140,
			height: 0,
			points: [
				[0, 0],
				[140, 0],
			] as [number, number][],
			startBinding: {
				elementId: "a",
				fixedPoint: [1, 0.5] as [number, number],
			},
			endBinding: { elementId: "b", fixedPoint: [0, 0.5] as [number, number] },
		},
	];
	const before = structuredClone(elements);
	const draft = createElementPlacementDraft(elements);
	assert.ok(draft);
	const placed = placeElementDraft(draft, 800, -200);
	const bounds = getCombinedBBox(placed);
	assert.ok(bounds);
	assert.equal(bounds.x + bounds.width / 2, 800);
	assert.equal(bounds.y + bounds.height / 2, -200);
	assert.equal(placed[1].x - placed[0].x, 240);
	assert.equal(placed[1].locked, true);
	assert.deepEqual(placed[2].points, elements[2].points);
	assert.deepEqual(placed[2].endBinding, elements[2].endBinding);
	assert.deepEqual(elements, before);
});

test("a template is committed only on placement, as one mutation with history boundaries", () => {
	const draft = createElementPlacementDraft([
		rectangle("a", 10),
		rectangle("b", 250, true),
	]);
	assert.ok(draft);
	const state: Pick<
		CanvasStoreState,
		| "elementPlacementDraft"
		| "selectedIds"
		| "clearElementPlacementDraft"
		| "setSelectedIds"
	> = {
		elementPlacementDraft: draft,
		selectedIds: new Set<string>(),
		clearElementPlacementDraft: () => {
			state.elementPlacementDraft = null;
		},
		setSelectedIds: (ids: Set<string>) => {
			state.selectedIds = ids;
		},
	};
	const plans: CanvasMutationPlan[] = [];
	const events: string[] = [];
	assert.equal(plans.length, 0);
	const handled = handlePlacementPointerDown({
		elements: new Map(),
		scene: CanvasScene.from([]),
		snappedX: 999,
		snappedY: 999,
		clientX: 500,
		clientY: 400,
		store: state as CanvasStoreState,
		createElement: () => assert.fail("use the atomic mutation path"),
		applyMutationPlan: (plan) => {
			events.push("commit");
			plans.push(plan);
		},
		stopUndoCapture: () => {
			events.push("boundary");
		},
		updateElements: () => {},
		resolveCenteredPlacementSnap: (x, y) => ({
			centerX: x / 2 - 30,
			centerY: y / 2 + 50,
		}),
		setDrawingPreview: () => {},
		clearSnapVisuals: () => {},
		theme: { resolvedTheme: "light" },
	});
	assert.equal(handled, true);
	assert.deepEqual(plans[0].create, placeElementDraft(draft, 220, 250));
	assert.deepEqual(events, ["boundary", "commit", "boundary"]);
	assert.equal(state.elementPlacementDraft, null);
	assert.deepEqual([...state.selectedIds], ["a", "b"]);
});
