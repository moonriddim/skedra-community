import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
	communityCommitMessage,
	releaseChanges,
} from "../.github/scripts/change-notes.mjs";

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

test("Community sync includes source descriptions and changed files, excluding private-only commits", async (t) => {
	const { source, community } = await fixture(t);
	const previous = git(source, "rev-parse", "HEAD");
	git(
		community,
		"commit",
		"--allow-empty",
		"--quiet",
		"-m",
		`chore: sync community from ${previous}`,
	);
	await writeFile(join(source, "public.txt"), "patched");
	git(
		source,
		"commit",
		"--quiet",
		"-am",
		"fix: revoke live access",
		"-m",
		"Check senders and passive recipients before delivery.",
	);
	await writeFile(join(source, "private-ops.txt"), "internal");
	git(source, "add", "private-ops.txt");
	git(source, "commit", "--quiet", "-m", "Private operations details");
	await writeFile(join(community, "public.txt"), "patched");
	git(community, "add", "public.txt");
	const message = communityCommitMessage(source, community);
	assert.match(message, /^fix: revoke live access\n/u);
	assert.match(
		message,
		/Check senders and passive recipients before delivery\./u,
	);
	assert.match(message, /Changed files:\n- public.txt/u);
	assert.match(
		message,
		new RegExp(`Source-Commit: ${git(source, "rev-parse", "HEAD")}`, "u"),
	);
	assert.doesNotMatch(message, /Private operations|private-ops/u);
});

test("sync understands Source-Commit trailers and summarizes multiple changes", async (t) => {
	const { source, community } = await fixture(t);
	const previous = git(source, "rev-parse", "HEAD");
	git(
		community,
		"commit",
		"--allow-empty",
		"--quiet",
		"-m",
		"Previous sync",
		"-m",
		`Source-Commit: ${previous}`,
	);
	for (const name of ["first change", "second change"]) {
		await writeFile(join(source, "public.txt"), name);
		git(source, "commit", "--quiet", "-am", name);
	}
	await writeFile(join(community, "public.txt"), "second change");
	git(community, "add", "public.txt");
	const message = communityCommitMessage(source, community);
	assert.match(message, /first change/u);
	assert.match(message, /second change/u);
	assert.doesNotMatch(message, /Initial version/u);
});

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

test("empty exports cannot create meaningless sync commits; first releases include their history", async (t) => {
	const { source, community } = await fixture(t);
	assert.throws(() => communityCommitMessage(source, community), /No staged/u);
	git(source, "tag", "v0.1.0");
	assert.match(releaseChanges(source, "v0.1.0"), /Initial version/u);
});
