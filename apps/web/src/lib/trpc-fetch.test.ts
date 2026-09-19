import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { fetchTrpc } from "./trpc-fetch";

test("sync requests time out before headers and while reading a stalled body", async (t) => {
	const server = createServer((req, res) => {
		if (req.url?.includes("list")) {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.write("[");
		}
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(() => {
		server.closeAllConnections();
		server.close();
	});
	const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/trpc/`;
	for (const procedure of ["appendServerUpdate", "compactE2eeUpdates"]) {
		await assert.rejects(fetchTrpc(`${base}whiteboard.${procedure}`, {}, 100), {
			name: "TimeoutError",
		});
	}
	const response = await fetchTrpc(
		`${base}whiteboard.listServerUpdates`,
		{},
		200,
	);
	await assert.rejects(
		response.text(),
		(error: unknown) =>
			error instanceof Error &&
			["AbortError", "TimeoutError"].includes(error.name),
	);
});

test("existing cancellation is preserved and unrelated procedures have no sync timeout", async (t) => {
	const signals: (AbortSignal | null | undefined)[] = [];
	t.mock.method(
		globalThis,
		"fetch",
		async (_url: unknown, init: RequestInit) => {
			signals.push(init.signal);
			assert.equal(init.credentials, "include");
			return new Response("[]");
		},
	);
	const controller = new AbortController();
	controller.abort();
	await fetchTrpc("http://localhost/api/trpc/whiteboard.appendE2eeUpdate", {
		signal: controller.signal,
	});
	assert.equal(signals[0]?.aborted, true);
	await fetchTrpc("http://localhost/api/trpc/ai.generate", {
		signal: controller.signal,
	});
	assert.equal(signals[1], controller.signal);
	await fetchTrpc("http://localhost/api/trpc/ai.generate");
	assert.equal(signals[2], undefined);
	await fetchTrpc(
		"http://localhost/api/trpc/assets.getUploadConfig,whiteboard.listE2eeUpdates",
	);
	assert.ok(signals[3]);
});

test("sync reads bypass a cached empty page when another client writes", async (t) => {
	let remoteRows: string[] = [];
	let cachedBody: string | undefined;
	t.mock.method(
		globalThis,
		"fetch",
		async (_url: unknown, init: RequestInit) => {
			if (init.cache !== "no-store" && cachedBody !== undefined) {
				return new Response(cachedBody);
			}
			const body = JSON.stringify(remoteRows);
			if (init.cache !== "no-store") cachedBody = body;
			return new Response(body);
		},
	);
	for (const mode of ["Server", "E2ee"]) {
		cachedBody = undefined;
		remoteRows = [];
		const url = `http://localhost/api/trpc/whiteboard.list${mode}Updates`;
		assert.deepEqual(await (await fetchTrpc(url)).json(), []);
		remoteRows = ["peer edit"];
		assert.deepEqual(await (await fetchTrpc(url)).json(), ["peer edit"]);
	}
});
