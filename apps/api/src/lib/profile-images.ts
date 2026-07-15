import { createHash, randomUUID } from "node:crypto";
import { userProfileImages, users } from "@skedra/db";
import type { Database } from "@skedra/db";
import {
	decryptBytes,
	encryptBytes,
	isEncryptedEnvelope,
} from "@skedra/shared/server-crypto";
import { and, eq, lt } from "drizzle-orm";
import { env } from "../env";
import {
	deleteObject,
	getObject,
	putObject,
	resolveObjectStorageConfig,
} from "./object-storage";

export const PROFILE_IMAGE_MAX_BYTES = 512 * 1024;
export const PROFILE_IMAGE_ENCRYPTION_VERSION = 1;
const ENCRYPTED_PROFILE_IMAGE_MIME_TYPE = "application/octet-stream";
const INSECURE_PLACEHOLDER_SECRETS = new Set([
	"change-me-to-a-random-secret-min-32-chars",
	"change-me-to-a-long-random-secret-min-32-chars",
]);

const PROFILE_IMAGE_TYPES = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
} as const;

type ProfileImageMimeType = keyof typeof PROFILE_IMAGE_TYPES;

export class ProfileImageError extends Error {
	constructor(
		message: string,
		readonly status: 400 | 404 | 413 | 503,
	) {
		super(message);
		this.name = "ProfileImageError";
	}
}

export function detectProfileImageMimeType(
	bytes: Uint8Array,
): ProfileImageMimeType | null {
	if (
		bytes.length >= 3 &&
		bytes[0] === 0xff &&
		bytes[1] === 0xd8 &&
		bytes[2] === 0xff
	) {
		return "image/jpeg";
	}
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	) {
		return "image/png";
	}
	if (
		bytes.length >= 12 &&
		String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
		String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
	) {
		return "image/webp";
	}
	return null;
}

function profileImageUrl(userId: string, version: string) {
	const baseUrl = env.API_URL.replace(/\/+$/u, "");
	return `${baseUrl}/api/profile-images/${encodeURIComponent(userId)}?v=${encodeURIComponent(version)}`;
}

function profileImageObjectKey(userId: string, version: string) {
	const userKey = createHash("sha256")
		.update(userId)
		.digest("hex")
		.slice(0, 32);
	return `profile-images/${userKey}/${version}.enc`;
}

function profileImageEncryptionOptions(userId: string) {
	const secret = [env.DATA_ENCRYPTION_SECRET, env.AUTH_SECRET].find(
		(value) => value && !INSECURE_PLACEHOLDER_SECRETS.has(value),
	);
	if (!secret) {
		throw new ProfileImageError(
			"Fuer verschluesselte Profilbilder muss DATA_ENCRYPTION_SECRET oder AUTH_SECRET sicher konfiguriert sein.",
			503,
		);
	}
	return {
		secret,
		purpose: `profile-image:${userId}`,
	};
}

export function encryptProfileImageBytes(bytes: Uint8Array, userId: string) {
	return encryptBytes(bytes, profileImageEncryptionOptions(userId));
}

export function decryptProfileImageBytes(bytes: Uint8Array, userId: string) {
	if (!isEncryptedEnvelope(bytes)) {
		throw new ProfileImageError(
			"Das gespeicherte Profilbild ist nicht verschluesselt.",
			503,
		);
	}
	return decryptBytes(bytes, profileImageEncryptionOptions(userId));
}

function assertStoredImageMatchesMetadata(body: Uint8Array, mimeType: string) {
	const detected = detectProfileImageMimeType(body);
	if (detected !== mimeType || body.byteLength > PROFILE_IMAGE_MAX_BYTES) {
		throw new ProfileImageError(
			"Das gespeicherte Profilbild ist ungueltig.",
			503,
		);
	}
}

async function deleteExternalProfileImage(
	db: Database,
	image: { provider: string; bucket: string | null; key: string },
) {
	if (image.provider === "inline") return;
	const config = await resolveObjectStorageConfig(db);
	if (!config) {
		throw new ProfileImageError("Object Storage ist nicht konfiguriert.", 503);
	}
	await deleteObject({ config, key: image.key, bucket: image.bucket });
}

export async function replaceProfileImage(input: {
	db: Database;
	userId: string;
	file: File;
}) {
	if (input.file.size < 1) {
		throw new ProfileImageError("Die Bilddatei ist leer.", 400);
	}
	if (input.file.size > PROFILE_IMAGE_MAX_BYTES) {
		throw new ProfileImageError("Das Profilbild ist zu gross.", 413);
	}

	const body = new Uint8Array(await input.file.arrayBuffer());
	const mimeType = detectProfileImageMimeType(body);
	if (!mimeType) {
		throw new ProfileImageError(
			"Erlaubt sind JPEG-, PNG- und WebP-Bilder.",
			400,
		);
	}
	const declaredType =
		input.file.type === "image/jpg" ? "image/jpeg" : input.file.type;
	if (declaredType && declaredType !== mimeType) {
		throw new ProfileImageError("Der Bildtyp ist ungueltig.", 400);
	}
	const encryptedBody = encryptProfileImageBytes(body, input.userId);

	const config = await resolveObjectStorageConfig(input.db);
	const version = randomUUID();
	const now = new Date();
	const imageUrl = profileImageUrl(input.userId, version);

	let storageRow: typeof userProfileImages.$inferInsert;
	let uploadedObject: { key: string; bucket: string | null } | null = null;
	if (config) {
		const key = profileImageObjectKey(input.userId, version);
		await putObject({
			config,
			key,
			body: encryptedBody,
			contentType: ENCRYPTED_PROFILE_IMAGE_MIME_TYPE,
			cacheControl: "private, no-store",
		});
		uploadedObject = { key, bucket: config.bucket };
		storageRow = {
			userId: input.userId,
			provider: config.preset === "custom" ? config.provider : config.preset,
			bucket: config.bucket,
			key,
			publicUrl: null,
			mimeType,
			sizeBytes: body.byteLength,
			inlineData: null,
			encryptionVersion: PROFILE_IMAGE_ENCRYPTION_VERSION,
			updatedAt: now,
		};
	} else {
		storageRow = {
			userId: input.userId,
			provider: "inline",
			bucket: null,
			key: version,
			publicUrl: null,
			mimeType,
			sizeBytes: body.byteLength,
			inlineData: Buffer.from(encryptedBody).toString("utf8"),
			encryptionVersion: PROFILE_IMAGE_ENCRYPTION_VERSION,
			updatedAt: now,
		};
	}

	const previous = await input.db
		.transaction(async (tx) => {
			// Serializes concurrent replace/remove operations for this account, even
			// before the first profile-image row exists.
			await tx
				.select({ id: users.id })
				.from(users)
				.where(eq(users.id, input.userId))
				.for("update");
			const [replacedImage] = await tx
				.select()
				.from(userProfileImages)
				.where(eq(userProfileImages.userId, input.userId));
			await tx
				.insert(userProfileImages)
				.values(storageRow)
				.onConflictDoUpdate({
					target: userProfileImages.userId,
					set: {
						provider: storageRow.provider,
						bucket: storageRow.bucket,
						key: storageRow.key,
						publicUrl: storageRow.publicUrl,
						mimeType: storageRow.mimeType,
						sizeBytes: storageRow.sizeBytes,
						inlineData: storageRow.inlineData,
						encryptionVersion: PROFILE_IMAGE_ENCRYPTION_VERSION,
						updatedAt: now,
					},
				});
			await tx
				.update(users)
				.set({ image: imageUrl, updatedAt: now })
				.where(eq(users.id, input.userId));
			return replacedImage;
		})
		.catch(async (error) => {
			if (uploadedObject && config) {
				await deleteObject({
					config,
					key: uploadedObject.key,
					bucket: uploadedObject.bucket,
				}).catch((cleanupError) => {
					console.error(
						"Failed to clean up an unreferenced profile image",
						cleanupError,
					);
				});
			}
			throw error;
		});

	if (previous) {
		await deleteExternalProfileImage(input.db, previous).catch((error) => {
			console.error("Failed to delete the previous profile image", {
				userId: input.userId,
				error,
			});
		});
	}

	return { image: imageUrl };
}

export async function removeProfileImage(input: {
	db: Database;
	userId: string;
}) {
	const now = new Date();
	const previous = await input.db.transaction(async (tx) => {
		await tx
			.select({ id: users.id })
			.from(users)
			.where(eq(users.id, input.userId))
			.for("update");
		const [removedImage] = await tx
			.select()
			.from(userProfileImages)
			.where(eq(userProfileImages.userId, input.userId));
		await tx
			.delete(userProfileImages)
			.where(eq(userProfileImages.userId, input.userId));
		await tx
			.update(users)
			.set({ image: null, updatedAt: now })
			.where(eq(users.id, input.userId));
		return removedImage;
	});
	if (previous) {
		await deleteExternalProfileImage(input.db, previous).catch((error) => {
			console.error("Failed to delete a removed profile image", {
				userId: input.userId,
				error,
			});
		});
	}
	return { image: null };
}

type StoredProfileImage = typeof userProfileImages.$inferSelect;

async function readStoredProfileImageBytes(
	db: Database,
	image: StoredProfileImage,
) {
	if (image.provider === "inline") {
		if (!image.inlineData) {
			throw new ProfileImageError("Profilbild-Daten fehlen.", 503);
		}
		return image.encryptionVersion >= PROFILE_IMAGE_ENCRYPTION_VERSION
			? new Uint8Array(Buffer.from(image.inlineData, "utf8"))
			: new Uint8Array(Buffer.from(image.inlineData, "base64"));
	}

	const config = await resolveObjectStorageConfig(db);
	if (!config) {
		throw new ProfileImageError("Object Storage ist nicht konfiguriert.", 503);
	}
	const object = await getObject({
		config,
		key: image.key,
		bucket: image.bucket,
	});
	return object.Body
		? await object.Body.transformToByteArray()
		: new Uint8Array();
}

export async function readProfileImage(db: Database, userId: string) {
	const image = await db.query.userProfileImages.findFirst({
		where: eq(userProfileImages.userId, userId),
	});
	if (!image) return null;
	if (image.encryptionVersion !== PROFILE_IMAGE_ENCRYPTION_VERSION) {
		throw new ProfileImageError(
			"Das Profilbild wurde noch nicht verschluesselt migriert.",
			503,
		);
	}

	const storedBytes = await readStoredProfileImageBytes(db, image);
	const body = decryptProfileImageBytes(storedBytes, userId);
	assertStoredImageMatchesMetadata(body, image.mimeType);
	return { image, body };
}

async function migrateStoredProfileImage(db: Database, userId: string) {
	return db.transaction(async (tx) => {
		await tx
			.select({ id: users.id })
			.from(users)
			.where(eq(users.id, userId))
			.for("update");
		const [image] = await tx
			.select()
			.from(userProfileImages)
			.where(
				and(
					eq(userProfileImages.userId, userId),
					lt(
						userProfileImages.encryptionVersion,
						PROFILE_IMAGE_ENCRYPTION_VERSION,
					),
				),
			);
		if (!image) return false;

		const storedBytes = await readStoredProfileImageBytes(db, image);
		const plaintext = isEncryptedEnvelope(storedBytes)
			? decryptBytes(storedBytes, profileImageEncryptionOptions(userId))
			: storedBytes;
		assertStoredImageMatchesMetadata(plaintext, image.mimeType);
		const encryptedBytes = isEncryptedEnvelope(storedBytes)
			? storedBytes
			: encryptProfileImageBytes(plaintext, userId);

		let inlineData: string | null = null;
		if (image.provider === "inline") {
			inlineData = Buffer.from(encryptedBytes).toString("utf8");
		} else {
			const config = await resolveObjectStorageConfig(db);
			if (!config) {
				throw new ProfileImageError(
					"Object Storage ist nicht konfiguriert.",
					503,
				);
			}
			// Gleicher Key: Schlaegt der DB-Commit fehl, ist das Objekt bereits sicher
			// verschluesselt und der naechste Start kann die Metadaten nachziehen.
			await putObject({
				config,
				key: image.key,
				body: encryptedBytes,
				contentType: ENCRYPTED_PROFILE_IMAGE_MIME_TYPE,
				cacheControl: "private, no-store",
			});
		}

		const version = randomUUID();
		const now = new Date();
		await tx
			.update(userProfileImages)
			.set({
				publicUrl: null,
				inlineData,
				encryptionVersion: PROFILE_IMAGE_ENCRYPTION_VERSION,
				updatedAt: now,
			})
			.where(eq(userProfileImages.userId, userId));
		await tx
			.update(users)
			.set({ image: profileImageUrl(userId, version), updatedAt: now })
			.where(eq(users.id, userId));
		return true;
	});
}

/** Migriert Altbestand, bevor ein API-Port Klartextbilder ausliefern kann. */
export async function migrateStoredProfileImages(db: Database) {
	const candidates = await db
		.select({ userId: userProfileImages.userId })
		.from(userProfileImages)
		.where(
			lt(userProfileImages.encryptionVersion, PROFILE_IMAGE_ENCRYPTION_VERSION),
		);
	let migrated = 0;
	for (const candidate of candidates) {
		if (await migrateStoredProfileImage(db, candidate.userId)) migrated += 1;
	}
	return migrated;
}

/** Account-Loeschung darf kein externes Profilbild als verwaistes Objekt lassen. */
export async function deleteProfileImageObjectForUser(
	db: Database,
	userId: string,
) {
	const image = await db.query.userProfileImages.findFirst({
		where: eq(userProfileImages.userId, userId),
		columns: { provider: true, bucket: true, key: true },
	});
	if (image) await deleteExternalProfileImage(db, image);
}
