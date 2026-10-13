import assert from "node:assert/strict";
import test from "node:test";
import type { Context } from "./context";
import { protectedProcedure, router } from "./init";

const app = router({
	boardAction: protectedProcedure.query(({ ctx }) => ctx.user.id),
});

test("self-hosted access requires authentication and never queries a subscription", async () => {
	const db = new Proxy(
		{},
		{
			get() {
				throw new Error("Unexpected entitlement lookup");
			},
		},
	);
	const context = {
		db,
		user: { id: "owner" },
		session: { id: "session" },
	} as Context;
	assert.equal(await app.createCaller(context).boardAction(), "owner");
	await assert.rejects(
		app.createCaller({ ...context, user: null, session: null }).boardAction(),
		{ code: "UNAUTHORIZED" },
	);
});
