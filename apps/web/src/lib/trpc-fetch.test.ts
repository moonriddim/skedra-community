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
			return Response.json([]);
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
				return new Response(cachedBody, {
					headers: { "Content-Type": "application/json" },
				});
			}
			const body = JSON.stringify(remoteRows);
			if (init.cache !== "no-store") cachedBody = body;
			return new Response(body, {
				headers: { "Content-Type": "application/json" },
			});
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

test("proxy HTML errors report HTTP status without exposing the response body or URL", async (t) => {
	for (const status of [200, 413, 502, 503, 504]) {
		await t.test(String(status), async (t) => {
			let cancelled = false;
			t.mock.method(
				globalThis,
				"fetch",
				async () =>
					new Response(
						new ReadableStream({
							start(controller) {
								controller.enqueue(
									new TextEncoder().encode("<html>private proxy details"),
								);
							},
							cancel() {
								cancelled = true;
							},
						}),
						{ status, headers: { "Content-Type": "text/html; charset=utf-8" } },
					),
			);
			await assert.rejects(
				fetchTrpc(
					"http://localhost/api/trpc/whiteboard.appendServerUpdate?input=private-token",
					{ method: "POST" },
				),
				(error: unknown) => {
					assert.ok(error instanceof Error);
					assert.match(error.message, new RegExp(`HTTP ${status}`));
					assert.doesNotMatch(
						error.message,
						/private-token|private proxy details/,
					);
					if (status === 413)
						assert.match(error.message, /outer proxy.*internal NGINX/);
					return true;
				},
			);
			assert.equal(cancelled, true);
		});
	}
});

test("JSON tRPC errors and non-sync responses remain available to their caller", async (t) => {
	const payload = [
		{ error: { message: "No access", data: { httpStatus: 403 } } },
	];
	let nextResponse = Response.json(payload, { status: 403 });
	t.mock.method(globalThis, "fetch", async () => nextResponse);
	const response = await fetchTrpc(
		"http://localhost/api/trpc/whiteboard.listServerUpdates",
	);
	assert.equal(response.status, 403);
	assert.deepEqual(await response.json(), payload);
	nextResponse = new Response("<html>unavailable", { status: 502 });
	assert.equal(
		(await fetchTrpc("http://localhost/api/trpc/ai.generate")).status,
		502,
	);
});

test("redirected sync mutations explain method loss; 307/308 preserve POST and the body", async (t) => {
	const received: Array<{ method: string | undefined; body: string }> = [];
	const server = createServer(async (req, res) => {
		const chunks = [];
		for await (const chunk of req) chunks.push(chunk);
		const body = Buffer.concat(chunks).toString();
		const url = new URL(req.url ?? "/", "http://localhost");
		const redirect = url.searchParams.get("redirect");
		if (redirect) {
			res.writeHead(Number(redirect), { Location: url.pathname });
			res.end();
			return;
		}
		received.push({ method: req.method, body });
		res.writeHead(req.method === "POST" ? 200 : 405, {
			"Content-Type": "application/json",
		});
		res.end(
			JSON.stringify(
				req.method === "POST"
					? [{ result: { data: "saved" } }]
					: [{ error: { message: "Unsupported GET-request" } }],
			),
		);
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(() => {
		server.closeAllConnections();
		server.close();
	});
	const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/trpc/whiteboard.appendServerUpdate`;
	for (const status of [301, 302, 303]) {
		await assert.rejects(
			fetchTrpc(`${url}?redirect=${status}`, {
				method: "POST",
				body: "update",
			}),
			/HTTP 405 after a redirect/,
		);
		assert.deepEqual(received.at(-1), { method: "GET", body: "" });
	}
	for (const status of [307, 308]) {
		const response = await fetchTrpc(`${url}?redirect=${status}`, {
			method: "POST",
			body: "update",
		});
		assert.deepEqual(await response.json(), [{ result: { data: "saved" } }]);
		assert.deepEqual(received.at(-1), { method: "POST", body: "update" });
	}
	const directGet = await fetchTrpc(url);
	assert.equal(directGet.status, 405);
	assert.deepEqual(await directGet.json(), [
		{ error: { message: "Unsupported GET-request" } },
	]);
});

test("slow but progressing sync downloads are not aborted by the stall timeout", async (t) => {
	// Sends a chunk every 60 ms for ~480 ms; the stall timeout is 150 ms.
	const server = createServer(async (_req, res) => {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.write("[");
		for (let i = 0; i < 8; i++) {
			await new Promise((resolve) => setTimeout(resolve, 60));
			res.write(i === 0 ? "1" : `,${i + 1}`);
		}
		res.end("]");
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(() => {
		server.closeAllConnections();
		server.close();
	});
	const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/trpc/whiteboard.listServerUpdatePage`;
	const response = await fetchTrpc(url, {}, 150);
	assert.deepEqual(await response.json(), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("large sync uploads get extra time until response headers", async (t) => {
	// The fake server answers after 250 ms, longer than the 100 ms base timeout.
	t.mock.method(
		globalThis,
		"fetch",
		async (_url: unknown, init: RequestInit) => {
			await new Promise((resolve) => setTimeout(resolve, 250));
			if (init.signal?.aborted) throw init.signal.reason;
			return Response.json([{ result: { data: "saved" } }]);
		},
	);
	const url = "http://localhost/api/trpc/whiteboard.appendServerUpdate";
	await assert.rejects(fetchTrpc(url, { method: "POST", body: "x" }, 100), {
		name: "TimeoutError",
	});
	// 32 KiB/s minimum upload rate: 16 KiB add 500 ms to the header deadline.
	const response = await fetchTrpc(
		url,
		{ method: "POST", body: "x".repeat(16 * 1024) },
		100,
	);
	assert.deepEqual(await response.json(), [{ result: { data: "saved" } }]);
});
