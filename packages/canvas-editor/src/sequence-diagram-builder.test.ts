import assert from "node:assert/strict";
import test from "node:test";
import {
	buildSequenceDiagramSource,
	recognizeSequenceDescription,
} from "./sequence-diagram-builder";

test("recognizes a plain-language order flow", () => {
	const draft = recognizeSequenceDescription(
		"Ein Kunde sendet eine Bestellung. Der Service prüft die Daten über die API.",
	);
	assert.deepEqual(
		draft.participants.map(({ label }) => label),
		["Kunde", "Service", "API"],
	);
	assert.deepEqual(
		draft.steps.map(({ label }) => label),
		["Bestellung senden", "Daten prüfen"],
	);
});

test("builds importable Mermaid source from a recognized draft", () => {
	const draft = recognizeSequenceDescription(
		"Ein Kunde sendet eine Bestellung. Der Service prüft die Daten über die API.",
	);
	const source = buildSequenceDiagramSource(draft.participants, draft.steps);
	assert.match(source, /actor kunde_1 as Kunde/);
	assert.match(source, /kunde_1->>service_2: Bestellung senden/);
	assert.match(source, /service_2->>api_3: Daten prüfen/);
});
