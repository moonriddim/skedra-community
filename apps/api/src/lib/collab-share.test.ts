import assert from "node:assert/strict";
import test from "node:test";
import { guestCanWriteCollabShare } from "./access-policy";

test("managed guests are read-only even when an old link was configured for edit", () => {
	assert.equal(guestCanWriteCollabShare("managed", "edit"), false);
	assert.equal(guestCanWriteCollabShare("managed", "view"), false);
});

test("self-hosted installations keep their configurable guest access", () => {
	assert.equal(guestCanWriteCollabShare("selfhost", "edit"), true);
	assert.equal(guestCanWriteCollabShare("selfhost", "view"), false);
});
