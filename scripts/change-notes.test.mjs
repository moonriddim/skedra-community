import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { releaseChanges } from "../.github/scripts/change-notes.mjs";

function git(root, ...args) {
	return execFileSync("git", ["-C", root, ...args], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

async function fixture(t) {
	const parent = tmpdir();
	const root = await mkdtemp(join(parent, "skedra-change-notes-"));
	t.after(async () => {
		assert.equal(dirname(root), parent);
		await rm(root, { recursive: true, force: true });
	});
	const source = join(root, "source");
	const community = join(root, "community");
	for (const repo of [source, community]) {
		await mkdir(repo);
		git(repo, "init", "--quiet");
		git(repo, "config", "user.name", "Offline test");
		git(repo, "config", "user.email", "offline@example.test");
		git(repo, "config", "commit.gpgsign", "false");
		await writeFile(join(repo, "public.txt"), "initial");
		git(repo, "add", "public.txt");
		git(repo, "commit", "--quiet", "-m", "Initial version");
	}
	return { source, community };
}

test("release notes describe changes since the previous tag and omit sync trailers", async (t) => {
	const { community } = await fixture(t);
	git(community, "tag", "v0.1.45");
	await writeFile(join(community, "public.txt"), "new");
	git(
		community,
		"commit",
		"--quiet",
		"-am",
		"fix: secure authentication",
		"-m",
		`Separate token purposes.\n\nSource-Commit: ${"a".repeat(40)}`,
	);
	git(community, "tag", "v0.1.46");
	const notes = releaseChanges(community, "v0.1.46");
	assert.match(notes, /^## Changes since v0.1.45/u);
	assert.match(notes, /fix: secure authentication/u);
	assert.match(notes, /Separate token purposes\./u);
	assert.doesNotMatch(notes, /Source-Commit|Initial version/u);
	assert.throws(
		() => releaseChanges(community, "--all"),
		/Invalid release tag/u,
	);
	assert.throws(() => releaseChanges(community, "v99.0.0"));
});

test("first releases include their history", async (t) => {
	const { source } = await fixture(t);
	git(source, "tag", "v0.1.0");
	assert.match(releaseChanges(source, "v0.1.0"), /Initial version/u);
});
