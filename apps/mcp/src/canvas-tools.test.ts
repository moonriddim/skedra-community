import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import * as Y from "yjs";
import { readPlainBoardState } from "./canvas-e2ee.js";
import type { SkedraApiClient } from "./client.js";
import { createSkedraMcpServer } from "./index.js";

const boardId = "11111111-1111-4111-8111-111111111111";
async function fixture(canvasBg = "") {
	const doc = new Y.Doc();
	doc.getMap("appStateMap").set("canvasBg", canvasBg);
	const updates = [
		{
			id: "background",
			clientId: "fixture",
			update: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
			createdAt: new Date().toISOString(),
		},
	];
	doc.destroy();
	const api = {
		getBoard: async () => ({
			board: { id: boardId, name: "Test", encryptionMode: "server" as const },
		}),
		listBoardUpdates: async () => ({ updates }),
		appendBoardUpdate: async (
			_id: string,
			body: { update: string; clientId: string },
		) => {
			const update = {
				...body,
				id: `update-${updates.length}`,
				createdAt: new Date().toISOString(),
			};
			updates.push(update);
			return update;
		},
	} as unknown as SkedraApiClient;
	const server = createSkedraMcpServer(() => api);
	const client = new Client({ name: "canvas-regression", version: "0.1.0" });
	const [left, right] = InMemoryTransport.createLinkedPair();
	await server.connect(right);
	await client.connect(left);
	return {
		state: () => readPlainBoardState(updates),
		call: async (name: string, args: Record<string, unknown>) => {
			const result = await client.callTool({
				name,
				arguments: { boardId, ...args },
			});
			assert.notEqual(result.isError, true, JSON.stringify(result));
			return result;
		},
		close: async () => {
			await client.close();
			await server.close();
		},
	};
}

test("MCP canvas tools add and edit paths while preserving unrelated content", async () => {
	const f = await fixture();
	try {
		await f.call("add_board_elements", {
			elements: [
				{
					type: "arrow",
					x: 0,
					y: 0,
					width: 120,
					height: 80,
					points: [
						[0, 0],
						[120, 80],
					],
				},
				{
					type: "text",
					x: 150,
					y: 0,
					width: 100,
					height: 30,
					text: "Unchanged",
				},
			],
		});
		const before = f.state().elements;
		const arrow = before.find((element) => element.type === "arrow");
		assert.ok(arrow);
		const untouched = before.find((element) => element.type === "text");
		await f.call("edit_board_elements", {
			edits: [
				{
					elementId: arrow.id,
					changes: {
						points: [
							[0, 0],
							[60, 40],
						],
						stroke: "#5eead4",
					},
				},
			],
		});
		const after = f.state().elements;
		assert.deepEqual(after.find((element) => element.id === arrow.id)?.points, [
			[0, 0],
			[60, 40],
		]);
		assert.deepEqual(
			after.find((element) => element.id === untouched?.id),
			untouched,
		);
	} finally {
		await f.close();
	}
});

test("MCP Kanban keeps an explicitly empty Done column empty", async () => {
	const f = await fixture();
	try {
		await f.call("create_kanban_board", {
			lists: [
				{ name: "To do", cards: ["Draft copy"] },
				{ name: "Done", cards: [] },
			],
		});
		const elements = f.state().elements;
		assert.equal(elements.length, 3);
		const done = elements.find((element) => element.frameLabel === "Done");
		assert.ok(done);
		assert.equal(
			elements.filter((element) => element.frameId === done.id).length,
			0,
		);
	} finally {
		await f.close();
	}
});

function luminance(color: string) {
	const channels = [1, 3, 5].map(
		(offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255,
	);
	const linear = channels.map((v) =>
		v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
	);
	return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(first: string, second: string) {
	const a = luminance(first);
	const b = luminance(second);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const canvasBg of ["", "#101814", "#ffffff"]) {
	test(`MCP sequence creation and later messages remain readable on ${canvasBg || "default dark"}`, async () => {
		const f = await fixture(canvasBg);
		try {
			await f.call("create_sequence_diagram", {
				source:
					"sequenceDiagram\nparticipant Browser\nparticipant API\nBrowser->>API: Login request",
			});
			const created = f.state();
			assert.equal(created.canvasBg, canvasBg);
			const diagramId = created.elements[0].customData?.sequenceDiagramId;
			await f.call("edit_sequence_diagram", {
				diagramId,
				action: {
					operation: "add_message",
					fromParticipantId: "API",
					toParticipantId: "Browser",
					label: "Session",
					kind: "return",
				},
			});
			const background = canvasBg || "#101814";
			for (const element of f.state().elements) {
				const role = element.customData?.sequenceRole;
				if (role === "message-label")
					assert.ok(
						contrast(element.textColor ?? element.stroke, background) >= 4.5,
						`${role}: text must be readable`,
					);
				if (role === "message")
					assert.ok(
						contrast(element.stroke, background) >= 3,
						"arrow contrast",
					);
				if (role === "participant")
					assert.ok(
						contrast(element.textColor ?? element.stroke, element.fill) >= 4.5,
						"participant contrast",
					);
				if (element.text)
					assert.equal(element.fontFamily, "system-ui, sans-serif");
			}
			assert.ok(
				f.state().elements.some((element) => element.text === "Session"),
			);
		} finally {
			await f.close();
		}
	});
}
