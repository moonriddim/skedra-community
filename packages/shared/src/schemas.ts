import { z } from "zod";

export const e2eeKeyHashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
export const encryptedBoardKeyEnvelopeSchema = z.string().min(1).max(20_000);
export const whiteboardEncryptionModeSchema = z.enum(["server", "e2ee"]);

const createWhiteboardBaseSchema = z.object({
	id: z.string().uuid().optional(),
	name: z.string().min(1).max(120),
	folderId: z.string().uuid().nullable().optional(),
});

export const createWhiteboardSchema = z.discriminatedUnion("encryptionMode", [
	createWhiteboardBaseSchema.extend({
		encryptionMode: z.literal("server"),
	}),
	createWhiteboardBaseSchema.extend({
		encryptionMode: z.literal("e2ee"),
		e2eeKeyHash: e2eeKeyHashSchema,
		ownEncryptedBoardKey: encryptedBoardKeyEnvelopeSchema.optional(),
	}),
]);

const createWhiteboardWithStateBaseSchema = z.object({
	id: z.string().uuid().optional(),
	name: z.string().min(1).max(120),
	folderId: z.string().uuid().nullable().optional(),
});

export const createWhiteboardWithStateSchema = z.discriminatedUnion(
	"encryptionMode",
	[
		createWhiteboardWithStateBaseSchema.extend({
			encryptionMode: z.literal("server"),
			stateBase64: z.string().min(1).max(4_000_000),
		}),
		createWhiteboardWithStateBaseSchema.extend({
			encryptionMode: z.literal("e2ee"),
			e2eeInitialUpdate: z.string().min(1).max(4_000_000),
			e2eeKeyHint: z.string().max(120).optional(),
			e2eeKeyHash: e2eeKeyHashSchema,
			ownEncryptedBoardKey: encryptedBoardKeyEnvelopeSchema.optional(),
		}),
	],
);

export const updateWhiteboardSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(120).optional(),
	folderId: z.string().uuid().nullable().optional(),
});

export const whiteboardPresentationAccessModeSchema = z.enum([
	"always",
	"presentation-only",
]);

export const whiteboardPresentationShareSettingsSchema = z.object({
	enabled: z.boolean(),
	presenceEnabled: z.boolean(),
	accessMode: whiteboardPresentationAccessModeSchema,
});

export type WhiteboardPresentationShareSettings = z.infer<
	typeof whiteboardPresentationShareSettingsSchema
>;
