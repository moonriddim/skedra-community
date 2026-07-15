import assert from "node:assert/strict";
import { test } from "node:test";
import { formatKanbanDateTimeValue, resolveKanbanDueKind } from "./kanban.js";

const now = new Date(2026, 0, 15, 12, 0);

test("uses the approved Web due-date classification", () => {
	assert.equal(resolveKanbanDueKind(null, true, now), "default");
	assert.equal(
		resolveKanbanDueKind("2026-01-15T13:00", false, now),
		"due-soon",
	);
	assert.equal(resolveKanbanDueKind("2026-01-15T11:00", false, now), "overdue");
	assert.equal(
		resolveKanbanDueKind("2026-01-13T11:00", false, now),
		"overdue-long",
	);
	assert.equal(resolveKanbanDueKind("2026-01-20", true, now), "complete");
});

test("formats date-only values like the Web host", () => {
	assert.equal(formatKanbanDateTimeValue("2026-01-15", "de"), "15.01.2026");
	assert.equal(formatKanbanDateTimeValue("2026-01-15", "en"), "01/15/2026");
});
