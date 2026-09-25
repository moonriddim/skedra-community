import assert from "node:assert/strict";
import {
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	checkFilesystemStorage,
	deleteFilesystemObject,
	getFilesystemObject,
	putFilesystemObject,
} from "./filesystem-storage";

test("filesystem objects survive reopening and support replacement and idempotent deletion", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "skedra-storage-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "assets");
	const key = "whiteboards/board-id/images/asset-id.e2ee";
	const bytes = new Uint8Array([0, 1, 255, 42]);
	await putFilesystemObject(root, key, bytes);
	assert.deepEqual(await getFilesystemObject(root, key), bytes);
	assert.deepEqual(new Uint8Array(await readFile(join(root, key))), bytes);
	const replacement = new Uint8Array([8, 9, 10]);
	await putFilesystemObject(root, key, replacement);
	assert.deepEqual(await getFilesystemObject(root, key), replacement);
	assert.deepEqual(await readdir(join(root, "whiteboards/board-id/images")), [
		"asset-id.e2ee",
	]);
	await deleteFilesystemObject(root, key);
	await deleteFilesystemObject(root, key);
	await assert.rejects(getFilesystemObject(root, key), { name: "NoSuchKey" });
});

test("invalid keys cannot read, overwrite, or delete outside the asset root", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "skedra-storage-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await writeFile(join(directory, "secret"), "keep");
	const root = join(directory, "assets");
	for (const key of [
		"",
		"../secret",
		"/secret",
		"a/../../secret",
		"a\\secret",
		"C:/secret",
		"a//b",
		"a/./b",
		"%2e%2e/secret",
		"nul",
		"a:stream",
		"a.",
	]) {
		await assert.rejects(
			putFilesystemObject(root, key, new Uint8Array()),
			/Invalid filesystem object key/,
		);
		await assert.rejects(
			getFilesystemObject(root, key),
			/Invalid filesystem object key/,
		);
		await assert.rejects(
			deleteFilesystemObject(root, key),
			/Invalid filesystem object key/,
		);
	}
	assert.equal(await readFile(join(directory, "secret"), "utf8"), "keep");
});

test("symlinked subdirectories cannot escape the storage root", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "skedra-storage-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "assets");
	const outside = join(directory, "outside");
	await mkdir(root);
	await mkdir(outside);
	await writeFile(join(outside, "secret"), "keep");
	await symlink(
		outside,
		join(root, "linked"),
		process.platform === "win32" ? "junction" : "dir",
	);
	await assert.rejects(
		putFilesystemObject(root, "linked/secret", new Uint8Array()),
		/symlinks/,
	);
	await assert.rejects(getFilesystemObject(root, "linked/secret"), /symlinks/);
	await assert.rejects(
		deleteFilesystemObject(root, "linked/secret"),
		/symlinks/,
	);
	assert.equal(await readFile(join(outside, "secret"), "utf8"), "keep");
});

test("storage probes detect unavailable roots and leave no probe files", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "skedra-storage-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await checkFilesystemStorage(root);
	assert.deepEqual(await readdir(join(root, "checks")), []);
	await writeFile(join(root, "not-a-directory"), "keep");
	await assert.rejects(checkFilesystemStorage(join(root, "not-a-directory")));
	await assert.rejects(
		putFilesystemObject("relative/path", "file", new Uint8Array()),
		/absolute/,
	);
	await mkdir(join(root, "not-a-file"));
	await assert.rejects(
		getFilesystemObject(root, "not-a-file"),
		/regular files/,
	);
});

test("concurrent replacements expose only complete objects", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "skedra-storage-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const variants = [
		new Uint8Array(32_768).fill(3),
		new Uint8Array(65_536).fill(7),
	];
	await putFilesystemObject(root, "object", variants[0]);
	await Promise.all([
		...variants.map((body) => putFilesystemObject(root, "object", body)),
		(async () => {
			for (let i = 0; i < 20; i++) {
				const bytes = await getFilesystemObject(root, "object");
				assert.ok(
					variants.some((variant) => Buffer.from(bytes).equals(variant)),
				);
			}
		})(),
	]);
	assert.deepEqual(await readdir(root), ["object"]);
});
