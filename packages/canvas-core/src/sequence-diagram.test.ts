import assert from "node:assert/strict";
import test from "node:test";
import { planCanvasDeletion } from "./editor-operations";
import {
	SEQUENCE_DIAGRAM_ELEMENT_TYPE,
	createSequenceDiagramElements,
	createVisualSequenceDiagramElements,
	getSequenceDiagramSummaries,
	parseSequenceDiagram,
	planSequenceDiagramActivationInsertion,
	planSequenceDiagramEdit,
	planSequenceDiagramFragmentInsertion,
	planSequenceDiagramMessageDeletion,
	planSequenceDiagramMessageInsertion,
	planSequenceDiagramMessageUpdate,
	planSequenceDiagramParticipantInsertion,
	tryCreateSequenceDiagramElements,
} from "./sequence-diagram";
import type { CanvasElement } from "./types";

function createIdFactory() {
	let index = 0;
	return () => `sequence-${++index}`;
}

const defaults = () => ({
	createId: createIdFactory(),
	stroke: "#111827",
	fontFamily: "system-ui",
});

function applyPlan(
	elements: Map<string, CanvasElement>,
	plan: NonNullable<ReturnType<typeof planSequenceDiagramParticipantInsertion>>,
) {
	const updates = new Map(
		plan.update.map((update) => [update.id, update.changes]),
	);
	return new Map(
		[
			...Array.from(elements.values())
				.filter((element) => !plan.deleteIds.includes(element.id))
				.map((element) => ({
					...element,
					...(updates.get(element.id) ?? {}),
				})),
			...plan.create,
		].map((element) => [element.id, element]),
	);
}

test("parses the Mermaid login sequence used by the reference flow", () => {
	const result = parseSequenceDiagram(`sequenceDiagram
    actor User
    participant UI as Login Page
    participant Auth as Authentication System
    User->>UI: Enter username & password
    activate UI
    UI->>Auth: Verify credentials
    activate Auth
    Auth-->>UI: Success / Failure
    deactivate Auth
    UI->>User: Grant access / Show error
    deactivate UI`);

	assert.deepEqual(result.diagnostics, []);
	assert.deepEqual(
		result.document.participants.map(({ id, label, kind }) => ({
			id,
			label,
			kind,
		})),
		[
			{ id: "User", label: "User", kind: "actor" },
			{ id: "UI", label: "Login Page", kind: "participant" },
			{
				id: "Auth",
				label: "Authentication System",
				kind: "participant",
			},
		],
	);
	assert.equal(
		result.document.events.filter((event) => event.type === "message").length,
		4,
	);
	assert.equal(
		result.document.events.find(
			(event) => event.type === "message" && event.arrow === "-->>",
		)?.text,
		"Success / Failure",
	);
});

test("lays out editable lifelines, messages, notes, fragments and activations", () => {
	const elements = createSequenceDiagramElements({
		source: `sequenceDiagram
    autonumber
    participant Client
    participant API
    Client->>+API: Request
    loop Retry twice
        API->>API: Validate
        Note over Client,API: Shared context<br/>second line
    end
    API-->>-Client: Response`,
		x: 500,
		y: 400,
		defaults: defaults(),
	});

	const roles = elements.map(
		(element) => element.customData?.sequenceRole as string | undefined,
	);
	assert.equal(
		elements.every(
			(element) =>
				element.customData?.skedraType === SEQUENCE_DIAGRAM_ELEMENT_TYPE,
		),
		true,
	);
	assert.equal(roles.filter((role) => role === "lifeline").length, 2);
	assert.equal(roles.filter((role) => role === "message").length, 3);
	assert.equal(roles.includes("note"), true);
	assert.equal(roles.includes("fragment"), true);
	assert.equal(roles.includes("activation"), true);
	assert.equal(
		elements.some(
			(element) =>
				element.customData?.sequenceRole === "message-label" &&
				element.text === "1. Request",
		),
		true,
	);
	assert.equal(
		elements.some(
			(element) =>
				element.customData?.sequenceRole === "note" &&
				element.text === "Shared context\nsecond line",
		),
		true,
	);
});

test("supports current participant stereotypes and lifecycle markers", () => {
	const result = tryCreateSequenceDiagramElements({
		source: `sequenceDiagram
    participant API@{ "type": "boundary", "alias": "Public API" }
    participant DB@{ "type": "database" } as User Database
    API-)DB: Queue lookup
    destroy DB`,
		x: 0,
		y: 0,
		defaults: defaults(),
	});

	assert.deepEqual(result.diagnostics, []);
	assert.equal(result.document.participants[0].kind, "boundary");
	assert.equal(result.document.participants[0].label, "Public API");
	assert.equal(result.document.participants[1].kind, "database");
	assert.equal(result.document.participants[1].label, "User Database");
	assert.equal(
		result.elements.some(
			(element) => element.customData?.sequenceRole === "destroy",
		),
		true,
	);
});

test("returns line diagnostics without creating a partial diagram", () => {
	const result = tryCreateSequenceDiagramElements({
		source: `sequenceDiagram
    participant A
    alt Valid
    A => B: unsupported`,
		x: 0,
		y: 0,
		defaults: defaults(),
	});

	assert.equal(result.elements.length, 0);
	assert.deepEqual(
		result.diagnostics.map(({ code, line }) => ({ code, line })),
		[
			{ code: "unsupported-statement", line: 4 },
			{ code: "unclosed-fragment", line: 4 },
		],
	);
});

test("creates a visual starter with semantic participants and useful lifeline space", () => {
	const elements = createVisualSequenceDiagramElements({
		preset: "blank",
		x: 400,
		y: 300,
		defaults: defaults(),
	});
	const [summary] = getSequenceDiagramSummaries(elements);

	assert.ok(summary);
	assert.equal(summary.participants.length, 3);
	assert.equal(summary.participants[0].kind, "actor");
	assert.ok(summary.lifelineBottom - summary.eventTop >= 280);
});

test("deleting one generated sequence part removes the complete diagram", () => {
	const elements = createVisualSequenceDiagramElements({
		preset: "checkout",
		x: 400,
		y: 300,
		defaults: defaults(),
	});
	const message = elements.find(
		(element) => element.customData?.sequenceRole === "message",
	);
	assert.ok(message);
	const plan = planCanvasDeletion(
		new Map(elements.map((element) => [element.id, element])),
		[message.id],
	);

	assert.equal(plan.deleteIds.length, elements.length);
	assert.deepEqual(
		new Set(plan.deleteIds),
		new Set(elements.map(({ id }) => id)),
	);
});

test("long participant labels receive enough header width", () => {
	const factoryDefaults = defaults();
	const elements = createVisualSequenceDiagramElements({
		preset: "blank",
		x: 400,
		y: 300,
		defaults: factoryDefaults,
	});
	const elementMap = new Map(elements.map((element) => [element.id, element]));
	const summary = getSequenceDiagramSummaries(elementMap.values())[0];
	assert.ok(summary);
	const plan = planSequenceDiagramParticipantInsertion({
		elements: elementMap,
		diagramId: summary.id,
		label: "Enterprise Payment Orchestration Service",
		kind: "participant",
		defaults: factoryDefaults,
	});
	const participant = plan?.create.find(
		(element) => element.customData?.sequenceRole === "participant",
	);

	assert.ok(participant);
	assert.ok(participant.width >= 240);
});

test("plans visual participants, messages, activations and fragments in core", () => {
	const factoryDefaults = defaults();
	const starter = createVisualSequenceDiagramElements({
		preset: "blank",
		x: 400,
		y: 300,
		defaults: factoryDefaults,
	});
	let elementMap = new Map(starter.map((element) => [element.id, element]));
	let [summary] = getSequenceDiagramSummaries(elementMap.values());
	assert.ok(summary);

	const participantPlan = planSequenceDiagramParticipantInsertion({
		elements: elementMap,
		diagramId: summary.id,
		label: "Payment Gateway",
		kind: "participant",
		defaults: factoryDefaults,
	});
	assert.ok(participantPlan);
	elementMap = applyPlan(elementMap, participantPlan);
	[summary] = getSequenceDiagramSummaries(elementMap.values());
	assert.equal(summary.participants.length, 4);
	assert.equal(summary.participants.at(-1)?.label, "Payment Gateway");

	const messagePlan = planSequenceDiagramMessageInsertion({
		elements: elementMap,
		diagramId: summary.id,
		fromParticipantId: summary.participants[0].id,
		toParticipantId: summary.participants[3].id,
		label: "Authorize payment",
		kind: "asynchronous",
		defaults: factoryDefaults,
	});
	assert.ok(messagePlan);
	assert.equal(
		messagePlan.create.some(
			(element) =>
				element.customData?.sequenceRole === "message" &&
				element.customData?.sequenceMessageKind === "asynchronous",
		),
		true,
	);
	elementMap = applyPlan(elementMap, messagePlan);

	const activationPlan = planSequenceDiagramActivationInsertion({
		elements: elementMap,
		diagramId: summary.id,
		participantId: summary.participants[3].id,
		defaults: factoryDefaults,
	});
	assert.ok(activationPlan);
	elementMap = applyPlan(elementMap, activationPlan);

	const fragmentPlan = planSequenceDiagramFragmentInsertion({
		elements: elementMap,
		diagramId: summary.id,
		kind: "alt",
		label: "Payment accepted",
		wrapCurrentFlow: true,
		defaults: factoryDefaults,
	});
	assert.ok(fragmentPlan);
	assert.equal(
		fragmentPlan.create.some(
			(element) =>
				element.customData?.sequenceRole === "fragment" &&
				element.customData?.sequenceFragmentKind === "alt",
		),
		true,
	);
	elementMap = applyPlan(elementMap, fragmentPlan);
	const fragmentLabel = Array.from(elementMap.values()).find(
		(element) => element.customData?.sequenceRole === "fragment-label",
	);
	const wrappedMessage = Array.from(elementMap.values()).find(
		(element) => element.customData?.sequenceRole === "message",
	);
	assert.ok(fragmentLabel);
	assert.ok(wrappedMessage);
	assert.ok(
		wrappedMessage.y >= fragmentLabel.y + fragmentLabel.height + 8,
		"wrapped flow leaves room for the fragment label",
	);
});

test("routes transport-neutral sequence edit actions through the core planners", () => {
	const factoryDefaults = defaults();
	const starter = createVisualSequenceDiagramElements({
		preset: "blank",
		x: 400,
		y: 300,
		defaults: factoryDefaults,
	});
	const elementMap = new Map(starter.map((element) => [element.id, element]));
	const [summary] = getSequenceDiagramSummaries(elementMap.values());
	assert.ok(summary);

	const plan = planSequenceDiagramEdit({
		elements: elementMap,
		diagramId: summary.id,
		defaults: factoryDefaults,
		action: {
			operation: "add_message",
			fromParticipantId: summary.participants[0].id,
			toParticipantId: summary.participants[1].id,
			label: "AI request",
			kind: "synchronous",
		},
	});

	assert.ok(plan);
	const next = applyPlan(elementMap, plan);
	assert.equal(
		getSequenceDiagramSummaries(next.values())[0]?.messages[0]?.label,
		"AI request",
	);
});

test("summarizes, updates and deletes visual messages by semantic event", () => {
	const factoryDefaults = defaults();
	const starter = createVisualSequenceDiagramElements({
		preset: "blank",
		x: 400,
		y: 300,
		defaults: factoryDefaults,
	});
	let elementMap = new Map(starter.map((element) => [element.id, element]));
	let [summary] = getSequenceDiagramSummaries(elementMap.values());
	assert.ok(summary);
	const messagePlan = planSequenceDiagramMessageInsertion({
		elements: elementMap,
		diagramId: summary.id,
		fromParticipantId: summary.participants[0].id,
		toParticipantId: summary.participants[1].id,
		label: "Send request",
		kind: "synchronous",
		defaults: factoryDefaults,
	});
	assert.ok(messagePlan);
	elementMap = applyPlan(elementMap, messagePlan);
	[summary] = getSequenceDiagramSummaries(elementMap.values());
	assert.equal(summary.messages.length, 1);
	assert.equal(summary.messages[0].label, "Send request");

	const updatePlan = planSequenceDiagramMessageUpdate({
		elements: elementMap,
		diagramId: summary.id,
		eventIndex: summary.messages[0].eventIndex,
		fromParticipantId: summary.participants[1].id,
		toParticipantId: summary.participants[2].id,
		label: "Check data",
		kind: "return",
		defaults: factoryDefaults,
	});
	assert.ok(updatePlan);
	elementMap = applyPlan(elementMap, updatePlan);
	[summary] = getSequenceDiagramSummaries(elementMap.values());
	assert.equal(summary.messages[0].label, "Check data");
	assert.equal(summary.messages[0].kind, "return");
	assert.equal(
		summary.messages[0].fromParticipantId,
		summary.participants[1].id,
	);

	const deletionPlan = planSequenceDiagramMessageDeletion({
		elements: elementMap,
		diagramId: summary.id,
		eventIndex: summary.messages[0].eventIndex,
		defaults: factoryDefaults,
	});
	assert.ok(deletionPlan);
	elementMap = applyPlan(elementMap, deletionPlan);
	[summary] = getSequenceDiagramSummaries(elementMap.values());
	assert.equal(summary.messages.length, 0);
});
