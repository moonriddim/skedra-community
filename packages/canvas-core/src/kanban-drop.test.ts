import assert from "node:assert/strict";
import test from "node:test";
import {
	applyCanvasElementUpdates,
	buildCanvasMoveUpdates,
	buildKanbanDropUpdates,
} from "./editor-operations";
import { createKanbanListElements } from "./element-factory";
import {
	KANBAN_LIST_PADDING,
	buildKanbanDeletionReflowUpdates,
	buildKanbanListReflowUpdates,
	buildKanbanQuickEditUpdates,
	resolveKanbanDropTarget,
} from "./kanban";
import type { CanvasElement } from "./types";

const toMap = (elements: CanvasElement[]) =>
	new Map(elements.map((element) => [element.id, element]));

test("the insertion preview and final order follow the pointer above, between and below cards", () => {
	const { elements, source, card, sibling, target } = fixture();
	const floating = {
		...card,
		id: "floating",
		frameId: undefined,
		x: 600,
		y: -300,
		height: 600,
	};
	const map = toMap([...elements, floating]);
	const first = get(map, card.id);
	const last = get(map, sibling.id);
	for (const [index, y] of [
		source.y + 10,
		last.y - 4,
		last.y + last.height - 5,
	].entries()) {
		const point = { x: source.x + 40, y };
		const preview = resolveKanbanDropTarget(map, [floating.id], point);
		assert.ok(preview);
		assert.equal(preview.index, index);
		assert.equal(preview.listId, source.id);
		if (index === 0) assert.ok(preview.y <= first.y);
		if (index === 1)
			assert.ok(preview.y > first.y + first.height && preview.y < last.y);
		if (index === 2) assert.ok(preview.y > last.y + last.height);
		const after = applyCanvasElementUpdates(
			[...map.values()],
			buildKanbanDropUpdates(map, [floating.id], point),
		);
		const ordered = after
			.filter((el) => el.frameId === source.id)
			.sort((a, b) => a.y - b.y);
		assert.equal(ordered[index].id, floating.id);
	}
	assert.equal(
		resolveKanbanDropTarget(map, [floating.id], { x: 1200, y: 500 }),
		null,
	);
	assert.equal(
		resolveKanbanDropTarget(map, [source.id, card.id, sibling.id], {
			x: 350,
			y: 10,
		}),
		null,
	);
	const empty = resolveKanbanDropTarget(map, [floating.id], {
		x: target.x + 20,
		y: 10,
	});
	assert.equal(empty?.index, 0);
});

function get(elements: Map<string, CanvasElement>, id: string): CanvasElement {
	const element = elements.get(id);
	assert.ok(element);
	return element;
}

function fixture() {
	let id = 0;
	const defaults = { createId: () => `kanban-${id++}`, stroke: "#111" };
	const [source, card, sibling] = createKanbanListElements(defaults, {
		x: 0,
		y: 0,
		name: "Source",
		cardTitles: ["Tall card", "Sibling"],
	});
	const [target] = createKanbanListElements(defaults, {
		x: 340,
		y: 0,
		name: "Target",
		cardTitles: [],
	});
	card.height = 480;
	const initial = [source, card, sibling, target];
	const elements = applyCanvasElementUpdates(
		initial,
		buildKanbanListReflowUpdates(toMap(initial), source.id),
	);
	return { elements, source, card, sibling, target };
}

test("a tall card snaps into a short list at the release point and both lists resize", () => {
	const { elements, source, card, sibling, target } = fixture();
	const dragged = elements.map((el) =>
		el.id === card.id ? { ...el, x: target.x + 20, y: 10 } : el,
	);
	const before = toMap(dragged);
	assert.ok(card.height / 2 > target.height);
	const after = toMap(
		applyCanvasElementUpdates(
			dragged,
			buildKanbanDropUpdates(before, [card.id], { x: target.x + 40, y: 25 }),
		),
	);
	const snapped = get(after, card.id);
	assert.equal(snapped.frameId, target.id);
	assert.equal(snapped.x, target.x + KANBAN_LIST_PADDING);
	assert.equal(snapped.width, target.width - KANBAN_LIST_PADDING * 2);
	assert.ok(get(after, target.id).height > target.height);
	assert.ok(snapped.y + snapped.height < get(after, target.id).height);
	assert.ok(get(after, source.id).height < get(before, source.id).height);
	assert.ok(get(after, sibling.id).y < get(before, sibling.id).y);
	assert.equal(
		get(before, card.id).frameId,
		source.id,
		"input stays immutable",
	);
});

test("pulling a card outside releases it and closes the gap in its old list", () => {
	const { elements, source, card, sibling } = fixture();
	const dragged = elements.map((el) =>
		el.id === card.id ? { ...el, x: 900, y: 200 } : el,
	);
	const after = toMap(
		applyCanvasElementUpdates(
			dragged,
			buildKanbanDropUpdates(toMap(dragged), [card.id], { x: 930, y: 230 }),
		),
	);
	assert.equal(get(after, card.id).frameId, undefined);
	assert.equal(get(after, card.id).x, 900);
	assert.equal(get(after, card.id).y, 200);
	assert.ok(
		get(after, source.id).height < get(toMap(elements), source.id).height,
	);
	assert.equal(get(after, sibling.id).y, get(toMap(elements), card.id).y);
});

test("cards can be reordered and the last card leaving collapses the list to its empty height", () => {
	const { elements, source, card, sibling, target } = fixture();
	const reordered = elements.map((el) =>
		el.id === sibling.id ? { ...el, y: 5 } : el,
	);
	let next = applyCanvasElementUpdates(
		reordered,
		buildKanbanDropUpdates(toMap(reordered), [sibling.id], { x: 30, y: 20 }),
	);
	assert.deepEqual(
		next
			.filter((el) => el.frameId === source.id)
			.sort((a, b) => a.y - b.y)
			.map((el) => el.id),
		[sibling.id, card.id],
	);
	for (const id of [card.id, sibling.id]) {
		next = applyCanvasElementUpdates(
			next,
			buildKanbanDropUpdates(toMap(next), [id], { x: 1000, y: 1000 }),
		);
	}
	assert.equal(get(toMap(next), source.id).height, target.height);
});

test("moving an entire column over another preserves its membership and layout", () => {
	const { elements, source, card, sibling, target } = fixture();
	const moveStart = new Map([[source.id, { x: source.x, y: source.y }]]);
	const dragged = applyCanvasElementUpdates(
		elements,
		buildCanvasMoveUpdates(toMap(elements), moveStart, target.x, 0),
	);
	assert.ok(moveStart.has(card.id));
	assert.ok(moveStart.has(sibling.id));
	const after = toMap(
		applyCanvasElementUpdates(
			dragged,
			buildKanbanDropUpdates(toMap(dragged), moveStart.keys(), {
				x: 360,
				y: 20,
			}),
		),
	);
	for (const id of [source.id, card.id, sibling.id]) {
		for (const key of ["x", "y", "width", "height", "frameId"] as const)
			assert.equal(get(after, id)[key], get(toMap(dragged), id)[key]);
	}
});

test("drops without a pointer keep center-based targeting and locked cards stay unchanged", () => {
	const { elements, source, card, target } = fixture();
	const dragged = elements.map((el) =>
		el.id === card.id ? { ...el, x: target.x + 20, y: 0, height: 60 } : el,
	);
	const after = toMap(
		applyCanvasElementUpdates(
			dragged,
			buildKanbanDropUpdates(toMap(dragged), [card.id]),
		),
	);
	assert.equal(get(after, card.id).frameId, target.id);
	const locked = toMap(dragged);
	locked.set(card.id, { ...get(locked, card.id), locked: true });
	assert.deepEqual(buildKanbanDropUpdates(locked, [card.id]), []);
	assert.equal(get(locked, card.id).frameId, source.id);
});

test("explicit drops at either outer edge create independent columns and match their preview", () => {
	for (const side of ["left", "right"] as const) {
		const { elements, source, card, sibling } = fixture();
		const floating = {
			...sibling,
			id: "floating",
			frameId: undefined,
			x: 900,
			y: 20,
		};
		const initial = [...elements, floating];
		const map = toMap(initial);
		const point = {
			x: side === "left" ? source.x - 30 : source.x + source.width - 15,
			y: get(map, sibling.id).y + 30,
		};
		const preview = resolveKanbanDropTarget(map, [floating.id], point);
		assert.ok(preview);
		assert.equal(preview.mode, "beside");
		const after = toMap(
			applyCanvasElementUpdates(
				initial,
				buildKanbanDropUpdates(map, [floating.id], point),
			),
		);
		assert.equal(get(after, floating.id).y, get(after, card.id).y);
		assert.equal(get(after, floating.id).width, 256);
		assert.equal(get(after, floating.id).x, preview.x);
		assert.equal(get(after, source.id).x, preview.listBounds.x);
		assert.equal(get(after, source.id).width, preview.listBounds.width);
		assert.equal(get(after, source.id).height, preview.listBounds.height);
		assert.equal(
			get(after, floating.id).customData?.kanbanColumn,
			side === "left" ? 0 : 1,
		);
		assert.equal(
			get(after, card.id).x,
			get(map, card.id).x,
			"existing column stays in place",
		);
		const edited = toMap(
			applyCanvasElementUpdates(
				[...after.values()],
				buildKanbanQuickEditUpdates(after, floating.id, { title: "Updated" }),
			),
		);
		assert.equal(get(edited, floating.id).y, get(edited, card.id).y);
		assert.equal(get(edited, sibling.id).y, get(after, sibling.id).y);
		const stacked = toMap(
			applyCanvasElementUpdates(
				[...edited.values()],
				buildKanbanDropUpdates(edited, [floating.id], {
					x: get(edited, card.id).x + 100,
					y: 20,
				}),
			),
		);
		assert.equal(get(stacked, source.id).width, source.width);
		assert.equal(get(stacked, floating.id).customData?.kanbanColumn, 0);
		assert.ok(get(stacked, floating.id).y < get(stacked, sibling.id).y);
		const remaining = [...after.values()].filter((el) => el.id !== floating.id);
		const deleted = toMap(
			applyCanvasElementUpdates(
				remaining,
				buildKanbanDeletionReflowUpdates(after, [floating.id]),
			),
		);
		assert.equal(get(deleted, source.id).width, source.width);
		assert.equal(
			get(deleted, sibling.id).x,
			get(deleted, source.id).x + KANBAN_LIST_PADDING,
		);
	}
});

test("legacy rows become independent stacks and reorder within either column", () => {
	const { elements, source, card, sibling } = fixture();
	const short = {
		...get(toMap(elements), sibling.id),
		x: 12,
		y: 50,
		customData: {
			...sibling.customData,
			kanbanRow: "row-one",
			kanbanColumn: undefined,
		},
	};
	const tall = {
		...get(toMap(elements), card.id),
		x: 278,
		y: 50,
		customData: {
			...card.customData,
			kanbanRow: "row-one",
			kanbanColumn: undefined,
		},
	};
	const second = {
		...short,
		id: "second-left",
		y: 540,
		customData: { ...short.customData, kanbanRow: "row-two" },
	};
	const initial = [{ ...source, width: 546 }, short, tall, second];
	const after = toMap(
		applyCanvasElementUpdates(
			initial,
			buildKanbanListReflowUpdates(toMap(initial), source.id),
		),
	);
	assert.equal(get(after, second.id).y, short.y + short.height + 10);
	assert.equal(get(after, tall.id).y, short.y);
	assert.equal(get(after, source.id).height, 50 + tall.height + 54);
	assert.equal(get(after, second.id).customData?.kanbanColumn, 0);
	assert.equal(get(after, tall.id).customData?.kanbanColumn, 1);
	assert.equal(get(after, second.id).customData?.kanbanRow, undefined);
	// Resize content on the right without disturbing either left card.
	const edited = toMap(
		applyCanvasElementUpdates(
			[...after.values()],
			buildKanbanQuickEditUpdates(after, tall.id, { title: "Short now" }),
		),
	);
	assert.equal(get(edited, second.id).y, get(after, second.id).y);
	for (const [column, x, y, index] of [
		[0, 120, 55, 0],
		[1, 390, 400, 1],
	]) {
		const point = { x, y };
		const preview = resolveKanbanDropTarget(after, [second.id], point);
		assert.equal(preview?.column, column);
		assert.equal(preview?.index, index);
		assert.equal(preview?.width, 256);
		const reordered = toMap(
			applyCanvasElementUpdates(
				[...after.values()],
				buildKanbanDropUpdates(after, [second.id], point),
			),
		);
		assert.equal(get(reordered, second.id).customData?.kanbanColumn, column);
		assert.equal(
			get(reordered, second.id).y,
			column === 0 ? 50 : tall.y + tall.height + 10,
		);
		assert.equal(get(reordered, source.id).height, preview?.listBounds.height);
	}
});

test("wide legacy lists normalize without creating extra columns and normal drops stay vertical", () => {
	const { elements, source, card, sibling } = fixture();
	const wide = elements.map((el) =>
		el.id === source.id ? { ...el, width: 900 } : el,
	);
	const normalized = toMap(
		applyCanvasElementUpdates(
			wide,
			buildKanbanListReflowUpdates(toMap(wide), source.id),
		),
	);
	assert.equal(get(normalized, source.id).width, 280);
	assert.ok(get(normalized, sibling.id).y > get(normalized, card.id).y);
	const preview = resolveKanbanDropTarget(normalized, [sibling.id], {
		x: 140,
		y: 80,
	});
	assert.equal(preview?.mode, "between");
});
