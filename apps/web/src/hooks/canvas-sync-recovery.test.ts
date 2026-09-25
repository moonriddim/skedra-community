import assert from "node:assert/strict";
import test from "node:test";
import "fake-indexeddb/auto";
import { Window } from "happy-dom";

test("two clients recover delayed updates and cached board navigation", async (t) => {
	const browser = new Window({ url: "http://localhost" });
	for (const [key, value] of Object.entries({
		window: browser,
		document: browser.document,
		navigator: browser.navigator,
		localStorage: browser.localStorage,
	})) {
		Object.defineProperty(globalThis, key, { configurable: true, value });
	}
	const { createElement, useState } = await import("react");
	const { createRoot } = await import("react-dom/client");
	const { flushSync } = await import("react-dom");
	const { QueryClient, QueryClientProvider } = await import(
		"@tanstack/react-query"
	);
	const { httpBatchLink } = await import("@trpc/client");
	const { trpc } = await import("@/lib/trpc");
	const { useServerCanvasSync } = await import("./use-server-canvas-sync");
	const { useE2eeCanvasSync } = await import("./use-e2ee-canvas-sync");
	const { generateE2eeKey } = await import("@/lib/e2ee");
	const { listPendingServerUpdates, listPendingE2eeUpdates } = await import(
		"@/lib/e2ee-update-queue"
	);
	const delay = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));
	const until = async (condition: () => boolean | Promise<boolean>) => {
		for (let i = 0; i < 400; i++) {
			if (await condition()) return;
			await delay();
		}
		assert.fail("sync did not converge");
	};
	t.after(() => browser.happyDOM.close());
	for (const mode of ["server", "e2ee"] as const) {
		await t.test(mode, async () => {
			const board = crypto.randomUUID();
			const otherBoard = crypto.randomUUID();
			const key = generateE2eeKey();
			type Row = {
				id: string;
				createdAt: string;
				update: string;
				clientId: string;
			};
			const log: Row[] = [];
			const states: Array<ReturnType<typeof useServerCanvasSync>> = [];
			const navigate: Array<(id: string) => void> = [];
			const clients: InstanceType<typeof QueryClient>[] = [];
			let blockWrites = false;
			let blockReads = false;
			let releaseRead: (() => void) | undefined;
			const containers = [0, 1].map(() => document.createElement("div"));
			const errors: unknown[] = [];
			const roots = containers.map((container) =>
				createRoot(container, {
					onUncaughtError: (error) => errors.push(error),
				}),
			);
			for (const index of [0, 1]) {
				const qc = new QueryClient({
					defaultOptions: {
						queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
						mutations: { gcTime: 0 },
					},
				});
				clients.push(qc);
				const client = trpc.createClient({
					links: [
						httpBatchLink({
							url: "http://localhost/api/trpc",
							fetch: async (url, options) => {
								const request = new URL(String(url));
								const paths =
									request.pathname.split("/").at(-1)?.split(",") ?? [];
								const inputs = JSON.parse(
									request.searchParams.get("input") ??
										String(options?.body ?? "{}"),
								);
								const results = [];
								for (const [i, path] of paths.entries()) {
									const input = inputs[i];
									if (path.includes("append")) {
										if (blockWrites) throw new Error("proxy unavailable");
										const row = {
											id: crypto.randomUUID(),
											createdAt: new Date().toISOString(),
											clientId: input.clientId,
											update: input.update,
										};
										log.push(row);
										results.push({ result: { data: row } });
									} else {
										const rows =
											input.whiteboardId === board
												? log.slice(
														input.afterId
															? log.findIndex(
																	(row) => row.id === input.afterId,
																) + 1
															: 0,
													)
												: [];
										if (index === 1 && blockReads) {
											blockReads = false;
											await new Promise<void>((resolve) => {
												releaseRead = resolve;
											});
										}
										// Emulates the API's size budget: one row per page, so
										// every multi-row load has to follow `hasMore`.
										results.push({
											result: {
												data: {
													updates: rows.slice(0, 1),
													hasMore: rows.length > 1,
												},
											},
										});
									}
								}
								return new Response(JSON.stringify(results), {
									headers: { "Content-Type": "application/json" },
								});
							},
						}),
					],
				});
				function Client() {
					const [id, setId] = useState<string>(board);
					navigate[index] = setId;
					const options = {
						presenceEnabled: false,
						collabShareToken: "test",
					};
					states[index] =
						mode === "server"
							? useServerCanvasSync(id, options)
							: useE2eeCanvasSync(id, { ...options, e2eeKey: key });
					return null;
				}
				flushSync(() =>
					roots[index].render(
						createElement(trpc.Provider, {
							client,
							queryClient: qc,
							children: createElement(
								QueryClientProvider,
								{ client: qc },
								createElement(Client),
							),
						}),
					),
				);
			}
			try {
				await until(() => states[0]?.isReady && states[1]?.isReady);
				blockWrites = true;
				states[0].setCanvasBg("#123456");
				await until(() => !!states[0].connectionError);
				assert.equal(states[0].isReadonly, false);
				assert.equal(states[1].canvasBg, "");
				blockWrites = false;
				window.dispatchEvent(new browser.Event("online") as unknown as Event);
				await until(() => log.length > 0 && !states[0].connectionError);
				await clients[1].refetchQueries();
				await until(() => states[1].canvasBg === "#123456");
				blockReads = true;
				const pendingRead = clients[1].refetchQueries();
				await until(() => !!releaseRead);
				states[0].setCanvasBg("#abcdef");
				await until(() => log.length >= 2);
				releaseRead?.();
				await pendingRead;
				await clients[1].refetchQueries();
				await until(() => states[1].canvasBg === "#abcdef");
				flushSync(() => navigate[1](otherBoard));
				await until(() => states[1].isReady && states[1].canvasBg === "");
				flushSync(() => navigate[1](board));
				await until(
					() => states[1].isReady && states[1].canvasBg === "#abcdef",
				);
				assert.deepEqual(errors, []);
				const rowsBeforePeerEdit = log.length;
				states[1].setCanvasBg("#fedcba");
				await until(() => log.length > rowsBeforePeerEdit);
				await clients[0].refetchQueries();
				await until(() => states[0].canvasBg === "#fedcba");
				await until(
					async () =>
						(
							await (mode === "server"
								? listPendingServerUpdates(board)
								: listPendingE2eeUpdates(board))
						).length === 0,
				);
			} finally {
				releaseRead?.();
				for (const root of roots) flushSync(() => root.unmount());
				for (const client of clients) client.clear();
			}
		});
	}
});
