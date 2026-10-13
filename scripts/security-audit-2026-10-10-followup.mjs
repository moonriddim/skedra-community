// Offline regression probes for the patched findings. No real DB/network.
// Run from apps/api: node --import tsx ../../scripts/security-audit-2026-10-10-followup.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { env } from "../apps/api/src/env.ts";
import { userHasProductAccess } from "../apps/api/src/lib/billing-entitlement.ts";
import { hasBoardPresenceAccess } from "../apps/api/src/lib/board-presence-access.ts";
import {
	broadcastPresence,
	closeBoardPresence,
	joinPresenceRoom,
	leavePresenceRoom,
} from "../apps/api/src/lib/board-presence.ts";
import { getBoardAccess } from "../apps/api/src/lib/permissions.ts";
import { integrationsRouter } from "../apps/api/src/trpc/routers/integrations.ts";
import { teamRouter } from "../apps/api/src/trpc/routers/team.ts";
import { whiteboardRouter } from "../apps/api/src/trpc/routers/whiteboard.ts";

const boardId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const user = {
	id: "audit-user",
	name: "Offline probe",
	email: "audit@example.test",
};
const entitlementQueries = {
	userSubscriptions: { findFirst: async () => ({ status: "active" }) },
	complimentaryAccessGrants: { findFirst: async () => null },
};

test("F1: managed Obsidian router blocks loopback and persisted configurations", async (t) => {
	const previousMode = env.SKEDRA_DEPLOYMENT_MODE;
	env.SKEDRA_DEPLOYMENT_MODE = "managed";
	t.after(() => {
		env.SKEDRA_DEPLOYMENT_MODE = previousMode;
	});
	let sync = {
		id: "offline-sync",
		whiteboardId: boardId,
		provider: "obsidian",
		enabled: true,
		target: "audit.md",
		config: '{"endpointUrl":"http://127.0.0.1:27123"}',
		encryptedSecret: null,
	};
	const requests = [];
	t.mock.method(globalThis, "fetch", async (url, options) => {
		requests.push({ url: String(url), options });
		return new Response("OFFLINE_INTERNAL_ERROR_MARKER", { status: 403 });
	});
	const db = {
		query: {
			...entitlementQueries,
			whiteboards: {
				findFirst: async () => ({
					id: boardId,
					ownerId: user.id,
					name: "Offline board",
					archivedAt: null,
					embedShareEnabled: true,
					embedShareToken: "offline-share-token",
				}),
			},
			boardIntegrationSyncs: { findFirst: async () => sync },
		},
		insert: () => ({
			values: (values) => ({
				onConflictDoUpdate: () => ({
					returning: async () => {
						sync = {
							id: "offline-sync",
							encryptedSecret: null,
							lastSyncedAt: null,
							...values,
						};
						return [sync];
					},
				}),
			}),
		}),
		update: () => ({
			set: (values) => ({
				where: () => ({
					returning: async () => {
						sync = { ...sync, ...values };
						return [sync];
					},
				}),
			}),
		}),
	};
	const caller = integrationsRouter.createCaller({
		db,
		user,
		session: { id: "offline-session" },
	});
	await assert.rejects(
		caller.saveObsidian({
			whiteboardId: boardId,
			endpointUrl: "http://127.0.0.1:27123",
			vaultPath: "audit.md",
		}),
		/Selfhosting/,
	);
	const result = await caller.syncNow({
		whiteboardId: boardId,
		provider: "obsidian",
	});
	assert.equal(requests.length, 0);
	assert.match(result.lastSyncError, /Selfhosting/);
});

test("F2: inviteMember preserves an existing admin's role", async (t) => {
	const previousMode = env.SKEDRA_DEPLOYMENT_MODE;
	env.SKEDRA_DEPLOYMENT_MODE = "managed";
	t.after(() => {
		env.SKEDRA_DEPLOYMENT_MODE = previousMode;
	});
	t.mock.method(globalThis, "fetch", async () => {
		throw new Error("Unexpected network access");
	});
	const writes = [];
	const targetUser = { id: "target-admin", email: "target@example.test" };
	const team = {
		id: "offline-team",
		ownerId: "separate-owner",
		name: "Offline workspace",
	};
	const db = {
		query: {
			...entitlementQueries,
			teams: { findFirst: async () => undefined },
			users: { findFirst: async () => targetUser },
			teamMembers: {
				findFirst: async (query) =>
					query.with
						? { userId: user.id, workspaceRole: "admin", role: null, team }
						: {
								id: "target-membership",
								userId: targetUser.id,
								teamId: team.id,
								workspaceRole: "admin",
								roleId: "privileged-role",
							},
			},
		},
		update: () => ({
			set: (values) => ({
				where: async () => {
					writes.push(values);
				},
			}),
		}),
	};
	const caller = teamRouter.createCaller({
		db,
		user,
		session: { id: "offline-session" },
	});
	await assert.rejects(
		caller.updateMemberRole({ userId: targetUser.id, workspaceRole: "member" }),
		/Keine Berechtigung/,
	);
	assert.equal(writes.length, 0);
	const result = await caller.inviteMember({ email: targetUser.email });
	assert.equal(result.success, true);
	assert.deepEqual(writes, []);
});

test("F3: removed board member loses bidirectional presence on an already open socket", async (t) => {
	// Extract the unchanged route callback with TypeScript's parser. Importing
	// index.ts itself would start the HTTP server and connect to a real database.
	const require = createRequire(
		new URL("../apps/api/package.json", import.meta.url),
	);
	const ts = require("typescript");
	const { DEFAULT_EDITOR_ROLE_PERMISSIONS } = require("@skedra/shared");
	const source = ts.createSourceFile(
		"index.ts",
		readFileSync(new URL("../apps/api/src/index.ts", import.meta.url), "utf8"),
		ts.ScriptTarget.Latest,
		true,
	);
	const route = source.statements.find(
		(node) =>
			ts.isExpressionStatement(node) &&
			ts.isCallExpression(node.expression) &&
			node.expression.expression.getText(source) === "app.get" &&
			node.expression.arguments[0]?.text === "/api/boards/:id/presence",
	);
	assert.ok(route, "Presence route must exist");
	const uuidFunction = source.statements.find(
		(node) => ts.isFunctionDeclaration(node) && node.name?.text === "isUuid",
	);
	assert.ok(uuidFunction);
	const uuidPattern = source.statements
		.filter(ts.isVariableStatement)
		.flatMap((node) => [...node.declarationList.declarations])
		.find((node) => node.name.getText(source) === "uuidPattern");
	assert.ok(uuidPattern);
	function compile(expression, dependencies) {
		const js = ts.transpileModule(`(${expression})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 },
		}).outputText;
		return new Function(
			...Object.keys(dependencies),
			`"use strict"; return ${js}`,
		)(...Object.values(dependencies));
	}
	const previousMode = env.SKEDRA_DEPLOYMENT_MODE;
	env.SKEDRA_DEPLOYMENT_MODE = "managed";
	t.after(async () => {
		env.SKEDRA_DEPLOYMENT_MODE = previousMode;
		await closeBoardPresence();
	});
	t.mock.method(globalThis, "fetch", async () => {
		throw new Error("Unexpected network access");
	});
	await closeBoardPresence(); // Permanently disable the PostgreSQL notification bridge in this probe.
	let membershipExists = true;
	const owner = {
		id: "offline-owner",
		name: "Owner",
		email: "owner@example.test",
	};
	const db = {
		query: {
			...entitlementQueries,
			sessions: { findFirst: async () => ({ id: "offline-session" }) },
			whiteboards: {
				findFirst: async () => ({
					id: boardId,
					ownerId: owner.id,
					teamId: null,
					archivedAt: null,
				}),
			},
			whiteboardMembers: {
				findFirst: async () =>
					membershipExists
						? {
								teamRoleId: "editor-role",
								teamRole: {
									name: "Editor",
									color: "blue",
									permissions: JSON.stringify(DEFAULT_EDITOR_ROLE_PERMISSIONS),
								},
							}
						: undefined,
			},
		},
		transaction: async (callback) =>
			callback({
				delete: () => ({
					where: async () => {
						membershipExists = false;
					},
				}),
			}),
	};
	const callback = route.expression.arguments[1].arguments[0];
	const handlerFactory = compile(callback.getText(source), {
		isUuid: compile(uuidFunction.getText(source), {
			uuidPattern: compile(uuidPattern.initializer.getText(source), {}),
		}),
		auth: {
			api: {
				getSession: async () => ({ user, session: { id: "offline-session" } }),
			},
		},
		db,
		userHasProductAccess,
		getBoardAccess,
		hasBoardPresenceAccess,
		joinPresenceRoom,
		broadcastPresence,
		leavePresenceRoom,
	});
	const c = { req: { param: () => boardId, raw: { headers: new Headers() } } };
	const received = [];
	const sentToOwner = [];
	const closes = [];
	const socket = {
		send: (data) => received.push(data),
		close: (...args) => closes.push(args),
	};
	const handlers = await handlerFactory(c);
	await handlers.onOpen({}, socket);
	const ownerPresence = await joinPresenceRoom(
		boardId,
		{ send: (data) => sentToOwner.push(data) },
		owner.id,
		async () => true,
	);
	const caller = whiteboardRouter.createCaller({
		db,
		user: owner,
		session: { id: "owner-session" },
	});
	await caller.removeMember({ id: boardId, userId: user.id });
	await assert.rejects(getBoardAccess({ db, user }, boardId), /Kein Zugriff/);
	const newHandlers = await handlerFactory(c);
	const deniedCloses = [];
	await newHandlers.onOpen(
		{},
		{ send: () => {}, close: (...args) => deniedCloses.push(args) },
	);
	assert.equal(
		deniedCloses.length,
		1,
		"A new handshake is denied after removal",
	);
	assert.equal(deniedCloses[0][0], 1008);
	await broadcastPresence(
		boardId,
		ownerPresence,
		"owner-presence-after-removal",
	);
	await handlers.onMessage({ data: "removed-user-presence" });
	assert.deepEqual(received, []);
	assert.deepEqual(sentToOwner, []);
	assert.equal(closes.length, 1, "The original connection is closed");
	handlers.onClose();
	leavePresenceRoom(boardId, ownerPresence);
});
