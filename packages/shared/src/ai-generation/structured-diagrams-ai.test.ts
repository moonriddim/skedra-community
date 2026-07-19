import assert from "node:assert/strict";
import test from "node:test";
import { parseAiCanvasPayload } from "./index";

test("AI sequence diagrams keep structured editor metadata", () => {
	const result = parseAiCanvasPayload({
		sequenceDiagram: {
			source:
				"sequenceDiagram\nparticipant U as User\nparticipant A as App\nU->>A: Open\nA-->>U: Ready",
		},
	});

	assert.equal(result.resultKind, "sequenceDiagram");
	assert.equal(result.summary?.participants, 2);
	assert.ok(
		result.elements.some(
			(element) =>
				element.customData?.skedraType === "sequence-diagram-element",
		),
	);
});

test("AI sequence diagram edits preserve semantic participant and event IDs", () => {
	const result = parseAiCanvasPayload({
		sequenceDiagramEdit: {
			diagramId: "diagram-1",
			action: {
				operation: "update_message",
				eventIndex: 4,
				fromParticipantId: "service",
				toParticipantId: "api",
				label: "Validate request",
				kind: "synchronous",
			},
		},
	});

	assert.equal(result.resultKind, "sequenceDiagramEdit");
	assert.equal(result.elements.length, 0);
	assert.equal(result.sequenceDiagramEdit?.diagramId, "diagram-1");
	assert.equal(result.sequenceDiagramEdit?.action.operation, "update_message");
	if (result.sequenceDiagramEdit?.action.operation === "update_message") {
		assert.equal(result.sequenceDiagramEdit.action.eventIndex, 4);
	}
});

test("AI project plans keep structured Gantt metadata", () => {
	const result = parseAiCanvasPayload({
		gantt: {
			title: "Release",
			startDate: "2026-07-20",
			tasks: [
				{
					id: "build",
					title: "Build",
					startDay: 0,
					durationDays: 5,
					progress: 30,
				},
				{
					id: "launch",
					title: "Launch",
					startDay: 5,
					durationDays: 1,
					milestone: true,
				},
			],
			dependencies: [{ fromTaskId: "build", toTaskId: "launch" }],
		},
	});

	assert.equal(result.resultKind, "gantt");
	assert.equal(result.summary?.tasks, 2);
	assert.equal(result.summary?.milestones, 1);
	assert.ok(
		result.elements.some(
			(element) => element.customData?.skedraType === "gantt-chart",
		),
	);
});

test("AI Gantt edits preserve semantic chart and task IDs", () => {
	const result = parseAiCanvasPayload({
		ganttEdit: {
			chartId: "release-plan",
			action: {
				operation: "update_task",
				taskId: "implementation",
				changes: { progress: 80, status: "active", owner: "Alex" },
			},
		},
	});

	assert.equal(result.resultKind, "ganttEdit");
	assert.equal(result.elements.length, 0);
	assert.equal(result.ganttEdit?.chartId, "release-plan");
	assert.equal(result.ganttEdit?.action.operation, "update_task");
	if (result.ganttEdit?.action.operation === "update_task") {
		assert.equal(result.ganttEdit.action.taskId, "implementation");
		assert.equal(result.ganttEdit.action.changes.progress, 80);
	}
});
