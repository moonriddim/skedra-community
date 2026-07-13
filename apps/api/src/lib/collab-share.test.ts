import assert from "node:assert/strict";
import test from "node:test";
import { guestCanWriteCollabShare } from "./access-policy";

test("managed collaboration links honor their configured guest access", () => {
	assert.equal(guestCanWriteCollabShare("managed", "edit"), true);
	assert.equal(guestCanWriteCollabShare("managed", "view"), false);
});

test("self-hosted installations keep their configurable guest access", () => {
	assert.equal(guestCanWriteCollabShare("selfhost", "edit"), true);
	assert.equal(guestCanWriteCollabShare("selfhost", "view"), false);
});
