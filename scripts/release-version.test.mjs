import assert from "node:assert/strict";
import test from "node:test";
import {
	compareStableVersions,
	releaseVersionFromTag,
} from "./release-version.mjs";

test("derives the public package version from a stable release tag", () => {
	assert.equal(releaseVersionFromTag("v0.1.26"), "0.1.26");
	assert.equal(releaseVersionFromTag(" v12.34.56 "), "12.34.56");
});

test("rejects tags that cannot be shared by every release artifact", () => {
	for (const tag of [
		"0.1.26",
		"v0.1",
		"v01.1.26",
		"v0.1.26-beta.1",
		"release-v0.1.26",
	]) {
		assert.throws(() => releaseVersionFromTag(tag));
	}
});

test("compares stable versions numerically", () => {
	assert.equal(compareStableVersions("0.1.26", "0.1.25"), 1);
	assert.equal(compareStableVersions("0.2.0", "0.1.99"), 1);
	assert.equal(compareStableVersions("1.0.0", "1.0.0"), 0);
	assert.equal(compareStableVersions("1.2.3", "2.0.0"), -1);
});
