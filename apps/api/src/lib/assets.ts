import { createHash } from "node:crypto";
import { assets, whiteboards } from "@skedra/db";
import type { Database } from "@skedra/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { env } from "../env";
import {
	deleteObject,
	getObject,
	getObjectPublicUrl,
	putObject,
	resolveObjectStorageConfig,
} from "./object-storage";

const ENCRYPTED_ASSET_MIME_TYPE = "application/octet-stream";
const ENCRYPTED_ASSET_VERSION = 1;
const AES_GCM_TAG_BYTES = 16;
const PRIVATE_ASSET_CACHE_CONTROL =
	"private, max-age=300, stale-while-revalidate=60";
const PUBLIC_CIPHERTEXT_CACHE_CONTROL = "public, max-age=31536000, immutable";
const ASSET_OBJECT_DELETE_RETRY_DELAYS_MS = [250, 1000];

export class AssetUploadError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "AssetUploadError";
	}
}

export class AssetObjectNotFoundError extends Error {
	constructor(message = "Asset object not found") {
		super(message);
		this.name = "AssetObjectNotFoundError";
	}
}

export class AssetStorageUnavailableError extends Error {
	constructor(message = "Asset storage is unavailable") {
		super(message);
		this.name = "AssetStorageUnavailableError";
	}
}

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isObjectNotFoundError(error: unknown) {
	if (!error || typeof error !== "object") return false;
	const name = "name" in error ? String(error.name) : "";
	const status =
		"$metadata" in error &&
		error.$metadata &&
		typeof error.$metadata === "object" &&
		"httpStatusCode" in error.$metadata
			? Number(error.$metadata.httpStatusCode)
			: null;
	return name === "NoSuchKey" || name === "NotFound" || status === 404;
}

async function deleteObjectWithRetry(input: {
	config: NonNullable<Awaited<ReturnType<typeof resolveObjectStorageConfig>>>;
	key: string;
	bucket?: string | null;
}) {
	let lastError: unknown;
	for (
		let attempt = 0;
		attempt <= ASSET_OBJECT_DELETE_RETRY_DELAYS_MS.length;
		attempt += 1
	) {
		try {
			await deleteObject(input);
			return;
		} catch (error) {
			lastError = error;
			const retryDelay = ASSET_OBJECT_DELETE_RETRY_DELAYS_MS[attempt];
			if (retryDelay == null) break;
			await delay(retryDelay);
		}
	}
	throw lastError;
}

function buildAssetKey(input: { whiteboardId: string; assetId: string }) {
	return `whiteboards/${input.whiteboardId}/images/${input.assetId}.e2ee`;
}

export async function createEncryptedImageAsset(input: {
	db: Database;
	assetId: string;
	userId: string;
	whiteboardId: string;
	file: File;
	plaintextSize: number;
	encryptionVersion: number;
}) {
	const config = await resolveObjectStorageConfig(input.db);
	if (!config) {
		throw new AssetUploadError("Object Storage ist nicht konfiguriert.", 409);
	}
	if (input.encryptionVersion !== ENCRYPTED_ASSET_VERSION) {
		throw new AssetUploadError("Unbekannte Asset-Verschluesselung.", 400);
	}
	if (
		!Number.isInteger(input.plaintextSize) ||
		input.plaintextSize < 1 ||
		input.plaintextSize > env.SKEDRA_ASSET_MAX_IMAGE_BYTES
	) {
		throw new AssetUploadError("Das Bild ist zu gross.", 413);
	}
	if (
		input.file.size !== input.plaintextSize + AES_GCM_TAG_BYTES ||
		input.file.type !== ENCRYPTED_ASSET_MIME_TYPE
	) {
		throw new AssetUploadError(
			"Ungueltiger verschluesselter Bild-Upload.",
			400,
		);
	}
	if (await findAsset(input.db, input.assetId)) {
		throw new AssetUploadError("Asset-ID existiert bereits.", 409);
	}

	const body = new Uint8Array(await input.file.arrayBuffer());
	const checksumSha256 = createHash("sha256").update(body).digest("hex");
	const key = buildAssetKey(input);
	const publicUrl = getObjectPublicUrl(config, key);

	await putObject({
		config,
		key,
		body,
		contentType: ENCRYPTED_ASSET_MIME_TYPE,
		cacheControl: publicUrl
			? PUBLIC_CIPHERTEXT_CACHE_CONTROL
			: PRIVATE_ASSET_CACHE_CONTROL,
	});

	const [created] = await input.db
		.insert(assets)
		.values({
			id: input.assetId,
			ownerId: input.userId,
			whiteboardId: input.whiteboardId,
			kind: "image",
			provider: config.preset === "custom" ? config.provider : config.preset,
			bucket: config.bucket,
			key,
			publicUrl,
			mimeType: ENCRYPTED_ASSET_MIME_TYPE,
			sizeBytes: body.byteLength,
			checksumSha256,
			encryptionVersion: input.encryptionVersion,
		})
		.returning()
		.catch(async (error) => {
			await deleteObject({ config, key }).catch((cleanupError) => {
				console.error("Failed to clean up orphaned asset object", cleanupError);
			});
			throw error;
		});

	return {
		id: created.id,
		url: created.publicUrl ?? `/api/assets/${created.id}`,
		sizeBytes: created.sizeBytes,
		encryptionVersion: created.encryptionVersion,
	};
}

export async function readAssetObject(input: {
	db: Database;
	assetId: string;
}) {
	const asset = await findAsset(input.db, input.assetId);
	if (!asset) return null;

	const config = await resolveObjectStorageConfig(input.db);
	if (!config) {
		throw new AssetStorageUnavailableError(
			"Object Storage ist nicht konfiguriert.",
		);
	}

	const object = await getObject({
		config,
		key: asset.key,
		bucket: asset.bucket,
	}).catch((error) => {
		if (isObjectNotFoundError(error)) throw new AssetObjectNotFoundError();
		throw new AssetStorageUnavailableError(
			"Object Storage ist nicht erreichbar.",
		);
	});
	const body = object.Body
		? await object.Body.transformToByteArray()
		: new Uint8Array();

	return {
		asset,
		body,
		contentType: ENCRYPTED_ASSET_MIME_TYPE,
		etag: object.ETag ?? null,
	};
}

export type AssetObjectReference = {
	id: string;
	bucket: string | null;
	key: string;
};

export async function deleteWhiteboardAndCollectAssetObjects(input: {
	db: Database;
	whiteboardId: string;
}) {
	return input.db.transaction(async (tx) => {
		const [lockedBoard] = await tx
			.select({ id: whiteboards.id })
			.from(whiteboards)
			.where(
				and(
					eq(whiteboards.id, input.whiteboardId),
					isNotNull(whiteboards.archivedAt),
				),
			)
			.for("update");
		if (!lockedBoard) return [];

		const boardAssets = await tx.query.assets.findMany({
			where: (table, { eq }) => eq(table.whiteboardId, input.whiteboardId),
			columns: { id: true, bucket: true, key: true },
		});
		const assetObjects = boardAssets.map((asset) => ({
			id: asset.id,
			bucket: asset.bucket,
			key: asset.key,
		}));

		await tx
			.delete(whiteboards)
			.where(
				and(
					eq(whiteboards.id, input.whiteboardId),
					isNotNull(whiteboards.archivedAt),
				),
			);
		return assetObjects;
	});
}

export async function deleteAssetObjects(input: {
	db: Database;
	objects: AssetObjectReference[];
	whiteboardId?: string;
}) {
	if (input.objects.length === 0) return { deleted: 0, failed: 0, skipped: 0 };

	const config = await resolveObjectStorageConfig(input.db).catch((error) => {
		console.error("Failed to resolve object storage for asset cleanup", {
			whiteboardId: input.whiteboardId,
			error,
		});
		return null;
	});
	if (!config) {
		console.warn("Asset object cleanup skipped: storage is not configured", {
			whiteboardId: input.whiteboardId,
			count: input.objects.length,
		});
		return { deleted: 0, failed: 0, skipped: input.objects.length };
	}

	let deleted = 0;
	let failed = 0;
	for (const asset of input.objects) {
		try {
			await deleteObjectWithRetry({
				config,
				key: asset.key,
				bucket: asset.bucket,
			});
			deleted += 1;
		} catch (error) {
			failed += 1;
			console.error("Failed to delete asset object", {
				whiteboardId: input.whiteboardId,
				assetId: asset.id,
				error,
			});
		}
	}

	return { deleted, failed, skipped: 0 };
}

export async function findAsset(db: Database, assetId: string) {
	return db.query.assets.findFirst({
		where: (table, { eq }) => eq(table.id, assetId),
	});
}
