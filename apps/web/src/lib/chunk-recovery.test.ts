import assert from "node:assert/strict";
import test from "node:test";
import { shouldAttemptChunkReload } from "./chunk-recovery";

test("chunk recovery reloads once per cooldown window", () => {
	assert.equal(shouldAttemptChunkReload(null, 100_000), true);
	assert.equal(shouldAttemptChunkReload("90000", 100_000), false);
	assert.equal(shouldAttemptChunkReload("39999", 100_000), true);
	assert.equal(shouldAttemptChunkReload("invalid", 100_000), true);
});
