import assert from "node:assert/strict";
import test from "node:test";
import { applyCanvasElementUpdates } from "./editor-operations.js";
import { createKanbanListElements } from "./element-factory.js";
import {
	buildKanbanQuickEditUpdates,
	normalizeKanbanChecklist,
} from "./kanban.js";

test("quick edits preserve other fields, reflow following cards and reject locked cards", () => {
	let sequence = 0;
	const elements = createKanbanListElements(
		{ createId: () => `card-${sequence++}`, stroke: "#111" },
		{ x: 0, y: 0, name: "Tasks", cardTitles: ["First", "Second"] },
	);
	const card = elements[1];
	assert.ok(card);
	card.customData = {
		...card.customData,
		description: "Keep description",
		priority: "urgent",
		dueDate: "2026-10-01T14:30",
		checklist: [
			{ id: "a", text: "First task", completed: false },
			{ id: "b", text: "Second task", completed: true },
		],
	};
	const map = new Map(elements.map((element) => [element.id, element]));
	const updates = buildKanbanQuickEditUpdates(map, card.id, {
		toggleChecklistItem: "a",
	});
	const next = applyCanvasElementUpdates(elements, updates);
	const changed = next.find((element) => element.id === card.id);
	assert.ok(changed);
	assert.equal(changed.customData?.description, "Keep description");
	assert.equal(changed.customData?.dueDate, "2026-10-01T14:30");
	assert.equal(changed.customData?.priority, "urgent");
	assert.deepEqual(
		normalizeKanbanChecklist(changed.customData?.checklist).map(
			(item) => item.completed,
		),
		[true, true],
	);
	assert.equal(
		normalizeKanbanChecklist(card.customData.checklist)[0].completed,
		false,
	);
	const following = next.find((element) => element.id === elements[2].id);
	assert.ok(following);
	assert.ok(following.y >= changed.y + changed.height);
	const renamed = buildKanbanQuickEditUpdates(
		new Map(next.map((element) => [element.id, element])),
		card.id,
		{ title: "Renamed" },
	);
	assert.equal(renamed[0].changes.text, "Renamed");
	assert.deepEqual(
		renamed[0].changes.customData?.checklist,
		changed.customData?.checklist,
	);
	assert.equal(
		buildKanbanQuickEditUpdates(map, card.id, { dueDate: null })[0].changes
			.customData?.dueDate,
		null,
	);
	map.set(card.id, { ...card, locked: true });
	assert.deepEqual(
		buildKanbanQuickEditUpdates(map, card.id, { title: "Forbidden" }),
		[],
	);
	assert.deepEqual(
		buildKanbanQuickEditUpdates(map, "missing", { title: "Missing" }),
		[],
	);
});
