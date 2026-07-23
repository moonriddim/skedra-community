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
		strokeStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
		opacity: z.number().min(0).max(100).optional(),
		locked: z.boolean().optional(),
		groupId: z.string().nullable().optional(),
		flipX: z.boolean().optional(),
		flipY: z.boolean().optional(),
		link: z.string().optional(),
		text: z.string().optional(),
		fontSize: z.number().optional(),
		fontFamily: z.string().optional(),
		fontWeight: z.enum(["normal", "bold"]).optional(),
		fontStyle: z.enum(["normal", "italic"]).optional(),
		textDecoration: z.enum(["none", "underline"]).optional(),
		textAlign: z.enum(["left", "center", "right"]).optional(),
		textColor: z.string().optional(),
		points: z
			.array(z.tuple([z.number(), z.number()]))
			.min(2)
			.optional(),
		arrowMode: z.enum(["straight", "curve", "elbow"]).optional(),
		arrowHeadStart: z.enum(["none", "arrow", "triangle", "dot"]).optional(),
		arrowHeadEnd: z.enum(["none", "arrow", "triangle", "dot"]).optional(),
		frameId: z.string().optional(),
		frameLabel: z.string().optional(),
		cornerRadius: z.number().optional(),
		cornerRadiusPercent: z.number().min(0).max(100).optional(),
		arcStartAngle: z.number().optional(),
		arcEndAngle: z.number().optional(),
		cloudArcRadius: z.number().min(4).max(48).optional(),
		pyramidSections: z.number().int().min(1).max(12).optional(),
		polygonSides: z.number().int().min(4).max(12).optional(),
		closed: z.boolean().optional(),
		arrowHeadScale: z.number().min(0.25).max(4).optional(),
		arrowHeadFilled: z.boolean().optional(),
		roughness: z.number().optional(),
		roughFillStyle: z
			.enum(["solid", "hachure", "cross-hatch", "dots", "dashed"])
			.optional(),
		roughFillScale: z.number().optional(),
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
		rotation: true,
		fill: true,
		stroke: true,
		strokeWidth: true,
		strokeStyle: true,
		opacity: true,
		locked: true,
		groupId: true,
		flipX: true,
		flipY: true,
		text: true,
		fontSize: true,
		fontFamily: true,
		fontWeight: true,
		fontStyle: true,
		textDecoration: true,
		textAlign: true,
		textColor: true,
		points: true,
		arrowMode: true,
		arrowHeadStart: true,
		arrowHeadEnd: true,
		frameId: true,
		frameLabel: true,
		cornerRadius: true,
		cornerRadiusPercent: true,
		arcStartAngle: true,
		arcEndAngle: true,
		cloudArcRadius: true,
		pyramidSections: true,
		polygonSides: true,
		closed: true,
		arrowHeadScale: true,
		arrowHeadFilled: true,
		roughness: true,
		roughFillStyle: true,
		roughFillScale: true,
	})
	.extend({ type: z.enum(CANVAS_BOUNDS_ELEMENT_TYPES) });

export type CanvasBoundsElementInput = z.infer<
	typeof canvasBoundsElementInputSchema
>;

const canvasElementVisualUpdateShape = {
	x: z.number().optional(),
	y: z.number().optional(),
	width: z.number().positive().optional(),
	height: z.number().positive().optional(),
	rotation: z.number().optional(),
	fill: z.string().optional(),
	stroke: z.string().optional(),
	strokeWidth: z.number().optional(),
	strokeStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
	opacity: z.number().min(0).max(100).optional(),
	locked: z.boolean().optional(),
	groupId: z.string().nullable().optional(),
	flipX: z.boolean().optional(),
	flipY: z.boolean().optional(),
	text: z.string().optional(),
	fontSize: z.number().optional(),
	fontFamily: z.string().optional(),
	fontWeight: z.enum(["normal", "bold"]).optional(),
	fontStyle: z.enum(["normal", "italic"]).optional(),
	textDecoration: z.enum(["none", "underline"]).optional(),
	textAlign: z.enum(["left", "center", "right"]).optional(),
	textColor: z.string().optional(),
	points: z
		.array(z.tuple([z.number(), z.number()]))
		.min(2)
		.optional(),
	arrowMode: z.enum(["straight", "curve", "elbow"]).optional(),
	arrowHeadStart: z.enum(["none", "arrow", "triangle", "dot"]).optional(),
	arrowHeadEnd: z.enum(["none", "arrow", "triangle", "dot"]).optional(),
	frameId: z.string().optional(),
	frameLabel: z.string().optional(),
	cornerRadius: z.number().optional(),
	cornerRadiusPercent: z.number().min(0).max(100).optional(),
	arcStartAngle: z.number().optional(),
	arcEndAngle: z.number().optional(),
	cloudArcRadius: z.number().min(4).max(48).optional(),
	pyramidSections: z.number().int().min(1).max(12).optional(),
	polygonSides: z.number().int().min(4).max(12).optional(),
	closed: z.boolean().optional(),
	arrowHeadScale: z.number().min(0.25).max(4).optional(),
	arrowHeadFilled: z.boolean().optional(),
	roughness: z.number().optional(),
	roughFillStyle: z
		.enum(["solid", "hachure", "cross-hatch", "dots", "dashed"])
		.optional(),
	roughFillScale: z.number().optional(),
};

/** Safe visual changes for transports that expose semantic layer operations. */
export const canvasElementVisualUpdateSchema = z
	.object(canvasElementVisualUpdateShape)
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: "Mindestens ein Feld zum Aktualisieren erforderlich",
	});

/** Partielles Update eines bestehenden Elements via REST. */
export const updateCanvasElementSchema = z
	.object({
		...canvasElementVisualUpdateShape,
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
