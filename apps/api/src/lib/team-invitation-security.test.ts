import assert from "node:assert/strict";
import test from "node:test";
import type { Database } from "@skedra/db";
import { env } from "../env";
import type { Context } from "../trpc/context";
import { teamRouter } from "../trpc/routers/team";

test("invitations cannot demote existing admins or change existing member roles", async (t) => {
	const mode = env.SKEDRA_DEPLOYMENT_MODE;
	env.SKEDRA_DEPLOYMENT_MODE = "selfhost";
	t.after(() => {
		env.SKEDRA_DEPLOYMENT_MODE = mode;
	});
	const user = {
		id: "limited-admin",
		name: "Admin",
		email: "admin@example.test",
	};
	const target = { id: "target", email: "target@example.test" };
	const team = { id: "team", ownerId: "owner", name: "Offline" };
	let targetRole = "admin";
	let targetExists = true;
	let inserted = 0;
	let conflictsIgnored = 0;
	const db = {
		query: {
			teams: { findFirst: async () => undefined },
			users: { findFirst: async () => target },
			teamMembers: {
				findFirst: async (query: { with?: unknown }) =>
					query.with
						? { userId: user.id, workspaceRole: "admin", role: null, team }
						: targetExists
							? {
									id: "membership",
									workspaceRole: targetRole,
									userId: target.id,
									teamId: team.id,
								}
							: undefined,
			},
		},
		update: () => {
			throw new Error("Unexpected role update");
		},
		insert: () => ({
			values: () => {
				inserted++;
				return {
					onConflictDoNothing: async () => {
						conflictsIgnored++;
					},
				};
			},
		}),
	} as unknown as Database;
	const caller = teamRouter.createCaller({
		db,
		user,
		session: { id: "offline-session" },
	} as Context);
	await assert.rejects(
		caller.updateMemberRole({ userId: target.id, workspaceRole: "member" }),
		/Keine Berechtigung/,
	);
	assert.equal(
		(await caller.inviteMember({ email: target.email })).success,
		true,
	);
	targetRole = "member";
	assert.equal(
		(await caller.inviteMember({ email: target.email })).success,
		true,
	);
	await assert.rejects(
		caller.inviteMember({ email: target.email, workspaceRole: "admin" }),
		/Keine Berechtigung/,
	);
	assert.equal(inserted, 0);
	targetExists = false;
	assert.equal(
		(await caller.inviteMember({ email: target.email })).success,
		true,
	);
	assert.equal(inserted, 1);
	assert.equal(conflictsIgnored, 1);
});
