import { z } from "zod";

/** Typ-Kennung in .skedra-Dateien (analog zu Excalidraw). */
export const SKEDRA_FILE_TYPE = "skedra" as const;
export const SKEDRA_ENCRYPTED_FILE_TYPE = "skedra-encrypted" as const;

/** Aktuelle Schema-Version — bei Breaking Changes erhoehen. */
export const SKEDRA_FILE_VERSION = 1;

export const skedraFileViewportSchema = z.object({
	x: z.number(),
	y: z.number(),
	zoom: z.number(),
});

export const skedraFileAppStateSchema = z
	.object({
		canvasBg: z.string().optional(),
		viewport: skedraFileViewportSchema.optional(),
	})
	.optional();

export const skedraFileSchema = z.object({
	type: z.literal(SKEDRA_FILE_TYPE),
	version: z.number().int().positive(),
	source: z.string().optional(),
	elements: z.array(z.record(z.unknown())),
	views: z.array(z.record(z.unknown())).optional(),
	appState: skedraFileAppStateSchema,
});

export const skedraEncryptedFileSchema = z.object({
	type: z.literal(SKEDRA_ENCRYPTED_FILE_TYPE),
	version: z.number().int().positive(),
	source: z.string().optional(),
	algorithm: z.literal("PBKDF2-SHA256-AES-GCM"),
	kdf: z.object({
		name: z.literal("PBKDF2"),
		hash: z.literal("SHA-256"),
		iterations: z.number().int().positive(),
		salt: z.string(),
	}),
	iv: z.string(),
	ciphertext: z.string(),
});

export type SkedraFileViewport = z.infer<typeof skedraFileViewportSchema>;
export type SkedraFileAppState = z.infer<typeof skedraFileAppStateSchema>;
export type SkedraFile = z.infer<typeof skedraFileSchema>;
export type SkedraEncryptedFile = z.infer<typeof skedraEncryptedFileSchema>;

export const SKEDRA_FILE_EXTENSION = "skedra";
export const SKEDRA_ENCRYPTED_FILE_EXTENSION = "skedra.enc";
export const SKEDRA_FILE_MIME = "application/vnd.skedra+json";
