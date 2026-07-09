#!/usr/bin/env node
/**
 * Skedra MCP Server — verbindet Agents mit der Skedra Public API.
 *
 * Env:
 *   SKEDRA_API_URL  — z.B. http://localhost:3001/api/v1
 *   SKEDRA_API_KEY  — sked_… Key aus den Skedra-Einstellungen
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { type SkedraApiClient, createSkedraClientFromEnv } from "./client.js";

/** Lazy init — der Key wird erst beim ersten Tool-Aufruf benoetigt, nicht beim Prozessstart. */
let client: SkedraApiClient | null = null;

function getClient() {
	if (!client) {
		client = createSkedraClientFromEnv();
	}
	return client;
}

const server = new McpServer(
	{
		name: "skedra",
		version: "0.1.0",
	},
	{
		instructions:
			"Skedra Whiteboard MCP. Nutze list_boards zuerst, dann get_board_elements oder add_board_elements zum Zeichnen. API Keys erben User-Berechtigungen.",
	},
);

function textResult(data: unknown) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
	};
}

server.registerTool(
	"list_boards",
	{
		title: "Boards auflisten",
		description: "Listet alle aktiven Whiteboards des authentifizierten Users.",
		inputSchema: z.object({}),
	},
	async () => textResult(await getClient().listBoards()),
);

server.registerTool(
	"list_archived_boards",
	{
		title: "Archivierte Boards",
		description: "Listet Boards im Papierkorb.",
		inputSchema: z.object({}),
	},
	async () => textResult(await getClient().listArchivedBoards()),
);

server.registerTool(
	"create_board",
	{
		title: "Board erstellen",
		description: "Erstellt ein neues Whiteboard.",
		inputSchema: z.object({
			name: z.string().min(1).max(120).describe("Name des Boards"),
		}),
	},
	async ({ name }) => textResult(await getClient().createBoard(name)),
);

server.registerTool(
	"get_board",
	{
		title: "Board abrufen",
		description: "Gibt Metadaten eines Boards zurueck.",
		inputSchema: z.object({
			boardId: z.string().uuid(),
		}),
	},
	async ({ boardId }) => textResult(await getClient().getBoard(boardId)),
);

server.registerTool(
	"update_board",
	{
		title: "Board umbenennen",
		description: "Aendert den Namen eines Boards.",
		inputSchema: z.object({
			boardId: z.string().uuid(),
			name: z.string().min(1).max(120),
		}),
	},
	async ({ boardId, name }) =>
		textResult(await getClient().updateBoard(boardId, name)),
);

server.registerTool(
	"archive_board",
	{
		title: "Board archivieren",
		description: "Verschiebt ein Board in den Papierkorb.",
		inputSchema: z.object({ boardId: z.string().uuid() }),
	},
	async ({ boardId }) => textResult(await getClient().archiveBoard(boardId)),
);

server.registerTool(
	"restore_board",
	{
		title: "Board wiederherstellen",
		description: "Stellt ein archiviertes Board wieder her.",
		inputSchema: z.object({ boardId: z.string().uuid() }),
	},
	async ({ boardId }) => textResult(await getClient().restoreBoard(boardId)),
);

server.registerTool(
	"permanent_delete_board",
	{
		title: "Board endgueltig loeschen",
		description:
			"Loescht ein archiviertes Board unwiderruflich (Papierkorb). Erfordert boards:delete Scope.",
		inputSchema: z.object({ boardId: z.string().uuid() }),
	},
	async ({ boardId }) =>
		textResult(await getClient().permanentDeleteBoard(boardId)),
);

server.registerTool(
	"get_board_elements",
	{
		title: "Canvas-Elemente lesen",
		description: "Liest alle Shapes/Texte eines Boards als JSON.",
		inputSchema: z.object({ boardId: z.string().uuid() }),
	},
	async ({ boardId }) =>
		textResult(await getClient().getBoardElements(boardId)),
);

server.registerTool(
	"add_board_elements",
	{
		title: "Canvas-Elemente hinzufuegen",
		description:
			"Fuegt Shapes/Texte zu einem Board hinzu. Jedes Element braucht type, x, y, width, height.",
		inputSchema: z.object({
			boardId: z.string().uuid(),
			elements: z
				.array(
					z
						.object({
							type: z.enum([
								"rectangle",
								"ellipse",
								"diamond",
								"line",
								"arrow",
								"image",
								"text",
								"freehand",
								"frame",
							]),
							x: z.number(),
							y: z.number(),
							width: z.number(),
							height: z.number(),
							text: z.string().optional(),
							fill: z.string().optional(),
							stroke: z.string().optional(),
						})
						.passthrough(),
				)
				.min(1)
				.max(100),
		}),
	},
	async ({ boardId, elements }) =>
		textResult(await getClient().addBoardElements(boardId, elements)),
);

server.registerTool(
	"update_board_element",
	{
		title: "Canvas-Element aktualisieren",
		description:
			"Aktualisiert Position, Groesse, Text oder Stil eines Elements.",
		inputSchema: z.object({
			boardId: z.string().uuid(),
			elementId: z.string().min(1),
			updates: z
				.record(z.unknown())
				.describe("Felder zum Patchen, z.B. x, y, text, fill"),
		}),
	},
	async ({ boardId, elementId, updates }) =>
		textResult(
			await getClient().updateBoardElement(boardId, elementId, updates),
		),
);

server.registerTool(
	"delete_board_element",
	{
		title: "Canvas-Element loeschen",
		description: "Entfernt ein Element vom Board.",
		inputSchema: z.object({
			boardId: z.string().uuid(),
			elementId: z.string().min(1),
		}),
	},
	async ({ boardId, elementId }) =>
		textResult(await getClient().deleteBoardElement(boardId, elementId)),
);

server.registerTool(
	"invite_board_member",
	{
		title: "Mitglied einladen",
		description: "Laedt einen registrierten User per E-Mail zum Board ein.",
		inputSchema: z.object({
			boardId: z.string().uuid(),
			email: z.string().email(),
		}),
	},
	async ({ boardId, email }) =>
		textResult(await getClient().inviteMember(boardId, email)),
);

server.registerTool(
	"list_activity",
	{
		title: "Aktivitaeten",
		description: "Letzte Aktivitaeten ueber alle Boards.",
		inputSchema: z.object({
			limit: z.number().min(1).max(100).optional(),
		}),
	},
	async ({ limit }) => textResult(await getClient().listActivity(limit ?? 30)),
);

server.registerTool(
	"list_board_activity",
	{
		title: "Board-Aktivitaeten",
		description: "Aktivitaeten fuer ein bestimmtes Board.",
		inputSchema: z.object({
			boardId: z.string().uuid(),
			limit: z.number().min(1).max(100).optional(),
		}),
	},
	async ({ boardId, limit }) =>
		textResult(await getClient().listBoardActivity(boardId, limit ?? 50)),
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((error) => {
	console.error("[skedra-mcp]", error);
	process.exit(1);
});
