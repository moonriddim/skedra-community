import {
	type CanvasElement,
	createGanttChartElements,
	createSequenceDiagramElements,
	parseSequenceDiagram,
} from "@skedra/canvas-core";
import { z } from "zod";
import type { AddCanvasElementInput } from "../canvas-api";

const structuredElementDefaults = {
	createId: () => crypto.randomUUID(),
	stroke: "#334155",
	fontFamily: "system-ui, sans-serif",
};

function toApiElements(elements: CanvasElement[]): AddCanvasElementInput[] {
	return elements.map((element) => ({ ...element }));
}

export const aiSequenceDiagramSchema = z.object({
	source: z
		.string()
		.min(20)
		.max(12_000)
		.refine(
			(value) => /^\s*(?:```(?:mermaid)?\s*)?sequenceDiagram\b/iu.test(value),
			"Mermaid-Sequenzsyntax muss mit sequenceDiagram beginnen.",
		),
});

export type AiSequenceDiagramInput = z.infer<typeof aiSequenceDiagramSchema>;

const sequenceMessageKindSchema = z.enum([
	"synchronous",
	"asynchronous",
	"return",
	"self",
]);

export const aiSequenceDiagramEditActionSchema = z.discriminatedUnion(
	"operation",
	[
		z.object({
			operation: z.literal("add_participant"),
			label: z.string().min(1).max(160),
			kind: z.enum(["actor", "participant"]),
		}),
		z.object({
			operation: z.literal("add_message"),
			fromParticipantId: z.string().min(1).max(160),
			toParticipantId: z.string().min(1).max(160),
			label: z.string().min(1).max(240),
			kind: sequenceMessageKindSchema,
		}),
		z.object({
			operation: z.literal("update_message"),
			eventIndex: z.number().int().min(0),
			fromParticipantId: z.string().min(1).max(160),
			toParticipantId: z.string().min(1).max(160),
			label: z.string().min(1).max(240),
			kind: sequenceMessageKindSchema,
		}),
		z.object({
			operation: z.literal("delete_message"),
			eventIndex: z.number().int().min(0),
		}),
		z.object({
			operation: z.literal("add_activation"),
			participantId: z.string().min(1).max(160),
			height: z.number().min(48).max(600).optional(),
		}),
		z.object({
			operation: z.literal("add_fragment"),
			kind: z.enum(["alt", "opt", "loop"]),
			label: z.string().min(1).max(240),
			wrapCurrentFlow: z.boolean().optional(),
		}),
	],
);

export const aiSequenceDiagramEditSchema = z.object({
	diagramId: z.string().min(1).max(160),
	action: aiSequenceDiagramEditActionSchema,
});

export type AiSequenceDiagramEditInput = z.infer<
	typeof aiSequenceDiagramEditSchema
>;

const aiSequenceDiagramContextParticipantSchema = z.object({
	id: z.string().min(1).max(160),
	label: z.string().min(1).max(160),
	kind: z.enum(["actor", "participant"]),
});

const aiSequenceDiagramContextMessageSchema = z.object({
	eventIndex: z.number().int().min(0),
	fromParticipantId: z.string().min(1).max(160),
	toParticipantId: z.string().min(1).max(160),
	label: z.string().min(1).max(240),
	kind: sequenceMessageKindSchema,
});

export const aiSequenceDiagramContextSchema = z.object({
	activeDiagramId: z.string().min(1).max(160).optional(),
	diagrams: z
		.array(
			z.object({
				id: z.string().min(1).max(160),
				title: z.string().max(240).nullable(),
				participants: z
					.array(aiSequenceDiagramContextParticipantSchema)
					.max(30),
				messages: z.array(aiSequenceDiagramContextMessageSchema).max(100),
			}),
		)
		.max(10),
});

export type AiSequenceDiagramContext = z.infer<
	typeof aiSequenceDiagramContextSchema
>;

export function buildSequenceDiagramElementsFromAi(
	input: AiSequenceDiagramInput,
	position: { x?: number; y?: number } = {},
) {
	const parsed = parseSequenceDiagram(input.source);
	const elements = createSequenceDiagramElements({
		source: input.source,
		x: position.x ?? 80,
		y: position.y ?? 80,
		defaults: structuredElementDefaults,
		appearance: { fontFamily: structuredElementDefaults.fontFamily },
	});
	return {
		elements: toApiElements(elements),
		participantCount: parsed.document.participants.length,
		messageCount: parsed.document.events.filter(
			(event) => event.type === "message",
		).length,
	};
}

const ganttTaskSchema = z.object({
	id: z.string().min(1).max(80),
	title: z.string().min(1).max(240),
	startDay: z.number().int().min(0).max(3650),
	durationDays: z.number().int().min(1).max(3650),
	progress: z.number().min(0).max(100).optional(),
	status: z.enum(["planned", "active", "completed", "delayed"]).optional(),
	owner: z.string().max(160).optional(),
	color: z.string().max(40).optional(),
	milestone: z.boolean().optional(),
	critical: z.boolean().optional(),
	group: z.boolean().optional(),
	parentId: z.string().min(1).max(80).optional(),
	collapsed: z.boolean().optional(),
});

const ganttDependencySchema = z.object({
	fromTaskId: z.string().min(1).max(80),
	toTaskId: z.string().min(1).max(80),
	type: z
		.enum([
			"finish-to-start",
			"start-to-start",
			"finish-to-finish",
			"start-to-finish",
		])
		.optional(),
});

const ganttTaskEditChangesSchema = z
	.object({
		title: z.string().min(1).max(240).optional(),
		startDay: z.number().int().min(0).max(3650).optional(),
		durationDays: z.number().int().min(1).max(3650).optional(),
		progress: z.number().min(0).max(100).optional(),
		status: z.enum(["planned", "active", "completed", "delayed"]).optional(),
		category: z.string().min(1).max(80).optional(),
		categoryLabel: z.string().max(160).optional(),
		owner: z.string().max(160).optional(),
		color: z.string().max(40).optional(),
		critical: z.boolean().optional(),
	})
	.refine((changes) => Object.keys(changes).length > 0, {
		message: "Mindestens eine Aufgabenänderung ist erforderlich.",
	});

const ganttChartEditChangesSchema = z
	.object({
		title: z.string().min(1).max(240).optional(),
		startDate: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD erwartet")
			.optional(),
		dayCount: z.number().int().min(7).max(3650).optional(),
		showToday: z.boolean().optional(),
	})
	.refine((changes) => Object.keys(changes).length > 0, {
		message: "Mindestens eine Planänderung ist erforderlich.",
	});

export const aiGanttChartEditActionSchema = z.discriminatedUnion("operation", [
	z.object({
		operation: z.literal("update_chart"),
		changes: ganttChartEditChangesSchema,
	}),
	z.object({
		operation: z.literal("add_task"),
		kind: z.enum(["task", "milestone", "group"]),
		task: ganttTaskEditChangesSchema.optional(),
		parentId: z.string().min(1).max(80).optional(),
		afterTaskId: z.string().min(1).max(80).optional(),
	}),
	z.object({
		operation: z.literal("update_task"),
		taskId: z.string().min(1).max(80),
		changes: ganttTaskEditChangesSchema,
	}),
	z.object({
		operation: z.literal("shift_task"),
		taskId: z.string().min(1).max(80),
		deltaDays: z.number().int().min(-3650).max(3650),
	}),
	z.object({
		operation: z.literal("delete_task"),
		taskId: z.string().min(1).max(80),
	}),
	z.object({
		operation: z.literal("move_task"),
		taskId: z.string().min(1).max(80),
		targetIndex: z.number().int().min(0).max(200),
		parentId: z.string().min(1).max(80).nullable().optional(),
	}),
	z.object({
		operation: z.literal("set_group_collapsed"),
		groupId: z.string().min(1).max(80),
		collapsed: z.boolean(),
	}),
	z.object({
		operation: z.literal("add_dependency"),
		fromTaskId: z.string().min(1).max(80),
		toTaskId: z.string().min(1).max(80),
		type: z
			.enum([
				"finish-to-start",
				"start-to-start",
				"finish-to-finish",
				"start-to-finish",
			])
			.optional(),
	}),
	z.object({
		operation: z.literal("delete_dependency"),
		dependencyIndex: z.number().int().min(0).max(200),
	}),
]);

export const aiGanttChartEditSchema = z.object({
	chartId: z.string().min(1).max(160),
	action: aiGanttChartEditActionSchema,
});

export type AiGanttChartEditInput = z.infer<typeof aiGanttChartEditSchema>;

const aiGanttContextTaskSchema = ganttTaskSchema.extend({
	progress: z.number().min(0).max(100),
	status: z.enum(["planned", "active", "completed", "delayed"]),
	category: z.string().min(1).max(80),
	milestone: z.boolean(),
	critical: z.boolean(),
	group: z.boolean(),
	collapsed: z.boolean(),
});

export const aiGanttChartContextSchema = z.object({
	activeChartId: z.string().min(1).max(160).optional(),
	charts: z
		.array(
			z.object({
				id: z.string().min(1).max(160),
				title: z.string().min(1).max(240),
				startDate: z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD erwartet"),
				dayCount: z.number().int().min(1).max(3650),
				showToday: z.boolean(),
				tasks: z.array(aiGanttContextTaskSchema).max(100),
				dependencies: z
					.array(
						ganttDependencySchema.extend({ index: z.number().int().min(0) }),
					)
					.max(200),
			}),
		)
		.max(10),
});

export type AiGanttChartContext = z.infer<typeof aiGanttChartContextSchema>;

export const aiGanttChartSchema = z
	.object({
		title: z.string().min(1).max(240).optional(),
		startDate: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD erwartet")
			.optional(),
		dayCount: z.number().int().min(7).max(3650).optional(),
		tasks: z.array(ganttTaskSchema).min(1).max(60),
		dependencies: z.array(ganttDependencySchema).max(120).optional(),
	})
	.superRefine((input, ctx) => {
		const ids = new Set<string>();
		for (const [index, task] of input.tasks.entries()) {
			if (ids.has(task.id)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["tasks", index, "id"],
					message: "Aufgaben-IDs müssen eindeutig sein.",
				});
			}
			ids.add(task.id);
		}
		for (const [index, dependency] of (input.dependencies ?? []).entries()) {
			if (!ids.has(dependency.fromTaskId) || !ids.has(dependency.toTaskId)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["dependencies", index],
					message: "Abhängigkeiten müssen auf vorhandene Aufgaben verweisen.",
				});
			}
		}
	});

export type AiGanttChartInput = z.infer<typeof aiGanttChartSchema>;

export function buildGanttChartElementsFromAi(
	input: AiGanttChartInput,
	position: { x?: number; y?: number } = {},
) {
	return {
		elements: toApiElements(
			createGanttChartElements(structuredElementDefaults, {
				x: position.x ?? 80,
				y: position.y ?? 80,
				title: input.title,
				startDate: input.startDate,
				dayCount: input.dayCount,
				tasks: input.tasks,
				dependencies: input.dependencies,
				fontFamily: structuredElementDefaults.fontFamily,
			}),
		),
		taskCount: input.tasks.filter((task) => !task.group).length,
		milestoneCount: input.tasks.filter((task) => task.milestone).length,
	};
}
