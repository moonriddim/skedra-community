import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function parseEnvironment(overrides: NodeJS.ProcessEnv) {
	return spawnSync(
		process.execPath,
		[
			"--import",
			"tsx",
			"--input-type=module",
			"-e",
			`const { env } = await import(${JSON.stringify(new URL("./env.ts", import.meta.url).href)}); console.log(env.SKEDRA_OBJECT_STORAGE_PROVIDER);`,
		],
		{
			encoding: "utf8",
			env: {
				...process.env,
				SKEDRA_DEPLOYMENT_MODE: "selfhost",
				SKEDRA_OBJECT_STORAGE_PROVIDER: "filesystem",
				SKEDRA_OBJECT_STORAGE_PATH: join(tmpdir(), "skedra-env-check"),
				...overrides,
			},
		},
	);
}

test("filesystem environment requires an absolute operator-configured path", () => {
	assert.equal(parseEnvironment({}).status, 0);
	for (const path of ["", "relative/assets"]) {
		const result = parseEnvironment({ SKEDRA_OBJECT_STORAGE_PATH: path });
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /SKEDRA_OBJECT_STORAGE_PATH/);
	}
});

test("legacy environments keep inline as their default and S3 needs no filesystem path", () => {
	for (const provider of [undefined, "inline", "s3"]) {
		const result = parseEnvironment({
			SKEDRA_OBJECT_STORAGE_PROVIDER: provider,
			SKEDRA_OBJECT_STORAGE_PATH: undefined,
		});
		assert.equal(result.status, 0, result.stderr);
		assert.equal(result.stdout.trim(), provider ?? "inline");
	}
});

test("managed mode continues to require S3 even with a valid filesystem path", () => {
	const result = parseEnvironment({
		SKEDRA_DEPLOYMENT_MODE: "managed",
		AUTH_SECRET: "test-auth-secret-at-least-32-characters-long",
		DATA_ENCRYPTION_SECRET: "test-data-secret-at-least-32-characters-long",
		SKEDRA_OBJECT_STORAGE_BUCKET: "test-bucket",
		SKEDRA_OBJECT_STORAGE_ACCESS_KEY_ID: "test-key",
		SKEDRA_OBJECT_STORAGE_SECRET_ACCESS_KEY: "test-secret",
		SKEDRA_OBJECT_STORAGE_PRESET: "aws",
	});
	assert.notEqual(result.status, 0);
	assert.match(
		result.stderr,
		/Managed Skedra requires SKEDRA_OBJECT_STORAGE_PROVIDER=s3/,
	);
});
