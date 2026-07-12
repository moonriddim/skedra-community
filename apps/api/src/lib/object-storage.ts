import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
	type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { instanceSettings } from "@skedra/db";
import type { Database } from "@skedra/db";
import { decryptText, encryptText } from "@skedra/shared/server-crypto";
import { eq } from "drizzle-orm";
import { env } from "../env";
import { getOrCreateInstanceSettings } from "./instance-settings";

export type ObjectStorageProvider = "inline" | "s3";
export type ObjectStoragePreset = "custom" | "r2" | "ovh" | "aws";
export type ObjectStorageSource = "database" | "env" | "inline";

export interface ResolvedObjectStorageConfig {
	source: Exclude<ObjectStorageSource, "inline">;
	provider: "s3";
	preset: ObjectStoragePreset;
	endpoint: string | null;
	region: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	publicBaseUrl: string | null;
	forcePathStyle: boolean;
}

export interface ObjectStorageStatus {
	source: ObjectStorageSource;
	configured: boolean;
	managedDeployment: boolean;
	provider: ObjectStorageProvider;
	preset: ObjectStoragePreset;
	endpoint: string | null;
	region: string | null;
	bucket: string | null;
	publicBaseUrl: string | null;
	forcePathStyle: boolean;
	hasAccessKeyId: boolean;
	hasSecretAccessKey: boolean;
	maxImageBytes: number;
}

export class ObjectStorageConfigChangeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ObjectStorageConfigChangeError";
	}
}

function getEncryptionOptions() {
	return {
		secret: env.DATA_ENCRYPTION_SECRET ?? env.AUTH_SECRET,
		purpose: "object-storage-secret-access-key",
	};
}

function normalizeOptional(value: string | null | undefined) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function assertValidEndpoint(value: string | null) {
	if (!value) return;
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new ObjectStorageConfigChangeError(
			"Object-Storage-Endpoint ist keine gueltige URL (z. B. https://s3.example.com).",
		);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new ObjectStorageConfigChangeError(
			"Object-Storage-Endpoint muss mit http:// oder https:// beginnen.",
		);
	}
}

function normalizeProvider(
	value: string | null | undefined,
): ObjectStorageProvider {
	return value === "s3" ? "s3" : "inline";
}

function normalizePreset(
	value: string | null | undefined,
): ObjectStoragePreset {
	if (value === "r2" || value === "ovh" || value === "aws") return value;
	return "custom";
}

function defaultRegionForPreset(preset: ObjectStoragePreset) {
	return preset === "r2" ? "auto" : "us-east-1";
}

function resolveFromParts(input: {
	source: Exclude<ObjectStorageSource, "inline">;
	provider: ObjectStorageProvider;
	preset: ObjectStoragePreset;
	endpoint?: string | null;
	region?: string | null;
	bucket?: string | null;
	accessKeyId?: string | null;
	secretAccessKey?: string | null;
	publicBaseUrl?: string | null;
	forcePathStyle?: boolean | null;
}): ResolvedObjectStorageConfig | null {
	if (input.provider !== "s3") return null;

	const preset = normalizePreset(input.preset);
	const endpoint = normalizeOptional(input.endpoint);
	const bucket = normalizeOptional(input.bucket);
	const accessKeyId = normalizeOptional(input.accessKeyId);
	const secretAccessKey = normalizeOptional(input.secretAccessKey);
	const region =
		normalizeOptional(input.region) ?? defaultRegionForPreset(preset);

	if (!bucket || !accessKeyId || !secretAccessKey) return null;
	if (preset !== "aws" && !endpoint) return null;

	return {
		source: input.source,
		provider: "s3",
		preset,
		endpoint,
		region,
		bucket,
		accessKeyId,
		secretAccessKey,
		publicBaseUrl: normalizeOptional(input.publicBaseUrl),
		forcePathStyle: input.forcePathStyle ?? false,
	};
}

function resolveObjectStorageConfigFromEnv(): ResolvedObjectStorageConfig | null {
	return resolveFromParts({
		source: "env",
		provider: env.SKEDRA_OBJECT_STORAGE_PROVIDER,
		preset: env.SKEDRA_OBJECT_STORAGE_PRESET,
		endpoint: env.SKEDRA_OBJECT_STORAGE_ENDPOINT,
		region: env.SKEDRA_OBJECT_STORAGE_REGION,
		bucket: env.SKEDRA_OBJECT_STORAGE_BUCKET,
		accessKeyId: env.SKEDRA_OBJECT_STORAGE_ACCESS_KEY_ID,
		secretAccessKey: env.SKEDRA_OBJECT_STORAGE_SECRET_ACCESS_KEY,
		publicBaseUrl: env.SKEDRA_OBJECT_STORAGE_PUBLIC_BASE_URL,
		forcePathStyle: env.SKEDRA_OBJECT_STORAGE_FORCE_PATH_STYLE,
	});
}

function storageLocation(config: ResolvedObjectStorageConfig | null) {
	if (!config) return null;
	return {
		provider: config.provider,
		preset: config.preset,
		endpoint: config.endpoint,
		region: config.region,
		bucket: config.bucket,
		publicBaseUrl: config.publicBaseUrl,
		forcePathStyle: config.forcePathStyle,
	};
}

function storageLocationsEqual(
	left: ReturnType<typeof storageLocation>,
	right: ReturnType<typeof storageLocation>,
) {
	if (!left || !right) return left === right;
	return (
		left.provider === right.provider &&
		left.preset === right.preset &&
		left.endpoint === right.endpoint &&
		left.region === right.region &&
		left.bucket === right.bucket &&
		left.publicBaseUrl === right.publicBaseUrl &&
		left.forcePathStyle === right.forcePathStyle
	);
}

async function hasStoredAssetObjects(db: Database) {
	const asset = await db.query.assets.findFirst({ columns: { id: true } });
	return !!asset;
}

export function isManagedDeployment() {
	return env.SKEDRA_DEPLOYMENT_MODE === "managed";
}

export async function resolveObjectStorageConfig(
	db: Database,
): Promise<ResolvedObjectStorageConfig | null> {
	if (isManagedDeployment()) return resolveObjectStorageConfigFromEnv();

	const settings = await getOrCreateInstanceSettings(db);
	if (settings.useCustomObjectStorage) {
		const secretAccessKey = settings.encryptedObjectStorageSecretAccessKey
			? decryptText(
					settings.encryptedObjectStorageSecretAccessKey,
					getEncryptionOptions(),
				)
			: null;

		return resolveFromParts({
			source: "database",
			provider: normalizeProvider(settings.objectStorageProvider),
			preset: normalizePreset(settings.objectStoragePreset),
			endpoint: settings.objectStorageEndpoint,
			region: settings.objectStorageRegion,
			bucket: settings.objectStorageBucket,
			accessKeyId: settings.objectStorageAccessKeyId,
			secretAccessKey,
			publicBaseUrl: settings.objectStoragePublicBaseUrl,
			forcePathStyle: settings.objectStorageForcePathStyle,
		});
	}

	return resolveObjectStorageConfigFromEnv();
}

function statusFromResolved(
	resolved: ResolvedObjectStorageConfig | null,
): ObjectStorageStatus {
	if (!resolved) {
		return {
			source: "inline",
			configured: false,
			managedDeployment: isManagedDeployment(),
			provider: "inline",
			preset: "custom",
			endpoint: null,
			region: null,
			bucket: null,
			publicBaseUrl: null,
			forcePathStyle: false,
			hasAccessKeyId: false,
			hasSecretAccessKey: false,
			maxImageBytes: env.SKEDRA_ASSET_MAX_IMAGE_BYTES,
		};
	}

	return {
		source: resolved.source,
		configured: true,
		managedDeployment: isManagedDeployment(),
		provider: resolved.provider,
		preset: resolved.preset,
		endpoint: resolved.endpoint,
		region: resolved.region,
		bucket: resolved.bucket,
		publicBaseUrl: resolved.publicBaseUrl,
		forcePathStyle: resolved.forcePathStyle,
		hasAccessKeyId: true,
		hasSecretAccessKey: true,
		maxImageBytes: env.SKEDRA_ASSET_MAX_IMAGE_BYTES,
	};
}

export async function getObjectStorageStatus(db: Database) {
	return statusFromResolved(await resolveObjectStorageConfig(db));
}

export function getEnvObjectStorageStatus() {
	return statusFromResolved(resolveObjectStorageConfigFromEnv());
}

export function encryptObjectStorageSecretAccessKey(secret: string) {
	return encryptText(secret, getEncryptionOptions());
}

let cachedS3Client: { fingerprint: string; client: S3Client } | undefined;

function createS3Client(config: ResolvedObjectStorageConfig) {
	const fingerprint = JSON.stringify({
		endpoint: config.endpoint,
		region: config.region,
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
		forcePathStyle: config.forcePathStyle,
	});
	if (cachedS3Client?.fingerprint === fingerprint) {
		return cachedS3Client.client;
	}
	const clientConfig: S3ClientConfig = {
		region: config.region,
		credentials: {
			accessKeyId: config.accessKeyId,
			secretAccessKey: config.secretAccessKey,
		},
		forcePathStyle: config.forcePathStyle,
	};
	if (config.endpoint) clientConfig.endpoint = config.endpoint;
	cachedS3Client?.client.destroy();
	const client = new S3Client(clientConfig);
	cachedS3Client = { fingerprint, client };
	return client;
}

export function getObjectPublicUrl(
	config: ResolvedObjectStorageConfig,
	key: string,
) {
	if (!config.publicBaseUrl) return null;
	const encodedKey = key
		.split("/")
		.map((part) => encodeURIComponent(part))
		.join("/");
	return `${config.publicBaseUrl.replace(/\/$/u, "")}/${encodedKey}`;
}

export async function putObject(input: {
	config: ResolvedObjectStorageConfig;
	key: string;
	body: Uint8Array;
	contentType: string;
	cacheControl?: string;
}) {
	const client = createS3Client(input.config);
	await client.send(
		new PutObjectCommand({
			Bucket: input.config.bucket,
			Key: input.key,
			Body: input.body,
			ContentType: input.contentType,
			CacheControl: input.cacheControl,
		}),
	);
}

export async function getObject(input: {
	config: ResolvedObjectStorageConfig;
	key: string;
	bucket?: string | null;
}) {
	const client = createS3Client(input.config);
	return client.send(
		new GetObjectCommand({
			Bucket: input.bucket ?? input.config.bucket,
			Key: input.key,
		}),
	);
}

export async function deleteObject(input: {
	config: ResolvedObjectStorageConfig;
	key: string;
	bucket?: string | null;
}) {
	const client = createS3Client(input.config);
	await client.send(
		new DeleteObjectCommand({
			Bucket: input.bucket ?? input.config.bucket,
			Key: input.key,
		}),
	);
}

export async function updateObjectStorageSettings(
	db: Database,
	input: {
		useCustomObjectStorage: boolean;
		provider: ObjectStorageProvider;
		preset: ObjectStoragePreset;
		endpoint?: string | null;
		region?: string | null;
		bucket?: string | null;
		accessKeyId?: string | null;
		secretAccessKey?: string | null;
		clearSecretAccessKey?: boolean;
		publicBaseUrl?: string | null;
		forcePathStyle?: boolean;
		adminUserId: string;
	},
) {
	if (isManagedDeployment()) {
		throw new Error("Object Storage is managed by environment variables.");
	}

	if (input.useCustomObjectStorage && input.provider === "s3") {
		assertValidEndpoint(normalizeOptional(input.endpoint));
	}

	const settings = await getOrCreateInstanceSettings(db);
	let encryptedSecretAccessKey = settings.encryptedObjectStorageSecretAccessKey;
	let nextSecretAccessKey = encryptedSecretAccessKey
		? decryptText(encryptedSecretAccessKey, getEncryptionOptions())
		: null;

	if (input.clearSecretAccessKey) {
		encryptedSecretAccessKey = null;
		nextSecretAccessKey = null;
	} else if (input.secretAccessKey?.trim()) {
		nextSecretAccessKey = input.secretAccessKey.trim();
		encryptedSecretAccessKey =
			encryptObjectStorageSecretAccessKey(nextSecretAccessKey);
	}

	const currentLocation = storageLocation(await resolveObjectStorageConfig(db));
	const nextConfig = input.useCustomObjectStorage
		? resolveFromParts({
				source: "database",
				provider: input.provider,
				preset: input.preset,
				endpoint: input.endpoint,
				region: input.region,
				bucket: input.bucket,
				accessKeyId: input.accessKeyId,
				secretAccessKey: nextSecretAccessKey,
				publicBaseUrl: input.publicBaseUrl,
				forcePathStyle: input.forcePathStyle,
			})
		: resolveObjectStorageConfigFromEnv();
	const nextLocation = storageLocation(nextConfig);
	if (
		!storageLocationsEqual(currentLocation, nextLocation) &&
		(await hasStoredAssetObjects(db))
	) {
		throw new ObjectStorageConfigChangeError(
			"Object-Storage-Location kann nicht geaendert werden, solange gespeicherte Assets existieren.",
		);
	}

	const [updated] = await db
		.update(instanceSettings)
		.set({
			adminUserId: settings.adminUserId ?? input.adminUserId,
			useCustomObjectStorage: input.useCustomObjectStorage,
			objectStorageProvider: input.provider,
			objectStoragePreset: input.preset,
			objectStorageEndpoint: normalizeOptional(input.endpoint),
			objectStorageRegion: normalizeOptional(input.region),
			objectStorageBucket: normalizeOptional(input.bucket),
			objectStorageAccessKeyId: normalizeOptional(input.accessKeyId),
			encryptedObjectStorageSecretAccessKey: encryptedSecretAccessKey,
			objectStoragePublicBaseUrl: normalizeOptional(input.publicBaseUrl),
			objectStorageForcePathStyle: input.forcePathStyle ?? false,
			updatedAt: new Date(),
		})
		.where(eq(instanceSettings.id, "default"))
		.returning();

	return updated;
}
