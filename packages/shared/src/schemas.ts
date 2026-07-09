import { z } from "zod";

export const createWhiteboardSchema = z.object({
	name: z.string().min(1).max(120),
	folderId: z.string().uuid().nullable().optional(),
});

export const createWhiteboardWithStateSchema = z.object({
	name: z.string().min(1).max(120),
	stateBase64: z.string().min(1).optional(),
	folderId: z.string().uuid().nullable().optional(),
	e2eeInitialUpdate: z.string().min(1).max(4_000_000),
	e2eeKeyHint: z.string().max(120).optional(),
});

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
