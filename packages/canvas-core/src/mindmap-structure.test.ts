import assert from "node:assert/strict";
import { test } from "node:test";
import {
	applyCanvasMutationPlan,
	planMindmapChildMutation,
	planMindmapSiblingMutation,
} from "./editor-operations";
import {
	buildMindmapSyncUpdates,
	getMindmapEdgeMeta,
	getMindmapNodeMeta,
} from "./mindmap";
import {
	canReparentMindmapNode,
	createMindmapFromOutline,
	exportMindmapOutline,
	getMindmapHiddenIds,
	getMindmapLinkedCards,
	parseMindmapOutline,
	planMindmapLayout,
	planMindmapReparent,
} from "./mindmap-structure";
import { CanvasScene } from "./scene";
import type { CanvasElement } from "./types";

function fixture() {
	let id = 0;
	const all = createMindmapFromOutline(
		"Projekt\n  Planung\n    Recherche\n  Umsetzung\n    Prototyp",
		() => `id-${++id}`,
	);
	const map = new Map(all.map((el) => [el.id, el]));
	const node = (text: string) => {
		const result = all.find((el) => el.text === text);
		assert.ok(result);
		return result;
	};
	return { all, map, node };
}
const toMap = (all: CanvasElement[]) => new Map(all.map((el) => [el.id, el]));

test("outline import retains hierarchy, accepts Markdown and tabs, and exports hidden topics", () => {
	const { map, node } = fixture();
	assert.equal(
		getMindmapNodeMeta(node("Recherche"))?.mindmapParentId,
		node("Planung").id,
	);
	assert.equal(map.size, 9);
	const root = node("Projekt");
	map.set(root.id, {
		...root,
		customData: { ...root.customData, mindmapCollapsed: true },
	});
	const text = exportMindmapOutline(map, root.id);
	assert.equal(parseMindmapOutline(text).length, 5);
	assert.deepEqual(parseMindmapOutline("- Projekt\n\t* Idee\n\t\t1. Detail"), [
		{ depth: 0, text: "Projekt" },
		{ depth: 1, text: "Idee" },
		{ depth: 2, text: "Detail" },
	]);
	assert.equal(buildMindmapSyncUpdates(map).length, 0);
});

test("outline rejects ambiguous indentation, multiple roots and excessive input", () => {
	for (const text of [
		"",
		"Root\nOther",
		"Root\n   Wrong",
		"Root\n    Skipped",
		"x".repeat(501),
		`Root\n${"  Child\n".repeat(500)}`,
	]) {
		assert.throws(() => parseMindmapOutline(text));
	}
});

test("collapsed descendants and their edges are absent from render, hit and selection queries but remain persisted", () => {
	const { map, node } = fixture();
	const parent = node("Planung");
	const child = node("Recherche");
	map.set(parent.id, {
		...parent,
		customData: { ...parent.customData, mindmapCollapsed: true },
	});
	const hidden = getMindmapHiddenIds(map.values());
	assert.equal(hidden.size, 2);
	assert.ok(hidden.has(child.id));
	const scene = CanvasScene.from(map.values());
	assert.equal(scene.getSortedElements().length, 9);
	assert.equal(scene.getDisplayElements().length, 7);
	assert.equal(
		scene.getElementAtPosition(
			child.x + child.width / 2,
			child.y + child.height / 2,
		),
		null,
	);
	assert.ok(
		!scene
			.getElementsInRect({
				startX: -10000,
				startY: -10000,
				endX: 10000,
				endY: 10000,
			})
			.some((el) => el.id === child.id),
	);
	assert.ok(
		!scene
			.getVisibleElements(
				{ x: -10000, y: -10000, width: 20000, height: 20000 },
				new Set([child.id]),
			)
			.some((el) => el.id === child.id),
	);
});

test("expanding an ancestor preserves an independently collapsed nested branch", () => {
	const { map, node } = fixture();
	for (const text of ["Projekt", "Planung"]) {
		const el = node(text);
		map.set(el.id, {
			...el,
			customData: { ...el.customData, mindmapCollapsed: true },
		});
	}
	assert.equal(getMindmapHiddenIds(map.values()).size, 8);
	map.set(node("Projekt").id, node("Projekt"));
	assert.equal(getMindmapHiddenIds(map.values()).size, 2);
});

test("explicit layouts preserve root, avoid overlapping nodes and normalize edges atomically", () => {
	const { all, map, node } = fixture();
	for (const direction of ["balanced", "left", "right", "down"] as const) {
		const plan = planMindmapLayout(map, node("Recherche").id, direction);
		assert.ok(plan);
		const next = toMap(applyCanvasMutationPlan(all, plan));
		assert.equal(next.get(node("Projekt").id)?.x, node("Projekt").x);
		assert.equal(next.get(node("Projekt").id)?.y, node("Projekt").y);
		assert.equal(buildMindmapSyncUpdates(next).length, 0);
		const nodes = Array.from(next.values()).filter((el) =>
			getMindmapNodeMeta(el),
		);
		for (const a of nodes)
			for (const b of nodes)
				if (a.id !== b.id)
					assert.ok(
						a.x + a.width <= b.x ||
							b.x + b.width <= a.x ||
							a.y + a.height <= b.y ||
							b.y + b.height <= a.y,
					);
	}
	map.set(node("Recherche").id, { ...node("Recherche"), locked: true });
	assert.equal(planMindmapLayout(map, node("Projekt").id, "right"), null);
});

test("reparent preserves subtree and updates its edge, depth, color and expansion in one mutation", () => {
	const { all, map, node } = fixture();
	const moving = node("Planung");
	const parent = node("Umsetzung");
	map.set(parent.id, {
		...parent,
		customData: { ...parent.customData, mindmapCollapsed: true },
	});
	const plan = planMindmapReparent(map, moving.id, parent.id);
	assert.ok(plan);
	const next = toMap(applyCanvasMutationPlan(Array.from(map.values()), plan));
	assert.equal(next.size, all.length);
	assert.equal(
		getMindmapNodeMeta(next.get(moving.id))?.mindmapParentId,
		parent.id,
	);
	assert.equal(
		getMindmapNodeMeta(next.get(node("Recherche").id))?.mindmapDepth,
		3,
	);
	assert.equal(next.get(parent.id)?.customData?.mindmapCollapsed, false);
	const edge = Array.from(next.values()).find(
		(el) => getMindmapEdgeMeta(el)?.mindmapTargetId === moving.id,
	);
	assert.equal(getMindmapEdgeMeta(edge)?.mindmapSourceId, parent.id);
	assert.equal(buildMindmapSyncUpdates(next).length, 0);
	const placed = next.get(moving.id);
	const existing = node("Prototyp");
	assert.ok(placed);
	assert.ok(
		placed.x + placed.width <= existing.x ||
			existing.x + existing.width <= placed.x ||
			placed.y + placed.height <= existing.y ||
			existing.y + existing.height <= placed.y,
	);
});

test("reparent disallows root moves, self, cycles, existing parent and locked descendants", () => {
	const { map, node } = fixture();
	const root = node("Projekt");
	const a = node("Planung");
	const b = node("Umsetzung");
	const child = node("Recherche");
	for (const [from, to] of [
		[root, a],
		[a, a],
		[a, child],
		[a, root],
	])
		assert.equal(canReparentMindmapNode(map, from.id, to.id), false);
	map.set(child.id, { ...child, locked: true });
	assert.equal(planMindmapReparent(map, a.id, b.id), null);
});

test("creating a child expands its parent and starts editing the new topic", () => {
	const { map, node } = fixture();
	const parent = node("Planung");
	map.set(parent.id, {
		...parent,
		customData: { ...parent.customData, mindmapCollapsed: true },
	});
	let id = 0;
	const plan = planMindmapChildMutation({
		elements: map,
		parentId: parent.id,
		text: "Neu",
		createId: () => `new-${++id}`,
	});
	assert.ok(plan);
	assert.equal(
		plan.editingTextId,
		plan.create.find((el) => getMindmapNodeMeta(el))?.id,
	);
	const next = toMap(applyCanvasMutationPlan(Array.from(map.values()), plan));
	assert.equal(next.get(parent.id)?.customData?.mindmapCollapsed, false);
	assert.ok(!getMindmapHiddenIds(next.values()).has(plan.editingTextId ?? ""));
});

test("task links include only Kanban cards, not edges with the same source", () => {
	const { all, node } = fixture();
	const source = node("Planung");
	const card = {
		...source,
		id: "card",
		customData: { skedraType: "kanban-card", mindmapSourceId: source.id },
	};
	assert.deepEqual(getMindmapLinkedCards([...all, card], [source.id]), [card]);
	assert.deepEqual(
		getMindmapLinkedCards([...all, card], [node("Umsetzung").id]),
		[],
	);
});

test("reparenting across trees changes all descendant and edge tree references", () => {
	const { map, node } = fixture();
	let id = 0;
	const other = createMindmapFromOutline(
		"Other\n  Topic",
		() => `other-${++id}`,
	);
	for (const el of other) map.set(el.id, el);
	const moving = node("Planung");
	const plan = planMindmapReparent(map, moving.id, other[0].id);
	assert.ok(plan);
	const next = toMap(applyCanvasMutationPlan(Array.from(map.values()), plan));
	const tree = getMindmapNodeMeta(other[0])?.mindmapTreeId;
	for (const text of ["Planung", "Recherche"]) {
		const el = next.get(node(text).id);
		assert.equal(getMindmapNodeMeta(el)?.mindmapTreeId, tree);
		const edge = Array.from(next.values()).find(
			(edge) => getMindmapEdgeMeta(edge)?.mindmapTargetId === el?.id,
		);
		assert.equal(getMindmapEdgeMeta(edge)?.mindmapTreeId, tree);
	}
	assert.equal(buildMindmapSyncUpdates(next).length, 0);
});

test("repeating layout does not flip branches, and new children follow a directional layout", () => {
	const { all, map, node } = fixture();
	const root = node("Projekt");
	for (const direction of ["balanced", "left", "right", "down"] as const) {
		const first = planMindmapLayout(map, root.id, direction);
		assert.ok(first);
		const once = applyCanvasMutationPlan(all, first);
		const next = toMap(once);
		const second = planMindmapLayout(next, root.id, direction);
		assert.ok(second);
		assert.deepEqual(applyCanvasMutationPlan(once, second), once);
		if (direction !== "balanced") {
			let id = 0;
			const child = planMindmapChildMutation({
				elements: next,
				parentId: root.id,
				text: "New",
				createId: () => `new-${++id}`,
			});
			assert.ok(child);
			assert.equal(
				getMindmapNodeMeta(child.create[0])?.mindmapDirection,
				direction,
			);
		}
	}
});

test("long imported labels grow before layout instead of being clipped", () => {
	let id = 0;
	const all = createMindmapFromOutline(
		`Root\n  ${"Long description ".repeat(25)}`,
		() => `${++id}`,
	);
	const child = all.find((el) => getMindmapNodeMeta(el)?.mindmapDepth === 1);
	assert.ok(child);
	assert.ok(child.height > 56);
	assert.ok(child.width <= 360);
	assert.equal(buildMindmapSyncUpdates(toMap(all)).length, 0);
});

test("changing axis during reparent lays out the moved subtree without overlapping its children", () => {
	let id = 0;
	const all = createMindmapFromOutline(
		"Root\n  Branch\n    One\n    Two\n    Three\n  Target",
		() => `axis-${++id}`,
	);
	const map = toMap(all);
	const branch = all.find((el) => el.text === "Branch");
	const target = all.find((el) => el.text === "Target");
	assert.ok(branch);
	assert.ok(target);
	map.set(target.id, {
		...target,
		customData: { ...target.customData, mindmapDirection: "down" },
	});
	const plan = planMindmapReparent(map, branch.id, target.id);
	assert.ok(plan);
	const next = toMap(applyCanvasMutationPlan(Array.from(map.values()), plan));
	const moved = next.get(branch.id);
	assert.ok(moved);
	const children = Array.from(next.values()).filter(
		(el) => getMindmapNodeMeta(el)?.mindmapParentId === branch.id,
	);
	for (const child of children) {
		assert.ok(child.y > moved.y + moved.height);
		for (const other of children)
			if (other.id !== child.id)
				assert.ok(
					child.x + child.width <= other.x || other.x + other.width <= child.x,
				);
	}
	assert.equal(buildMindmapSyncUpdates(next).length, 0);
});

test("locked topics cannot gain children or siblings and root Enter respects its layout", () => {
	const { map, node } = fixture();
	const root = node("Projekt");
	let id = 0;
	map.set(root.id, { ...root, locked: true });
	assert.equal(
		planMindmapChildMutation({
			elements: map,
			parentId: root.id,
			text: "New",
			createId: () => `locked-${++id}`,
		}),
		null,
	);
	assert.equal(
		planMindmapSiblingMutation({
			elements: map,
			nodeId: node("Planung").id,
			text: "New",
			createId: () => `locked-${++id}`,
		}),
		null,
	);
	map.set(root.id, {
		...root,
		customData: { ...root.customData, mindmapLayout: "down" },
	});
	const plan = planMindmapSiblingMutation({
		elements: map,
		nodeId: root.id,
		text: "New",
		createId: () => `new-${++id}`,
	});
	assert.ok(plan);
	assert.equal(getMindmapNodeMeta(plan.create[0])?.mindmapDirection, "down");
});
