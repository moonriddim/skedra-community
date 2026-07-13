import assert from "node:assert/strict";
import { test } from "node:test";
import {
	type CanvasElement,
	type CanvasMutationAdapter,
	type CanvasMutationPlan,
	applyCanvasMutationPlan,
	buildTemplateDropUpdates,
	createBaseCanvasElement,
	createCanvasTemplateElements,
	createCanvasTemplateStickyNote,
	createKanbanCardElement,
	createKanbanListElements,
	executeCanvasMutationPlan,
	getTemplateSectionMeta,
	planCanvasNormalization,
	planKanbanCardInsertion,
	toCanvasElementMap,
} from "@skedra/canvas-core";
import * as Y from "yjs";
import {
	yjsCreateElement,
	yjsDeleteElements,
	yjsUpdateElements,
} from "./yjs-canvas-mutations";
import { readCanvasMapsFromYDoc } from "./yjs-document-helpers";

function idFactory(prefix = "id") {
	let index = 0;
	return () => `${prefix}-${index++}`;
}

function canonicalElements(elements: Iterable<CanvasElement>) {
	return Array.from(elements, (element) => {
		const { stackIndex: _stackIndex, ...comparable } = element;
		return JSON.parse(JSON.stringify(comparable)) as Record<string, unknown>;
	}).sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function applyThroughWebAdapter(
	initialElements: readonly CanvasElement[],
	plan: CanvasMutationPlan,
) {
	const ydoc = new Y.Doc();
	for (const element of initialElements) yjsCreateElement(ydoc, element);

	const adapter: CanvasMutationAdapter = {
		createElement: (element) => yjsCreateElement(ydoc, element),
		updateElements: (updates) => yjsUpdateElements(ydoc, updates),
		deleteElements: (ids) => yjsDeleteElements(ydoc, ids),
	};
	executeCanvasMutationPlan(plan, adapter);
	const afterMutation = readCanvasMapsFromYDoc(ydoc).elements;
	executeCanvasMutationPlan(planCanvasNormalization(afterMutation), adapter);
	const result = Array.from(readCanvasMapsFromYDoc(ydoc).elements.values());
	ydoc.destroy();
	return result;
}

function assertAdapterParity(
	initialElements: readonly CanvasElement[],
	plan: CanvasMutationPlan,
) {
	const sdkResult = applyCanvasMutationPlan(initialElements, plan);
	const webResult = applyThroughWebAdapter(initialElements, plan);
	assert.deepEqual(canonicalElements(webResult), canonicalElements(sdkResult));
	return sdkResult;
}

test("Kanban insertion creates and reflows the new card in both adapters", () => {
	const defaults = { createId: idFactory("kanban"), stroke: "#111" };
	const initialElements = createKanbanListElements(defaults, {
		x: 100,
		y: 100,
		name: "Todo",
		cardTitles: ["Existing"],
	});
	const list = initialElements[0];
	const card = createKanbanCardElement(defaults, {
		x: list.x,
		y: list.y + list.height + 1_000,
		title: "New card",
	});
	const plan = planKanbanCardInsertion({
		elements: toCanvasElementMap(initialElements),
		listId: list.id,
		card,
	});
	assert.ok(plan);

	const result = assertAdapterParity(initialElements, plan);
	const inserted = result.find((element) => element.id === card.id);
	assert.ok(inserted);
	assert.equal(inserted.frameId, list.id);
	assert.ok(inserted.y >= list.y && inserted.y < list.y + list.height);
});

test("multiple updates for one id preserve every changed field in both adapters", () => {
	const element = createBaseCanvasElement(
		{ createId: () => "shape", stroke: "#111" },
		{ type: "rectangle", x: 10, y: 20, width: 77, height: 55 },
	);
	const result = assertAdapterParity([element], {
		create: [],
		update: [
			{ id: element.id, changes: { width: 160, height: 124 } },
			{ id: element.id, changes: { x: 80, y: 90 } },
		],
		deleteIds: [],
	});
	assert.deepEqual(
		result.map(({ x, y, width, height }) => ({ x, y, width, height })),
		[{ x: 80, y: 90, width: 160, height: 124 }],
	);
});

test("expanding SWOT layout keeps note size and position identical", () => {
	const defaults = {
		createId: idFactory("swot"),
		stroke: "#111",
		fontFamily: "Inter",
	};
	const initialElements = createCanvasTemplateElements({
		id: "swot",
		x: 0,
		y: 0,
		defaults,
	});
	const strengths = initialElements.find(
		(element) =>
			getTemplateSectionMeta(element)?.templateSectionId === "strengths",
	);
	const opportunities = initialElements.find(
		(element) =>
			getTemplateSectionMeta(element)?.templateSectionId === "opportunities",
	);
	assert.ok(strengths);
	assert.ok(opportunities);

	for (let index = 0; index < 8; index++) {
		const note = createCanvasTemplateStickyNote({
			defaults,
			section: strengths,
			existingElements: initialElements,
			text: `Strength ${index}`,
		});
		assert.ok(note);
		initialElements.push(note);
	}
	const lowerNote = createCanvasTemplateStickyNote({
		defaults,
		section: opportunities,
		existingElements: initialElements,
		text: "Opportunity",
	});
	assert.ok(lowerNote);
	lowerNote.width = 77;
	lowerNote.height = 55;
	initialElements.push(lowerNote);

	const result = assertAdapterParity(initialElements, {
		create: [],
		update: [],
		deleteIds: [],
	});
	const normalizedNote = result.find((element) => element.id === lowerNote.id);
	assert.ok(normalizedNote);
	assert.equal(normalizedNote.width, 160);
	assert.equal(normalizedNote.height, 124);
	assert.ok(normalizedNote.y > lowerNote.y);
});

test("template move, resize, and deletion normalize through both adapters", () => {
	const defaults = {
		createId: idFactory("retro"),
		stroke: "#111",
		fontFamily: "Inter",
	};
	const initialElements = createCanvasTemplateElements({
		id: "retrospective",
		x: 0,
		y: 0,
		defaults,
	});
	const sections = initialElements.filter((element) =>
		getTemplateSectionMeta(element),
	);
	assert.ok(sections.length >= 2);
	const sourceSection = sections[0];
	const targetSection = sections[1];
	const note = createCanvasTemplateStickyNote({
		defaults,
		section: sourceSection,
		existingElements: initialElements,
		text: "Move me",
	});
	assert.ok(note);
	initialElements.push(note);

	const movedElements = initialElements.map((element) =>
		element.id === note.id
			? {
					...element,
					x: targetSection.x + 20,
					y: targetSection.y + 100,
					width: 77,
					height: 55,
				}
			: element,
	);
	const movedMap = toCanvasElementMap(movedElements);
	const movedNote = movedMap.get(note.id);
	assert.ok(movedNote);
	const result = assertAdapterParity(initialElements, {
		create: [],
		update: [
			{
				id: note.id,
				changes: {
					x: movedNote.x,
					y: movedNote.y,
					width: movedNote.width,
					height: movedNote.height,
				},
			},
			...buildTemplateDropUpdates(movedMap, [note.id]),
		],
		deleteIds: [],
	});
	const normalizedNote = result.find((element) => element.id === note.id);
	assert.ok(normalizedNote);
	assert.equal(normalizedNote.frameId, targetSection.id);
	assert.notEqual(normalizedNote.width, 77);
	assert.notEqual(normalizedNote.height, 55);

	const afterDeletion = assertAdapterParity(result, {
		create: [],
		update: [],
		deleteIds: [note.id],
	});
	assert.equal(
		afterDeletion.some((element) => element.id === note.id),
		false,
	);
});
