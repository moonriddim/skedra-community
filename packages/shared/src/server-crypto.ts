import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";

const ENCRYPTION_PREFIX = "skedra-encrypted-v1";
const IV_LENGTH = 12;

export type EncryptionOptions = {
	secret: string;
	purpose: string;
};

function requireSecret(secret: string) {
	if (secret.trim().length < 32) {
		throw new Error(
			"DATA_ENCRYPTION_SECRET must contain at least 32 characters",
		);
	}
}

function deriveKey({ secret, purpose }: EncryptionOptions) {
	requireSecret(secret);
	return createHash("sha256")
		.update("skedra:data-encryption:v1\0")
		.update(purpose)
		.update("\0")
		.update(secret)
		.digest();
}

function getAad(purpose: string) {
	return Buffer.from(`skedra:${purpose}:v1`, "utf8");
}

export function isEncryptedEnvelope(value: Uint8Array | string) {
	const text =
		typeof value === "string"
			? value
			: Buffer.from(value).toString("utf8", 0, ENCRYPTION_PREFIX.length);
	return text.startsWith(ENCRYPTION_PREFIX);
}

export function encryptBytes(value: Uint8Array, options: EncryptionOptions) {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv("aes-256-gcm", deriveKey(options), iv);
	cipher.setAAD(getAad(options.purpose));

	const ciphertext = Buffer.concat([
		cipher.update(Buffer.from(value)),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	const envelope = [
		ENCRYPTION_PREFIX,
		iv.toString("base64"),
		tag.toString("base64"),
		ciphertext.toString("base64"),
	].join(".");

	return Buffer.from(envelope, "utf8");
}

export function decryptBytes(value: Uint8Array, options: EncryptionOptions) {
	const buffer = Buffer.from(value);
	if (!isEncryptedEnvelope(buffer)) {
		return buffer;
	}

	const [prefix, ivEncoded, tagEncoded, ciphertextEncoded] = buffer
		.toString("utf8")
		.split(".");
	if (
		prefix !== ENCRYPTION_PREFIX ||
		!ivEncoded ||
		!tagEncoded ||
		!ciphertextEncoded
	) {
		throw new Error("Invalid encrypted data envelope");
	}

	const decipher = createDecipheriv(
		"aes-256-gcm",
		deriveKey(options),
		Buffer.from(ivEncoded, "base64"),
	);
	decipher.setAAD(getAad(options.purpose));
	decipher.setAuthTag(Buffer.from(tagEncoded, "base64"));

	return Buffer.concat([
		decipher.update(Buffer.from(ciphertextEncoded, "base64")),
		decipher.final(),
	]);
}

export function encryptText(value: string, options: EncryptionOptions) {
	return encryptBytes(Buffer.from(value, "utf8"), options).toString("utf8");
}

export function decryptText(value: string, options: EncryptionOptions) {
	return decryptBytes(Buffer.from(value, "utf8"), options).toString("utf8");
}
