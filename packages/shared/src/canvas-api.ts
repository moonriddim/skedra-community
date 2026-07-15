import {
	CANVAS_BOUNDS_ELEMENT_TYPES,
	CANVAS_ELEMENT_TYPES,
} from "@skedra/canvas-core";
import { z } from "zod";

/** Erlaubte Element-Typen fuer die Public API. */
export const canvasElementTypeSchema = z.enum(CANVAS_ELEMENT_TYPES);

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
		cloudArcRadius: z.number().min(4).max(48).optional(),
		pyramidSections: z.number().int().min(1).max(12).optional(),
		closed: z.boolean().optional(),
		arrowHeadScale: z.number().min(0.25).max(4).optional(),
		arrowHeadFilled: z.boolean().optional(),
		stackIndex: z.string().min(1).optional(),
		customData: z.record(z.unknown()).optional(),
	})
	.passthrough();

export const addCanvasElementsSchema = z.object({
	elements: z.array(addCanvasElementSchema).min(1).max(100),
});

/** Canonical bounds-only input used by transports such as the MCP. */
export const canvasBoundsElementInputSchema = addCanvasElementSchema
	.pick({
		type: true,
		x: true,
		y: true,
		width: true,
		height: true,
		text: true,
		fill: true,
		stroke: true,
		cloudArcRadius: true,
		pyramidSections: true,
	})
	.extend({ type: z.enum(CANVAS_BOUNDS_ELEMENT_TYPES) });

export type CanvasBoundsElementInput = z.infer<
	typeof canvasBoundsElementInputSchema
>;

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
		closed: z.boolean().optional(),
		arrowHeadFilled: z.boolean().optional(),
		cloudArcRadius: z.number().min(4).max(48).optional(),
		pyramidSections: z.number().int().min(1).max(12).optional(),
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
