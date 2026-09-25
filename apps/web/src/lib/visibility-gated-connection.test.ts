import assert from "node:assert/strict";
import test from "node:test";
import {
	type VisibilitySource,
	createVisibilityGatedConnection,
} from "./visibility-gated-connection";

/** Einfacher Ersatz für `document`, dessen Sichtbarkeit der Test steuert. */
function createFakeVisibility(initial: DocumentVisibilityState) {
	const listeners = new Set<() => void>();
	const source = {
		visibilityState: initial,
		addEventListener: (_type: "visibilitychange", listener: () => void) =>
			listeners.add(listener),
		removeEventListener: (_type: "visibilitychange", listener: () => void) =>
			listeners.delete(listener),
	} satisfies VisibilitySource;
	return {
		source,
		listeners,
		set(state: DocumentVisibilityState) {
			source.visibilityState = state;
			for (const listener of listeners) listener();
		},
	};
}

/** Zählt Öffnen/Schließen, damit der Test den Verbindungszustand prüfen kann. */
function createCounter() {
	const counter = { opened: 0, closed: 0 };
	return {
		counter,
		connect: () => {
			counter.opened++;
			return () => {
				counter.closed++;
			};
		},
	};
}

test("hidden tabs release the live connection after the grace period", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const visibility = createFakeVisibility("visible");
	const { counter, connect } = createCounter();
	const dispose = createVisibilityGatedConnection({
		connect,
		visibility: visibility.source,
		hiddenGraceMs: 1_000,
	});
	assert.deepEqual(counter, { opened: 1, closed: 0 });

	// Kurzer Tab-Wechsel: Verbindung bleibt bestehen.
	visibility.set("hidden");
	t.mock.timers.tick(500);
	visibility.set("visible");
	t.mock.timers.tick(1_000);
	assert.deepEqual(counter, { opened: 1, closed: 0 });

	// Längere Zeit versteckt: Slot wird freigegeben.
	visibility.set("hidden");
	t.mock.timers.tick(1_000);
	assert.deepEqual(counter, { opened: 1, closed: 1 });

	// Zurück im Vordergrund: neue Verbindung.
	visibility.set("visible");
	assert.deepEqual(counter, { opened: 2, closed: 1 });

	dispose();
	assert.deepEqual(counter, { opened: 2, closed: 2 });
	assert.equal(visibility.listeners.size, 0);
});

test("tabs opened in the background connect only when shown", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const visibility = createFakeVisibility("hidden");
	const { counter, connect } = createCounter();
	const dispose = createVisibilityGatedConnection({
		connect,
		visibility: visibility.source,
		hiddenGraceMs: 1_000,
	});
	assert.deepEqual(counter, { opened: 0, closed: 0 });
	visibility.set("visible");
	assert.deepEqual(counter, { opened: 1, closed: 0 });

	// Aufräumen während eines laufenden Karenz-Timers schließt genau einmal.
	visibility.set("hidden");
	dispose();
	t.mock.timers.tick(1_000);
	assert.deepEqual(counter, { opened: 1, closed: 1 });
});
