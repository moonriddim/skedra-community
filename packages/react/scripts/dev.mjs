import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, watch } from "node:fs";
import path from "node:path";

const packageRoot = process.cwd();
const sourceDir = path.join(packageRoot, "src");
const distDir = path.join(packageRoot, "dist");
const cssAssets = ["style.css", "style.css.d.ts"];
const pnpmCli = process.env.npm_execpath;

function spawnPnpm(args) {
	return pnpmCli
		? spawn(process.execPath, [pnpmCli, ...args], {
				cwd: packageRoot,
				stdio: "inherit",
			})
		: spawn("pnpm", args, {
				cwd: packageRoot,
				stdio: "inherit",
				shell: process.platform === "win32",
			});
}

function copyCssAssets() {
	mkdirSync(distDir, { recursive: true });
	for (const asset of cssAssets) {
		copyFileSync(path.join(sourceDir, asset), path.join(distDir, asset));
	}
	copyFileSync(
		path.join(sourceDir, "style.css.d.ts"),
		path.join(distDir, "style.d.css.ts"),
	);
}

copyCssAssets();

const cssWatcher = watch(sourceDir, (_eventType, filename) => {
	if (filename && cssAssets.includes(filename.toString())) copyCssAssets();
});

const children = [
	spawnPnpm(["exec", "vite", "build", "--watch", "--mode", "sdk-watch"]),
	spawnPnpm([
		"exec",
		"tsc",
		"-p",
		"tsconfig.json",
		"--emitDeclarationOnly",
		"--outDir",
		"dist",
		"--watch",
		"--preserveWatchOutput",
	]),
];

let stopping = false;

function stop(exitCode) {
	if (stopping) return;
	stopping = true;
	cssWatcher.close();
	for (const child of children) {
		if (!child.killed) child.kill();
	}
	process.exitCode = exitCode;
}

for (const child of children) {
	child.on("error", (error) => {
		console.error(error);
		stop(1);
	});
	child.on("exit", (code, signal) => {
		if (!stopping) {
			console.error(
				`SDK watcher stopped unexpectedly (${signal ?? `exit ${code ?? 1}`}).`,
			);
			stop(code ?? 1);
		}
	});
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
