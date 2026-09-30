import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { SkedraApiClient } from "./client.js";
import { createSkedraMcpServer } from "./index.js";

test("MCP discovery declares tool risks and keeps board listing read-only", async () => {
	let clientInitializations = 0;
	let reads = 0;
	const api = new Proxy({} as SkedraApiClient, {
		get(_target, property) {
			assert.equal(property, "listBoards", "discovery/listing must not write");
			return async () => {
				reads++;
				return { boards: [{ id: "review-board", name: "Review fixture" }] };
			};
		},
	});
	const server = createSkedraMcpServer(() => {
		clientInitializations++;
		return api;
	});
	const client = new Client({ name: "skedra-plugin-review", version: "0.1.0" });
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	try {
		await server.connect(serverTransport);
		await client.connect(clientTransport);
		const { tools } = await client.listTools();
		assert.equal(tools.length, 23);
		function assertCompatibleArrayItems(value: unknown, path: string) {
			if (!value || typeof value !== "object") return;
			const schema = value as Record<string, unknown>;
			assert.equal(
				Array.isArray(schema.items),
				false,
				`${path}: Codex cannot parse tuple-style items`,
			);
			for (const [key, child] of Object.entries(schema)) {
				if (Array.isArray(child))
					child.forEach((item, index) =>
						assertCompatibleArrayItems(item, `${path}.${key}[${index}]`),
					);
				else assertCompatibleArrayItems(child, `${path}.${key}`);
			}
		}
		for (const tool of tools)
			assertCompatibleArrayItems(tool.inputSchema, tool.name);
		assert.equal(clientInitializations, 0, "discovery requires no API key");
		for (const tool of tools) {
			for (const hint of [
				"readOnlyHint",
				"openWorldHint",
				"destructiveHint",
			] as const) {
				assert.equal(typeof tool.annotations?.[hint], "boolean", tool.name);
			}
			if (tool.name.startsWith("list_") || tool.name.startsWith("get_")) {
				assert.equal(tool.annotations?.readOnlyHint, true, tool.name);
				assert.equal(tool.annotations?.destructiveHint, false, tool.name);
			} else {
				assert.equal(tool.annotations?.readOnlyHint, false, tool.name);
			}
			assert.equal(
				tool.annotations?.openWorldHint,
				tool.name === "invite_board_member",
				tool.name,
			);
		}
		for (const name of [
			"edit_gantt_chart",
			"edit_sequence_diagram",
			"permanent_delete_board",
		]) {
			assert.equal(
				tools.find((tool) => tool.name === name)?.annotations?.destructiveHint,
				true,
				name,
			);
		}
		assert.equal(
			tools.find((tool) => tool.name === "create_board")?.annotations
				?.destructiveHint,
			false,
		);
		const result = await client.callTool({
			name: "list_boards",
			arguments: {},
		});
		assert.equal(result.isError, undefined);
		assert.deepEqual(result.content, [
			{
				type: "text",
				text: JSON.stringify(
					{ boards: [{ id: "review-board", name: "Review fixture" }] },
					null,
					2,
				),
			},
		]);
		assert.equal(clientInitializations, 1);
		assert.equal(reads, 1);
	} finally {
		await client.close();
		await server.close();
	}
});
