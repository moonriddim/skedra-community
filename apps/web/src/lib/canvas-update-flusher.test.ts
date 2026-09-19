import assert from "node:assert/strict";
import test from "node:test";
import { createCanvasUpdateFlusher } from "./canvas-update-flusher";

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

test("a stalled board does not block another board's durable writes", async () => {
	const a = createCanvasUpdateFlusher();
	const b = createCanvasUpdateFlusher();
	const stalled = deferred();
	const first = a(() => stalled.promise);
	let saved = false;
	await b(async () => {
		saved = true;
	});
	assert.equal(saved, true);
	stalled.resolve();
	await first;
});

test("concurrent retries coalesce and still drain work queued during a flush", async () => {
	const run = createCanvasUpdateFlusher();
	const stalled = deferred();
	let calls = 0;
	const flush = async () => {
		calls++;
		if (calls === 1) await stalled.promise;
	};
	const first = run(flush);
	await Promise.resolve();
	for (let i = 0; i < 100; i++) assert.equal(run(flush), first);
	stalled.resolve();
	await first;
	assert.equal(calls, 2);
});

test("a failed flush releases the worker for a later retry", async () => {
	const run = createCanvasUpdateFlusher();
	await assert.rejects(
		run(async () => {
			throw new Error("proxy timeout");
		}),
		/proxy timeout/,
	);
	let saved = false;
	await run(async () => {
		saved = true;
	});
	assert.equal(saved, true);
});
