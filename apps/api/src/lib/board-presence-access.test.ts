import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { type Database, sessions } from "@skedra/db";
import { drizzle } from "drizzle-orm/pglite";
import { env } from "../env";
import { hasBoardPresenceAccess } from "./board-presence-access";

test("presence requires a current session for the same user, product access and board membership", async (t) => {
	const mode = env.SKEDRA_DEPLOYMENT_MODE;
	env.SKEDRA_DEPLOYMENT_MODE = "managed";
	t.after(() => {
		env.SKEDRA_DEPLOYMENT_MODE = mode;
	});
	const pg = new PGlite();
	t.after(() => pg.close());
	await pg.exec(
		"CREATE TABLE sessions (id text PRIMARY KEY, user_id text NOT NULL, expires_at timestamp NOT NULL)",
	);
	await pg.exec(
		"INSERT INTO sessions VALUES ('valid', 'owner', NOW() + interval '1 hour'), ('expired', 'owner', NOW() - interval '1 hour'), ('foreign', 'other', NOW() + interval '1 hour')",
	);
	const sessionDb = drizzle(pg, { schema: { sessions } });
	let entitled = true;
	let boardOwner = "owner";
	let archived = false;
	const db = {
		query: {
			...sessionDb.query,
			userSubscriptions: {
				findFirst: async () => ({ status: entitled ? "active" : "canceled" }),
			},
			complimentaryAccessGrants: { findFirst: async () => null },
			whiteboards: {
				findFirst: async () => ({
					id: "board",
					ownerId: boardOwner,
					teamId: null,
					archivedAt: archived ? new Date() : null,
				}),
			},
			whiteboardMembers: { findFirst: async () => undefined },
		},
	} as unknown as Database;
	const user = { id: "owner", name: "Owner", email: "owner@example.test" };
	const check = (sessionId = "valid") =>
		hasBoardPresenceAccess(db, user, sessionId, "board");
	assert.equal(await check(), true);
	for (const id of ["missing", "expired", "foreign"])
		assert.equal(await check(id), false);
	entitled = false;
	assert.equal(await check(), false);
	entitled = true;
	archived = true;
	assert.equal(await check(), false);
	archived = false;
	boardOwner = "other";
	assert.equal(await check(), false);
	boardOwner = "owner";
	await pg.exec("DELETE FROM sessions WHERE id = 'valid'");
	assert.equal(await check(), false);
});
