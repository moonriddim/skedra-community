import { z } from "zod";

/** Erlaubte Element-Typen fuer die Public API. */
export const canvasElementTypeSchema = z.enum([
	"rectangle",
	"ellipse",
	"diamond",
	"line",
	"arrow",
	"image",
	"text",
	"freehand",
	"frame",
]);

/** Einzelnes Element zum Hinzufuegen via REST/MCP. */
export const addCanvasElementSchema = z
	.object({
		id: z.string().min(1).optional(),
		type: canvasElementTypeSchema,
		x: z.number(),
		y: z.number(),
		width: z.number().positive(),
		height: z.number().positive(),
		rotation: z.number().optional(),
		fill: z.string().optional(),
		stroke: z.string().optional(),
		strokeWidth: z.number().optional(),
		opacity: z.number().min(0).max(100).optional(),
		text: z.string().optional(),
		fontSize: z.number().optional(),
		fontWeight: z.enum(["normal", "bold"]).optional(),
		textAlign: z.enum(["left", "center", "right"]).optional(),
		textColor: z.string().optional(),
		frameId: z.string().optional(),
		frameLabel: z.string().optional(),
		cornerRadius: z.number().optional(),
		cornerRadiusPercent: z.number().min(0).max(100).optional(),
		arrowHeadScale: z.number().min(0.25).max(4).optional(),
		arrowHeadFilled: z.boolean().optional(),
		stackIndex: z.string().min(1).optional(),
		customData: z.record(z.unknown()).optional(),
	})
	.passthrough();

export const addCanvasElementsSchema = z.object({
	elements: z.array(addCanvasElementSchema).min(1).max(100),
});

/** Partielles Update eines bestehenden Elements via REST. */
export const updateCanvasElementSchema = z
	.object({
		x: z.number().optional(),
		y: z.number().optional(),
		width: z.number().positive().optional(),
		height: z.number().positive().optional(),
		rotation: z.number().optional(),
		fill: z.string().optional(),
		stroke: z.string().optional(),
		strokeWidth: z.number().optional(),
		opacity: z.number().min(0).max(100).optional(),
		text: z.string().optional(),
		fontSize: z.number().optional(),
		arrowHeadFilled: z.boolean().optional(),
		stackIndex: z.string().min(1).optional(),
		customData: z.record(z.unknown()).optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "Mindestens ein Feld zum Aktualisieren erforderlich",
	});

export type UpdateCanvasElementInput = z.infer<
	typeof updateCanvasElementSchema
>;

export type AddCanvasElementInput = z.infer<typeof addCanvasElementSchema>;
