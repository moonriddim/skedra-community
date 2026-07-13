import { z } from "zod";

const finiteCoordinateSchema = z
	.number()
	.finite()
	.min(-1_000_000_000)
	.max(1_000_000_000);

export const presentationRelativeCameraSchema = z.object({
	centerX: z.number().finite().min(-100).max(100),
	centerY: z.number().finite().min(-100).max(100),
	visibleWidth: z.number().finite().positive().max(100),
	visibleHeight: z.number().finite().positive().max(100),
});

export const presentationCursorSchema = z
	.object({ x: finiteCoordinateSchema, y: finiteCoordinateSchema })
	.nullable();

export const presentationFrameContentSchema = z.object({
	version: z.literal(1),
	slide: z.object({
		id: z.string().min(1).max(160),
		name: z.string().min(1).max(120),
		index: z.number().int().min(0).max(9_999),
		total: z.number().int().min(1).max(10_000),
		x: finiteCoordinateSchema,
		y: finiteCoordinateSchema,
		width: z.number().finite().positive().max(1_000_000_000),
		height: z.number().finite().positive().max(1_000_000_000),
		aspectRatio: z.enum(["16:9", "4:3", "free"]).optional(),
	}),
	elements: z.array(z.unknown()).max(25_000),
	camera: presentationRelativeCameraSchema,
});

export const presentationPublisherMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("frame"),
		sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
		payload: z.string().min(1).max(4_000_000),
		assetIds: z.array(z.string().uuid()).max(10_000),
	}),
	z.object({
		type: z.literal("cursor"),
		sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
		cursor: presentationCursorSchema,
	}),
	z.object({
		type: z.literal("camera"),
		sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
		viewId: z.string().min(1).max(160),
		camera: presentationRelativeCameraSchema,
	}),
	z.object({ type: z.literal("heartbeat") }),
]);

export const presentationViewerMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("frame"),
		sessionId: z.string().uuid(),
		sequence: z.number().int().nonnegative(),
		payload: z.string().min(1).max(4_000_000),
	}),
	z.object({
		type: z.literal("cursor"),
		sessionId: z.string().uuid(),
		sequence: z.number().int().nonnegative(),
		cursor: presentationCursorSchema,
	}),
	z.object({
		type: z.literal("camera"),
		sessionId: z.string().uuid(),
		sequence: z.number().int().nonnegative(),
		viewId: z.string().min(1).max(160),
		camera: presentationRelativeCameraSchema,
	}),
	z.object({ type: z.literal("waiting") }),
	z.object({ type: z.literal("ended") }),
]);

export const presentationPresenterControlMessageSchema = z.discriminatedUnion(
	"type",
	[
		z.object({
			type: z.literal("ready"),
			audienceCount: z.number().int().nonnegative(),
		}),
		z.object({
			type: z.literal("ack"),
			sequence: z.number().int().nonnegative(),
		}),
		z.object({
			type: z.literal("audience"),
			count: z.number().int().nonnegative(),
		}),
		z.object({ type: z.literal("ended") }),
	],
);

export const remoteCanvasPresenceSchema = z.object({
	clientId: z.number().int().nonnegative().max(0x7fff_ffff),
	user: z.object({
		id: z.string().min(1).max(200),
		name: z.string().min(1).max(120),
		image: z.string().max(2_000).nullable(),
		color: z.string().min(1).max(40),
		role: z.enum(["owner", "editor", "viewer"]),
	}),
	selection: z.array(z.string().min(1).max(200)).max(200),
	cursor: presentationCursorSchema,
	viewport: z
		.object({
			x: finiteCoordinateSchema,
			y: finiteCoordinateSchema,
			zoom: z.number().finite().positive().min(0.01).max(100),
		})
		.nullable(),
	activeViewId: z.string().min(1).max(160).nullable(),
	canWrite: z.boolean(),
	updatedAt: z.number().finite().nonnegative(),
});

export type PresentationRelativeCamera = z.infer<
	typeof presentationRelativeCameraSchema
>;
export type PresentationFrameContent = z.infer<
	typeof presentationFrameContentSchema
>;
export type PresentationPublisherMessage = z.infer<
	typeof presentationPublisherMessageSchema
>;
export type PresentationViewerMessage = z.infer<
	typeof presentationViewerMessageSchema
>;
