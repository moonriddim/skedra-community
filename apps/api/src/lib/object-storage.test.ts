import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { assets, userProfileImages, users } from "@skedra/db";
import type { Database, instanceSettings } from "@skedra/db";
import { decryptText, encryptText } from "@skedra/shared/server-crypto";
import { drizzle } from "drizzle-orm/pglite";

const root = await mkdtemp(join(tmpdir(), "skedra-object-storage-"));
after(() => rm(root, { recursive: true, force: true }));
process.env.SKEDRA_DEPLOYMENT_MODE = "selfhost";
process.env.SKEDRA_OBJECT_STORAGE_PROVIDER = "filesystem";
process.env.SKEDRA_OBJECT_STORAGE_PATH = root;
process.env.DATA_ENCRYPTION_SECRET =
	"storage-regression-test-secret-at-least-32-chars";
process.env.SKEDRA_OBJECT_STORAGE_PUBLIC_BASE_URL =
	"https://unused.example.com";

const { env } = await import("../env");
const {
	deleteObject,
	getObject,
	getObjectPublicUrl,
	getObjectStorageStatus,
	initializeObjectStorage,
	resolveObjectStorageConfig,
	updateObjectStorageSettings,
} = await import("./object-storage");
const { createEncryptedImageAsset, readAssetObject } = await import("./assets");
const { assetsRouter } = await import("../trpc/routers/assets");
const {
	encryptProfileImageBytes,
	readProfileImage,
	replaceProfileImage,
	removeProfileImage,
} = await import("./profile-images");

function database(
	settings: Partial<typeof instanceSettings.$inferSelect> = {},
) {
	let stored: Record<string, unknown> | undefined;
	const db = {
		query: {
			instanceSettings: {
				findFirst: async () => ({ useCustomObjectStorage: false, ...settings }),
			},
			assets: { findFirst: async () => stored },
		},
		insert: () => ({
			values: (row: Record<string, unknown>) => ({
				returning: async () => {
					stored = row;
					return [row];
				},
			}),
		}),
		select: () => ({
			from: () => ({ where: () => ({ limit: async () => [] }) }),
		}),
	} as unknown as Database;
	return { db, stored: () => stored };
}

test("filesystem upload configuration enables external uploads without leaking the disk path", async () => {
	const { db } = database();
	const status = await getObjectStorageStatus(db);
	assert.equal(status.provider, "filesystem");
	assert.equal(status.configured, true);
	assert.equal(status.publicBaseUrl, null);
	assert.equal(status.hasAccessKeyId, false);
	assert.equal("path" in status, false);
	const caller = assetsRouter.createCaller({ db } as Parameters<
		typeof assetsRouter.createCaller
	>[0]);
	const config = await caller.getUploadConfig();
	assert.equal(config.enabled, true);
	assert.equal(config.provider, "filesystem");
	assert.equal(JSON.stringify(config).includes(root), false);
	await initializeObjectStorage(db);
});

test("encrypted asset lifecycle stores bytes on disk and metadata in the database", async () => {
	const { db, stored } = database();
	const ciphertext = new Uint8Array(48).fill(137);
	const result = await createEncryptedImageAsset({
		db,
		assetId: "asset-id",
		userId: "user-id",
		whiteboardId: "board-id",
		file: new File([ciphertext], "asset.e2ee", {
			type: "application/octet-stream",
		}),
		plaintextSize: 32,
		encryptionVersion: 1,
	});
	assert.equal(result.url, "/api/assets/asset-id");
	assert.equal(stored()?.provider, "filesystem");
	assert.equal(stored()?.bucket, null);
	assert.equal(stored()?.publicUrl, null);
	assert.equal(stored()?.sizeBytes, ciphertext.length);
	const key = "whiteboards/board-id/images/asset-id.e2ee";
	assert.deepEqual(new Uint8Array(await readFile(join(root, key))), ciphertext);
	assert.deepEqual(
		(await readAssetObject({ db, assetId: "asset-id" }))?.body,
		ciphertext,
	);
	const config = await resolveObjectStorageConfig(db);
	assert.ok(config);
	assert.equal(getObjectPublicUrl(config, key), null);
	await assert.rejects(
		getObject({ config, key, bucket: "old-s3-bucket" }),
		/S3 bucket/,
	);
	await assert.rejects(
		updateObjectStorageSettings(db, {
			useCustomObjectStorage: true,
			provider: "inline",
			preset: "custom",
			adminUserId: "admin",
		}),
		/gespeicherte Assets/,
	);
	await deleteObject({ config, key });
	await assert.rejects(readAssetObject({ db, assetId: "asset-id" }), {
		name: "AssetObjectNotFoundError",
	});
});

test("app-level inline and S3 overrides retain their semantics", async () => {
	const inline = database({
		useCustomObjectStorage: true,
		objectStorageProvider: "inline",
	});
	assert.equal(await resolveObjectStorageConfig(inline.db), null);
	const { encryptObjectStorageSecretAccessKey } = await import(
		"./object-storage"
	);
	const s3 = database({
		useCustomObjectStorage: true,
		objectStorageProvider: "s3",
		objectStoragePreset: "r2",
		objectStorageEndpoint: "https://example.com",
		objectStorageBucket: "bucket",
		objectStorageAccessKeyId: "key",
		encryptedObjectStorageSecretAccessKey:
			encryptObjectStorageSecretAccessKey("secret"),
	});
	const config = await resolveObjectStorageConfig(s3.db);
	assert.equal(config?.provider, "s3");
	assert.equal(config?.region, "auto");
	assert.equal(config?.bucket, "bucket");
});

test("filesystem selected in the app requires the operator-configured path", async () => {
	const previous = env.SKEDRA_OBJECT_STORAGE_PATH;
	env.SKEDRA_OBJECT_STORAGE_PATH = undefined;
	try {
		const { db } = database({
			useCustomObjectStorage: true,
			objectStorageProvider: "filesystem",
		});
		await assert.rejects(
			resolveObjectStorageConfig(db),
			/SKEDRA_OBJECT_STORAGE_PATH/,
		);
	} finally {
		env.SKEDRA_OBJECT_STORAGE_PATH = previous;
	}
});

test("a disk failure rejects the upload before asset metadata is inserted", async () => {
	const blocked = join(root, "blocked");
	await writeFile(blocked, "not a directory");
	const previous = env.SKEDRA_OBJECT_STORAGE_PATH;
	env.SKEDRA_OBJECT_STORAGE_PATH = blocked;
	const { db, stored } = database();
	try {
		await assert.rejects(initializeObjectStorage(db));
		await assert.rejects(
			createEncryptedImageAsset({
				db,
				assetId: "disk-failure",
				userId: "user-id",
				whiteboardId: "board-id",
				file: new File([new Uint8Array(48)], "asset.e2ee", {
					type: "application/octet-stream",
				}),
				plaintextSize: 32,
				encryptionVersion: 1,
			}),
		);
		assert.equal(stored(), undefined);
	} finally {
		env.SKEDRA_OBJECT_STORAGE_PATH = previous;
	}
});

test("a failed metadata insert removes the uploaded filesystem object", async () => {
	const { db } = database();
	const failingDb = {
		...db,
		insert: () => ({
			values: () => ({
				returning: async () => {
					throw new Error("Database write failed");
				},
			}),
		}),
	} as unknown as Database;
	await assert.rejects(
		createEncryptedImageAsset({
			db: failingDb,
			assetId: "orphan",
			userId: "user-id",
			whiteboardId: "board-id",
			file: new File([new Uint8Array(48)], "asset.e2ee", {
				type: "application/octet-stream",
			}),
			plaintextSize: 32,
			encryptionVersion: 1,
		}),
		/Database write failed/,
	);
	const config = await resolveObjectStorageConfig(db);
	assert.ok(config);
	await assert.rejects(
		getObject({ config, key: "whiteboards/board-id/images/orphan.e2ee" }),
		{ name: "NoSuchKey" },
	);
});

test("unused stale S3 credentials cannot prevent inline or filesystem startup", async () => {
	const staleSecret = encryptText("obsolete-secret", {
		secret: "a-previous-server-secret-at-least-32-characters",
		purpose: "object-storage-secret-access-key",
	});
	assert.throws(() =>
		decryptText(staleSecret, {
			secret: env.DATA_ENCRYPTION_SECRET ?? env.AUTH_SECRET,
			purpose: "object-storage-secret-access-key",
		}),
	);
	for (const provider of ["inline", "filesystem"]) {
		const { db } = database({
			useCustomObjectStorage: true,
			objectStorageProvider: provider,
			encryptedObjectStorageSecretAccessKey: staleSecret,
		});
		await initializeObjectStorage(db);
		assert.equal(
			(await resolveObjectStorageConfig(db))?.provider ?? "inline",
			provider,
		);
	}
});

test("startup rejects incompatible providers using persisted PostgreSQL metadata", async (t) => {
	const pg = new PGlite();
	t.after(() => pg.close());
	await pg.exec(`
		create table assets (id text, provider text not null);
		create table user_profile_images (user_id text, provider text not null);
	`);
	const realDb = drizzle(pg);
	const db = {
		...database().db,
		select: realDb.select.bind(realDb),
	} as unknown as Database;
	const previous = { ...env };
	t.after(() => Object.assign(env, previous));
	env.SKEDRA_OBJECT_STORAGE_PRESET = "aws";
	env.SKEDRA_OBJECT_STORAGE_BUCKET = "existing-bucket";
	env.SKEDRA_OBJECT_STORAGE_ACCESS_KEY_ID = "existing-key";
	env.SKEDRA_OBJECT_STORAGE_SECRET_ACCESS_KEY = "existing-secret";
	for (const table of ["assets", "user_profile_images"]) {
		for (const storedProvider of [
			"s3",
			"r2",
			"aws",
			"ovh",
			"filesystem",
			"inline",
		]) {
			if (table === "assets" && storedProvider === "inline") continue;
			await pg.exec("truncate assets, user_profile_images");
			await pg.query(`insert into ${table} values ('existing', $1)`, [
				storedProvider,
			]);
			for (const provider of ["inline", "s3", "filesystem"] as const) {
				env.SKEDRA_OBJECT_STORAGE_PROVIDER = provider;
				const compatible =
					storedProvider === "inline" ||
					(provider !== "inline" &&
						(provider === "filesystem") === (storedProvider === "filesystem"));
				if (compatible) await initializeObjectStorage(db);
				else
					await assert.rejects(
						initializeObjectStorage(db),
						/cannot read existing external files/,
					);
			}
		}
	}
	await pg.exec("truncate assets, user_profile_images");
	// A database override must win even when the environment selects filesystem.
	await pg.exec("insert into assets values ('existing', 'r2')");
	const { encryptObjectStorageSecretAccessKey } = await import(
		"./object-storage"
	);
	const overrideDb = {
		...database({
			useCustomObjectStorage: true,
			objectStorageProvider: "s3",
			objectStoragePreset: "aws",
			objectStorageBucket: "existing-bucket",
			objectStorageAccessKeyId: "existing-key",
			encryptedObjectStorageSecretAccessKey:
				encryptObjectStorageSecretAccessKey("existing-secret"),
		}).db,
		select: realDb.select.bind(realDb),
	} as unknown as Database;
	env.SKEDRA_OBJECT_STORAGE_PROVIDER = "filesystem";
	await initializeObjectStorage(overrideDb);
});

test("legacy inline profiles stay readable and replacements use encrypted filesystem objects", async (t) => {
	const pg = new PGlite();
	t.after(() => pg.close());
	await pg.exec(`
		create table users (id text primary key, image text, updated_at timestamp);
		create table user_profile_images (
			user_id text primary key, provider text not null, bucket text, key text not null,
			public_url text, mime_type text not null, size_bytes integer not null, inline_data text,
			encryption_version integer not null default 0,
			created_at timestamp default now(), updated_at timestamp default now()
		);
		insert into users (id) values ('legacy-user');
	`);
	const realDb = drizzle(pg, { schema: { users, userProfileImages, assets } });
	const db = {
		query: {
			...realDb.query,
			instanceSettings: database().db.query.instanceSettings,
		},
		transaction: realDb.transaction.bind(realDb),
	} as unknown as Database;
	const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
	await realDb.insert(userProfileImages).values({
		userId: "legacy-user",
		provider: "inline",
		key: "legacy",
		mimeType: "image/jpeg",
		sizeBytes: bytes.length,
		encryptionVersion: 1,
		inlineData: Buffer.from(
			encryptProfileImageBytes(bytes, "legacy-user"),
		).toString("utf8"),
	});
	assert.deepEqual(
		(await readProfileImage(db, "legacy-user"))?.body,
		Buffer.from(bytes),
	);
	await replaceProfileImage({
		db,
		userId: "legacy-user",
		file: new File([bytes], "avatar.jpg", { type: "image/jpeg" }),
	});
	const profile = await realDb.query.userProfileImages.findFirst();
	assert.equal(profile?.provider, "filesystem");
	assert.equal(profile?.inlineData, null);
	assert.ok(profile?.key);
	assert.notDeepEqual(
		new Uint8Array(await readFile(join(root, profile.key))),
		bytes,
	);
	assert.deepEqual(
		(await readProfileImage(db, "legacy-user"))?.body,
		Buffer.from(bytes),
	);
	await removeProfileImage({ db, userId: "legacy-user" });
	assert.equal(await readProfileImage(db, "legacy-user"), null);
	await assert.rejects(readFile(join(root, profile.key)), { code: "ENOENT" });
});
