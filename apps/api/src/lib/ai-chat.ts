/**
 * Persistierter AI-Chat (Text-to-Diagram) pro Board und User.
 */

import { type Database, whiteboardAiMessages } from "@skedra/db";
import { and, asc, eq } from "drizzle-orm";

export type AiChatRole = "user" | "assistant";

export type AiChatMessage = {
	id: string;
	role: AiChatRole;
	content: string;
	model: string | null;
	elementCount: number | null;
	createdAt: Date;
};

const HISTORY_LIMIT = 20;

export async function listWhiteboardAiMessages(
	db: Database,
	whiteboardId: string,
	userId: string,
): Promise<AiChatMessage[]> {
	const rows = await db.query.whiteboardAiMessages.findMany({
		where: and(
			eq(whiteboardAiMessages.whiteboardId, whiteboardId),
			eq(whiteboardAiMessages.userId, userId),
		),
		orderBy: asc(whiteboardAiMessages.createdAt),
		limit: HISTORY_LIMIT,
		columns: {
			id: true,
			role: true,
			content: true,
			model: true,
			elementCount: true,
			createdAt: true,
		},
	});

	return rows.map((row) => ({
		id: row.id,
		role: row.role as AiChatRole,
		content: row.content,
		model: row.model,
		elementCount: row.elementCount,
		createdAt: row.createdAt,
	}));
}

export async function appendWhiteboardAiMessage(
	db: Database,
	input: {
		whiteboardId: string;
		userId: string;
		role: AiChatRole;
		content: string;
		model?: string | null;
		elementCount?: number | null;
	},
) {
	const [message] = await db
		.insert(whiteboardAiMessages)
		.values({
			whiteboardId: input.whiteboardId,
			userId: input.userId,
			role: input.role,
			content: input.content,
			model: input.model ?? null,
			elementCount: input.elementCount ?? null,
		})
		.returning({
			id: whiteboardAiMessages.id,
			role: whiteboardAiMessages.role,
			content: whiteboardAiMessages.content,
			model: whiteboardAiMessages.model,
			elementCount: whiteboardAiMessages.elementCount,
			createdAt: whiteboardAiMessages.createdAt,
		});

	return message;
}

function describeAssistantTurn(content: string, elementCount: number) {
	if (content.startsWith("kanban:")) {
		const [, lists = "0", cards = "0"] = content.split(":");
		return `Kanban board created with ${lists} lists and ${cards} cards.`;
	}
	if (content.startsWith("mindmap:")) {
		const [, nodes = "0"] = content.split(":");
		return `Mindmap created with ${nodes} nodes.`;
	}
	if (content.startsWith("flowchart:")) {
		const [, nodes = "0", edges = "0"] = content.split(":");
		return `Flowchart created with ${nodes} nodes and ${edges} connectors.`;
	}
	if (content.startsWith("stickyNotes:")) {
		const [, notes = "0"] = content.split(":");
		return `Created ${notes} sticky notes.`;
	}
	if (content.startsWith("retrospective:")) {
		const [, sections = "0", notes = "0"] = content.split(":");
		return `Retrospective board created with ${sections} sections and ${notes} notes.`;
	}
	if (content.startsWith("swot:")) {
		const [, quadrants = "0", notes = "0"] = content.split(":");
		return `SWOT board created with ${quadrants} quadrants and ${notes} notes.`;
	}
	if (content.startsWith("frames:")) {
		const [, frames = "0"] = content.split(":");
		return `Created ${frames} frames.`;
	}
	if (content.startsWith("diagram:")) {
		const [, count = String(elementCount)] = content.split(":");
		return `Diagram created with ${count} elements.`;
	}
	return `Canvas updated with ${elementCount} elements.`;
}

/** Letzte Nachrichten als LLM-Kontext. */
export function toAiChatHistory(messages: AiChatMessage[]) {
	return messages
		.map((message) => {
			if (message.role === "assistant") {
				return {
					role: "assistant" as const,
					content: describeAssistantTurn(
						message.content,
						message.elementCount ?? 0,
					),
				};
			}

			return {
				role: message.role,
				content: message.content,
			};
		})
		.filter((message) => message.content.trim().length > 0);
}

export async function clearWhiteboardAiMessages(
	db: Database,
	whiteboardId: string,
	userId: string,
) {
	await db
		.delete(whiteboardAiMessages)
		.where(
			and(
				eq(whiteboardAiMessages.whiteboardId, whiteboardId),
				eq(whiteboardAiMessages.userId, userId),
			),
		);
}
