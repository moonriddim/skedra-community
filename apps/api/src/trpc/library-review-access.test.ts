import assert from "node:assert/strict";
import test from "node:test";
import type { Context } from "./context";
import { shapeLibraryRouter } from "./routers/shape-library";

test("library previews and publication require the assigned instance admin", async () => {
	for (const adminUserId of ["another-admin", null]) {
		const db = {
			query: { instanceSettings: { findFirst: async () => ({ adminUserId }) } },
		};
		const caller = shapeLibraryRouter.createCaller({
			db,
			user: { id: "member" },
			session: { id: "session" },
		} as unknown as Context);
		await assert.rejects(caller.listSubmissions(), { code: "FORBIDDEN" });
		await assert.rejects(
			caller.getSubmissionPreview({
				id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
			}),
			{ code: "FORBIDDEN" },
		);
		await assert.rejects(
			caller.reviewSubmission({
				id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
				action: "approve",
			}),
			{ code: "FORBIDDEN" },
		);
	}
});
