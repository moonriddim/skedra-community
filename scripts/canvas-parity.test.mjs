import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

test("web Yjs and SDK local adapters execute identical canvas mutations", () => {
	const pnpmArgs = [
		"--filter",
		"@skedra/web",
		"exec",
		"tsx",
		"--test",
		"src/lib/canvas/canvas-adapter-parity.test.ts",
	];
	const command = process.platform === "win32" ? process.env.ComSpec : "pnpm";
	const args =
		process.platform === "win32"
			? ["/d", "/s", "/c", ["pnpm", ...pnpmArgs].join(" ")]
			: pnpmArgs;
	const result = spawnSync(command ?? "cmd.exe", args, {
		cwd: repoRoot,
		encoding: "utf8",
	});

	assert.equal(
		result.status,
		0,
		[result.stdout, result.stderr].filter(Boolean).join("\n"),
	);
});
