import assert from "node:assert/strict";
import test from "node:test";
import type { Database, boardIntegrationSyncs } from "@skedra/db";
import { env } from "../env";
import { runBoardIntegrationSync } from "./integration-sync";

const boardId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const user = {
	id: "offline-owner",
	name: "Owner",
	email: "owner@example.test",
};
function savedSync(endpointUrl = "http://127.0.0.1:27123") {
	return {
		id: "offline-sync",
		whiteboardId: boardId,
		userId: user.id,
		provider: "obsidian",
		enabled: true,
		target: "audit.md",
		config: JSON.stringify({ endpointUrl }),
		encryptedSecret: null,
		lastSyncedAt: null,
		lastSyncError: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	} satisfies typeof boardIntegrationSyncs.$inferSelect;
}

test("selfhost Obsidian remains usable, denies redirects and hides internal error bodies", async (t) => {
	const originalMode = env.SKEDRA_DEPLOYMENT_MODE;
	env.SKEDRA_DEPLOYMENT_MODE = "selfhost";
	t.after(() => {
		env.SKEDRA_DEPLOYMENT_MODE = originalMode;
	});
	const sync = savedSync();
	const db = {
		query: {
			whiteboards: {
				findFirst: async () => ({
					id: boardId,
					name: "Offline",
					embedShareEnabled: true,
					embedShareToken: "offline",
				}),
			},
		},
		update: () => ({
			set: () => ({ where: () => ({ returning: async () => [sync] }) }),
		}),
	} as unknown as Database;
	const fetch = t.mock.method(
		globalThis,
		"fetch",
		async (_url: string | URL | Request, options?: RequestInit) => {
			assert.equal(options?.redirect, "error");
			assert.ok(options?.signal instanceof AbortSignal);
			assert.equal(options?.method, "PUT");
			return new Response(null, { status: 204 });
		},
	);
	await runBoardIntegrationSync(db, sync);
	assert.equal(fetch.mock.callCount(), 1);
	fetch.mock.mockImplementation(
		async () => new Response("internal-secret-marker", { status: 403 }),
	);
	await assert.rejects(runBoardIntegrationSync(db, sync), {
		message: "OBSIDIAN_403",
	});
});
