import { type Database, boardIntegrationSyncs, whiteboards } from "@skedra/db";
import { decryptText, encryptText } from "@skedra/shared/server-crypto";
import { eq } from "drizzle-orm";
import { env } from "../env";
import { createEmbedShareToken } from "./collab-share";

type IntegrationSync = typeof boardIntegrationSyncs.$inferSelect;

interface IntegrationPayload {
	boardName: string;
	boardUrl: string;
	embedUrl: string;
	iframe: string;
	markdown: string;
	syncedAt: string;
}

interface NotionConfig {
	headingBlockId?: string;
	embedBlockId?: string;
	noteBlockId?: string;
}

interface ObsidianConfig {
	endpointUrl?: string;
}

function getIntegrationCryptoOptions() {
	return {
		secret: env.DATA_ENCRYPTION_SECRET ?? env.AUTH_SECRET,
		purpose: "integration-sync-secret",
	};
}

export function encryptIntegrationSecret(secret: string) {
	return encryptText(secret, getIntegrationCryptoOptions());
}

function decryptIntegrationSecret(encrypted: string | null) {
	if (!encrypted) return "";
	return decryptText(encrypted, getIntegrationCryptoOptions());
}

function parseConfig<T>(value: string): T {
	try {
		const parsed = JSON.parse(value);
		return typeof parsed === "object" && parsed != null
			? (parsed as T)
			: ({} as T);
	} catch {
		return {} as T;
	}
}

function normalizeAppUrl() {
	return env.APP_URL.replace(/\/$/u, "");
}

async function ensureEmbedShare(db: Database, whiteboardId: string) {
	const board = await db.query.whiteboards.findFirst({
		where: eq(whiteboards.id, whiteboardId),
	});
	if (!board) throw new Error("BOARD_NOT_FOUND");
	if (board.embedShareEnabled && board.embedShareToken) return board;

	const [updated] = await db
		.update(whiteboards)
		.set({
			embedShareEnabled: true,
			embedShareToken: board.embedShareToken ?? createEmbedShareToken(),
			updatedAt: new Date(),
		})
		.where(eq(whiteboards.id, whiteboardId))
		.returning();
	if (!updated) throw new Error("BOARD_NOT_FOUND");
	return updated;
}

async function buildIntegrationPayload(
	db: Database,
	sync: IntegrationSync,
): Promise<IntegrationPayload> {
	const board = await ensureEmbedShare(db, sync.whiteboardId);
	const appUrl = normalizeAppUrl();
	const boardUrl = `${appUrl}/board/${board.id}`;
	const embedUrl = `${appUrl}/embed/${board.embedShareToken}`;
	const iframe = `<iframe src="${embedUrl}" title="${board.name}" width="100%" height="640" loading="lazy" allowfullscreen></iframe>`;
	const syncedAt = new Date().toISOString();
	const markdown = [
		`# ${board.name}`,
		"",
		`[Open in Skedra](${boardUrl})`,
		"",
		iframe,
		"",
		`Synced from Skedra at ${syncedAt}.`,
	].join("\n");

	return {
		boardName: board.name,
		boardUrl,
		embedUrl,
		iframe,
		markdown,
		syncedAt,
	};
}

async function notionRequest(
	token: string,
	path: string,
	options: { method: "PATCH"; body: unknown },
) {
	const response = await fetch(`https://api.notion.com/v1${path}`, {
		method: options.method,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			"Notion-Version": "2022-06-28",
		},
		body: JSON.stringify(options.body),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(`NOTION_${response.status}:${text.slice(0, 300)}`);
	}
	return response.json() as Promise<unknown>;
}

async function appendNotionBlocks(
	token: string,
	pageOrBlockId: string,
	payload: IntegrationPayload,
) {
	const response = (await notionRequest(
		token,
		`/blocks/${pageOrBlockId}/children`,
		{
			method: "PATCH",
			body: {
				children: [
					{
						object: "block",
						type: "heading_2",
						heading_2: {
							rich_text: [
								{
									type: "text",
									text: { content: `Skedra: ${payload.boardName}` },
								},
							],
						},
					},
					{
						object: "block",
						type: "embed",
						embed: { url: payload.embedUrl },
					},
					{
						object: "block",
						type: "paragraph",
						paragraph: {
							rich_text: [
								{
									type: "text",
									text: {
										content: `Open board: ${payload.boardUrl}\nLast synced: ${payload.syncedAt}`,
										link: { url: payload.boardUrl },
									},
								},
							],
						},
					},
				],
			},
		},
	)) as { results?: Array<{ id?: string; type?: string }> };

	const headingBlockId = response.results?.[0]?.id;
	const embedBlockId = response.results?.[1]?.id;
	const noteBlockId = response.results?.[2]?.id;
	return { headingBlockId, embedBlockId, noteBlockId } satisfies NotionConfig;
}

async function updateNotionBlocks(
	token: string,
	config: NotionConfig,
	payload: IntegrationPayload,
) {
	if (!config.headingBlockId || !config.embedBlockId || !config.noteBlockId) {
		return false;
	}

	await notionRequest(token, `/blocks/${config.headingBlockId}`, {
		method: "PATCH",
		body: {
			heading_2: {
				rich_text: [
					{ type: "text", text: { content: `Skedra: ${payload.boardName}` } },
				],
			},
		},
	});
	await notionRequest(token, `/blocks/${config.embedBlockId}`, {
		method: "PATCH",
		body: { embed: { url: payload.embedUrl } },
	});
	await notionRequest(token, `/blocks/${config.noteBlockId}`, {
		method: "PATCH",
		body: {
			paragraph: {
				rich_text: [
					{
						type: "text",
						text: {
							content: `Open board: ${payload.boardUrl}\nLast synced: ${payload.syncedAt}`,
							link: { url: payload.boardUrl },
						},
					},
				],
			},
		},
	});
	return true;
}

async function syncNotion(sync: IntegrationSync, payload: IntegrationPayload) {
	const token = decryptIntegrationSecret(sync.encryptedSecret);
	if (!token) throw new Error("NOTION_TOKEN_MISSING");
	const config = parseConfig<NotionConfig>(sync.config);

	try {
		const updated = await updateNotionBlocks(token, config, payload);
		if (updated) return config;
	} catch {
		// If the target blocks were deleted or changed in Notion, append fresh blocks.
	}

	return appendNotionBlocks(token, sync.target, payload);
}

function encodeVaultPath(path: string) {
	return path
		.split("/")
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}

async function syncObsidian(
	sync: IntegrationSync,
	payload: IntegrationPayload,
) {
	const config = parseConfig<ObsidianConfig>(sync.config);
	const endpoint = (config.endpointUrl || "http://127.0.0.1:27123").replace(
		/\/$/u,
		"",
	);
	const apiKey = decryptIntegrationSecret(sync.encryptedSecret);
	const response = await fetch(
		`${endpoint}/vault/${encodeVaultPath(sync.target)}`,
		{
			method: "PUT",
			headers: {
				"Content-Type": "text/markdown; charset=utf-8",
				...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
			},
			body: payload.markdown,
		},
	);

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(`OBSIDIAN_${response.status}:${text.slice(0, 300)}`);
	}

	return config;
}

export async function runBoardIntegrationSync(
	db: Database,
	sync: IntegrationSync,
) {
	const payload = await buildIntegrationPayload(db, sync);
	const nextConfig =
		sync.provider === "notion"
			? await syncNotion(sync, payload)
			: await syncObsidian(sync, payload);

	const [updated] = await db
		.update(boardIntegrationSyncs)
		.set({
			config: JSON.stringify(nextConfig),
			lastSyncedAt: new Date(),
			lastSyncError: null,
			updatedAt: new Date(),
		})
		.where(eq(boardIntegrationSyncs.id, sync.id))
		.returning();

	return updated;
}

export async function markBoardIntegrationSyncFailed(
	db: Database,
	syncId: string,
	error: unknown,
) {
	const message = error instanceof Error ? error.message : "UNKNOWN_SYNC_ERROR";
	const [updated] = await db
		.update(boardIntegrationSyncs)
		.set({
			lastSyncError: message.slice(0, 1000),
			updatedAt: new Date(),
		})
		.where(eq(boardIntegrationSyncs.id, syncId))
		.returning();
	return updated;
}
