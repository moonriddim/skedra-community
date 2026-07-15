import assert from "node:assert/strict";
import test from "node:test";
import {
	CANVAS_COMMAND_DEFINITIONS,
	type CanvasCommand,
	rankCanvasCommands,
} from "./canvas-command-registry";

test("canvas command registry owns unique ids and both global entry points", () => {
	const ids = CANVAS_COMMAND_DEFINITIONS.map((command) => command.id);
	assert.equal(new Set(ids).size, ids.length);
	assert.ok(ids.includes("find-on-canvas"));
	assert.ok(ids.includes("tool-select"));
	assert.equal(
		CANVAS_COMMAND_DEFINITIONS.find(
			(command) => command.id === "find-on-canvas",
		)?.shortcuts[0],
		"Mod+F",
	);
});

test("command ranking supports fuzzy labels and metadata keywords", () => {
	const commands = CANVAS_COMMAND_DEFINITIONS.slice(0, 4).map(
		(definition) => ({ ...definition, run: () => {} }) as CanvasCommand,
	);
	const labels = new Map(commands.map((command) => [command.id, command.id]));
	const ranked = rankCanvasCommands(
		commands,
		"tsl",
		(command) => labels.get(command.id) ?? command.id,
		(command) => command.groupKey,
	);
	assert.equal(ranked[0]?.id, "tool-select");
});
