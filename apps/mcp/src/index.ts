#!/usr/bin/env node
/**
 * Skedra MCP Server — verbindet Agents mit der Skedra Public API.
 *
 * Env:
 *   SKEDRA_API_URL  — z.B. http://localhost:3001/api/v1
 *   SKEDRA_API_KEY  — sked_… Key aus den Skedra-Einstellungen
 */

import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	type CanvasElement,
	createBaseCanvasElement,
	createKanbanBoardElements,
} from "@skedra/canvas-core";
import { z } from "zod";
import {
	type EncryptedBoardUpdate,
	createPlainElementsUpdate,
	decryptBoardState,
	encryptElementsUpdate,
	readPlainBoardState,
} from "./canvas-e2ee.js";
import { type SkedraApiClient, createSkedraClientFromEnv } from "./client.js";

/** Factory-Defaults für Canvas-Elemente aus dem MCP (eigene IDs, neutraler Stroke). */
const elementDefaults = {
	createId: () => randomUUID(),
	stroke: "#1e1e1e",
};

/**
 * Baut die Elemente, verschlüsselt sie mit dem Board-Schlüssel und hängt sie als
 * Update ans Board an. Der Server sieht nur Ciphertext; die Änderung erscheint
 * dank Live-Bus sofort bei allen verbundenen Web-Clients.
 */
async function pushEncryptedElements(
	client: SkedraApiClient,
	boardId: string,
	e2eeKey: string,
	elements: CanvasElement[],
) {
	const { update, keyHash } = encryptElementsUpdate(elements, e2eeKey);
	const result = await client.appendBoardUpdate(boardId, {
		clientId: `mcp-${randomUUID()}`,
		keyHash,
		update,
	});
	return { added: elements.length, updateId: result.id };
}

async function pushBoardElements(
	client: SkedraApiClient,
	boardId: string,
	e2eeKey: string | undefined,
	elements: CanvasElement[],
) {
	const { board } = await client.getBoard(boardId);
	if (board.encryptionMode === "server") {
		const result = await client.appendBoardUpdate(boardId, {
			clientId: `mcp-${randomUUID()}`,
			update: createPlainElementsUpdate(elements),
		});
		return {
			added: elements.length,
			updateId: result.id,
			encryptionMode: "server" as const,
		};
	}
	if (!e2eeKey) {
		throw new Error(
			"Dieses Board ist E2EE-verschlüsselt. Übergib den e2eeKey aus Skedra.",
		);
	}
	return {
		...(await pushEncryptedElements(client, boardId, e2eeKey, elements)),
		encryptionMode: "e2ee" as const,
	};
}

const UPDATE_PAGE_SIZE = 1000;

async function loadEncryptedBoardUpdates(
	client: SkedraApiClient,
	boardId: string,
): Promise<EncryptedBoardUpdate[]> {
	const updates: EncryptedBoardUpdate[] = [];
	let afterId: string | undefined;
	let afterCreatedAt: string | undefined;

	for (;;) {
		const page = await client.listBoardUpdates(boardId, {
			afterId,
			afterCreatedAt,
			limit: UPDATE_PAGE_SIZE,
		});
		updates.push(...page.updates);

		if (page.updates.length < UPDATE_PAGE_SIZE) break;
		const last = page.updates.at(-1);
		if (!last) break;
		afterId = last.id;
		afterCreatedAt = last.createdAt;
	}

	return updates;
}

async function readBoardState(
	client: SkedraApiClient,
	boardId: string,
	e2eeKey?: string,
) {
	const [{ board }, updates] = await Promise.all([
		client.getBoard(boardId),
		loadEncryptedBoardUpdates(client, boardId),
	]);
	if (board.encryptionMode === "e2ee" && !e2eeKey) {
		throw new Error(
			"Dieses Board ist E2EE-verschlüsselt. Übergib den e2eeKey aus Skedra.",
		);
	}
	const state =
		board.encryptionMode === "server"
			? readPlainBoardState(updates)
			: decryptBoardState(updates, e2eeKey as string);
	const lastUpdate = updates.at(-1);
	return {
		boardId,
		encryptionMode: board.encryptionMode,
		updateCount: updates.length,
		appliedUpdates: state.appliedUpdates,
		cursor: lastUpdate
			? { id: lastUpdate.id, createdAt: lastUpdate.createdAt }
			: null,
		elements: state.elements,
		views: state.views,
	};
}

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
			"Skedra Whiteboard MCP. Nutze list_boards zuerst. Serverseitig verschlüsselte Boards funktionieren automatisch mit API-Key und Board-Berechtigung. Nur E2EE-Boards benötigen zusätzlich den e2eeKey aus Skedra. Alle Änderungen erscheinen sofort live.",
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
		description:
			"Erstellt ein Skedra-Whiteboard. Serverseitige Verschlüsselung funktioniert automatisch; E2EE gibt zusätzlich einen clientseitigen Key zurück.",
		inputSchema: z.object({
			name: z.string().min(1).max(120).describe("Name des Boards"),
			encryptionMode: z.enum(["server", "e2ee"]).default("server"),
		}),
	},
	async ({ name, encryptionMode }) =>
		textResult(await getClient().createBoard(name, encryptionMode)),
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
	"get_board_canvas_state",
	{
		title: "Canvas-Zustand lesen",
		description:
			"Liest Canvas-Elemente und Views. Serverseitig verschlüsselte Boards funktionieren automatisch; E2EE-Boards benötigen den e2eeKey.",
		inputSchema: z.object({
			boardId: z.string().uuid(),
			e2eeKey: z
				.string()
				.min(20)
				.optional()
				.describe(
					"Board-Schlüssel aus #skedraKey der Board-URL oder aus create_board.",
				),
		}),
	},
	async ({ boardId, e2eeKey }) =>
		textResult(await readBoardState(getClient(), boardId, e2eeKey)),
);

server.registerTool(
	"update_board",
	{
		title: "Board umbenennen",
		description: "Ändert den Namen eines Boards.",
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

// Realtime-E2EE-Schreibpfad: Elemente werden im MCP verschlüsselt (canvas-e2ee.ts)
// und über POST /boards/:id/updates angehängt. Der Server sieht nur Ciphertext; die
// Änderung erscheint dank Live-Bus sofort bei allen Web-Clients. Der Agent muss den
// E2EE-Schlüssel (#skedraKey aus der Board-URL) übergeben; create_board liefert ihn.

const elementInputSchema = z.object({
	type: z.enum([
		"rectangle",
		"ellipse",
		"diamond",
		"line",
		"arrow",
		"text",
		"frame",
	]),
	x: z.number(),
	y: z.number(),
	width: z.number().positive(),
	height: z.number().positive(),
	text: z.string().optional(),
	fill: z.string().optional(),
	stroke: z.string().optional(),
});

server.registerTool(
	"add_board_elements",
	{
		title: "Canvas-Elemente hinzufügen",
		description:
			"Fügt Shapes und Texte hinzu. Serverseitig verschlüsselte Boards funktionieren automatisch; E2EE-Boards benötigen den e2eeKey. Erscheint sofort live.",
		inputSchema: z.object({
			boardId: z.string().uuid(),
			e2eeKey: z.string().min(20).optional(),
			elements: z.array(elementInputSchema).min(1).max(100),
		}),
	},
	async ({ boardId, e2eeKey, elements }) => {
		const built = elements.map((el) =>
			createBaseCanvasElement(elementDefaults, {
				type: el.type,
				x: el.x,
				y: el.y,
				width: el.width,
				height: el.height,
				...(el.text !== undefined ? { text: el.text } : {}),
				...(el.fill !== undefined ? { fill: el.fill } : {}),
				...(el.stroke !== undefined ? { stroke: el.stroke } : {}),
			}),
		);
		return textResult(
			await pushBoardElements(getClient(), boardId, e2eeKey, built),
		);
	},
);

server.registerTool(
	"create_kanban_board",
	{
		title: "Kanban-Board erzeugen",
		description:
			"Erzeugt ein Kanban-Board. Serverseitig verschlüsselte Boards funktionieren automatisch; E2EE-Boards benötigen den e2eeKey. Erscheint sofort live.",
		inputSchema: z.object({
			boardId: z.string().uuid(),
			e2eeKey: z.string().min(20).optional(),
			x: z.number().optional(),
			y: z.number().optional(),
			lists: z
				.array(
					z.object({
						name: z.string().min(1),
						cards: z.array(z.string()).default([]),
					}),
				)
				.min(1)
				.max(12),
		}),
	},
	async ({ boardId, e2eeKey, x, y, lists }) => {
		const built = createKanbanBoardElements(elementDefaults, {
			x: x ?? 100,
			y: y ?? 100,
			lists: lists.map((list) => ({ name: list.name, cards: list.cards })),
			defaultCardTitle: "Neue Karte",
		});
		return textResult(
			await pushBoardElements(getClient(), boardId, e2eeKey, built),
		);
	},
);

server.registerTool(
	"list_board_team_roles",
	{
		title: "Board-Team-Rollen",
		description:
			"Listet Team-Rollen, die fuer direkte Board-Einladungen verwendet werden koennen.",
		inputSchema: z.object({
			boardId: z.string().uuid(),
		}),
	},
	async ({ boardId }) =>
		textResult(await getClient().listBoardTeamRoles(boardId)),
);

server.registerTool(
	"invite_board_member",
	{
		title: "Mitglied einladen",
		description:
			"Laedt einen registrierten User per E-Mail zum Board ein. Nutze vorher list_board_team_roles und uebergib die gewuenschte roleId.",
		inputSchema: z.object({
			boardId: z.string().uuid(),
			email: z.string().email(),
			roleId: z.string().uuid(),
		}),
	},
	async ({ boardId, email, roleId }) =>
		textResult(await getClient().inviteMember(boardId, email, roleId)),
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
