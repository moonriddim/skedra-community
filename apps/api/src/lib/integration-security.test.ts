import assert from "node:assert/strict";
import test from "node:test";
import type { Database, boardIntegrationSyncs } from "@skedra/db";
import { env } from "../env";
import type { Context } from "../trpc/context";
import { integrationsRouter } from "../trpc/routers/integrations";
import { runBoardIntegrationSync } from "./integration-sync";

const boardId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const user = {
	id: "offline-owner",
	name: "Owner",
	email: "owner@example.test",
};
const subscriptionQueries = {
	userSubscriptions: { findFirst: async () => ({ status: "active" }) },
	complimentaryAccessGrants: { findFirst: async () => null },
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

test("managed Obsidian rejects new and persisted configurations without fetch or embed changes", async (t) => {
	const originalMode = env.SKEDRA_DEPLOYMENT_MODE;
	env.SKEDRA_DEPLOYMENT_MODE = "managed";
	t.after(() => {
		env.SKEDRA_DEPLOYMENT_MODE = originalMode;
	});
	const fetch = t.mock.method(globalThis, "fetch", async () => {
		throw new Error("Unexpected network");
	});
	let sync = savedSync();
	const db = {
		query: {
			...subscriptionQueries,
			whiteboards: {
				findFirst: async () => ({
					id: boardId,
					ownerId: user.id,
					archivedAt: null,
				}),
			},
			boardIntegrationSyncs: { findFirst: async () => sync },
		},
		update: () => ({
			set: (values: Partial<typeof sync>) => ({
				where: () => ({
					returning: async () => {
						sync = { ...sync, ...values };
						return [sync];
					},
				}),
			}),
		}),
	} as unknown as Database;
	const caller = integrationsRouter.createCaller({
		db,
		user,
		session: { id: "offline-session" },
	} as Context);
	for (const endpointUrl of [
		"http://127.0.0.1:27123",
		"http://169.254.169.254",
		"https://example.test",
	]) {
		await assert.rejects(
			caller.saveObsidian({
				whiteboardId: boardId,
				endpointUrl,
				vaultPath: "audit.md",
			}),
			/Selfhosting/,
		);
		await assert.rejects(
			runBoardIntegrationSync({} as Database, savedSync(endpointUrl)),
			/Selfhosting/,
		);
	}
	const result = await caller.syncNow({
		whiteboardId: boardId,
		provider: "obsidian",
	});
	assert.match(result.lastSyncError ?? "", /Selfhosting/);
	assert.equal(fetch.mock.callCount(), 0);
});

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
