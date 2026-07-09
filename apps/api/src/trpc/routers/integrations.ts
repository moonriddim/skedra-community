import { type Database, boardIntegrationSyncs } from "@skedra/db";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
	encryptIntegrationSecret,
	markBoardIntegrationSyncFailed,
	runBoardIntegrationSync,
} from "../../lib/integration-sync";
import { requireBoardManageShare } from "../../lib/permissions";
import { protectedProcedure, router } from "../init";

const providerSchema = z.enum(["notion", "obsidian"]);

function safeJson(value: string) {
	try {
		return JSON.parse(value) as Record<string, unknown>;
	} catch {
		return {};
	}
}

function serializeSync(row: typeof boardIntegrationSyncs.$inferSelect) {
	const config = safeJson(row.config);
	return {
		id: row.id,
		whiteboardId: row.whiteboardId,
		provider: row.provider,
		enabled: row.enabled,
		target: row.target,
		config,
		hasSecret: !!row.encryptedSecret,
		lastSyncedAt: row.lastSyncedAt,
		lastSyncError: row.lastSyncError,
		updatedAt: row.updatedAt,
	};
}

async function getUserSync(
	ctx: { db: Database; user: { id: string } },
	input: { whiteboardId: string; provider: "notion" | "obsidian" },
) {
	return ctx.db.query.boardIntegrationSyncs.findFirst({
		where: and(
			eq(boardIntegrationSyncs.whiteboardId, input.whiteboardId),
			eq(boardIntegrationSyncs.userId, ctx.user.id),
			eq(boardIntegrationSyncs.provider, input.provider),
		),
	});
}

export const integrationsRouter = router({
	listBoard: protectedProcedure
		.input(z.object({ whiteboardId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			await requireBoardManageShare(ctx, input.whiteboardId);
			const rows = await ctx.db.query.boardIntegrationSyncs.findMany({
				where: and(
					eq(boardIntegrationSyncs.whiteboardId, input.whiteboardId),
					eq(boardIntegrationSyncs.userId, ctx.user.id),
				),
			});
			return rows.map(serializeSync);
		}),

	saveNotion: protectedProcedure
		.input(
			z.object({
				whiteboardId: z.string().uuid(),
				pageOrBlockId: z.string().min(1).max(200),
				integrationToken: z.string().min(1).max(500).optional(),
				enabled: z.boolean().default(true),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requireBoardManageShare(ctx, input.whiteboardId);
			const existing = await getUserSync(ctx, {
				whiteboardId: input.whiteboardId,
				provider: "notion",
			});
			if (!existing && !input.integrationToken) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Notion integration token is required.",
				});
			}

			const values = {
				whiteboardId: input.whiteboardId,
				userId: ctx.user.id,
				provider: "notion" as const,
				enabled: input.enabled,
				target: input.pageOrBlockId.trim(),
				config: existing?.config ?? "{}",
				encryptedSecret: input.integrationToken
					? encryptIntegrationSecret(input.integrationToken)
					: existing?.encryptedSecret,
				lastSyncError: null,
				updatedAt: new Date(),
			};

			const [row] = await ctx.db
				.insert(boardIntegrationSyncs)
				.values(values)
				.onConflictDoUpdate({
					target: [
						boardIntegrationSyncs.whiteboardId,
						boardIntegrationSyncs.userId,
						boardIntegrationSyncs.provider,
					],
					set: values,
				})
				.returning();

			return serializeSync(row);
		}),

	saveObsidian: protectedProcedure
		.input(
			z.object({
				whiteboardId: z.string().uuid(),
				endpointUrl: z.string().url().max(500),
				vaultPath: z.string().min(1).max(300),
				apiKey: z.string().max(500).optional(),
				enabled: z.boolean().default(true),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requireBoardManageShare(ctx, input.whiteboardId);
			const existing = await getUserSync(ctx, {
				whiteboardId: input.whiteboardId,
				provider: "obsidian",
			});
			const config = {
				...safeJson(existing?.config ?? "{}"),
				endpointUrl: input.endpointUrl.replace(/\/$/u, ""),
			};
			const values = {
				whiteboardId: input.whiteboardId,
				userId: ctx.user.id,
				provider: "obsidian" as const,
				enabled: input.enabled,
				target: input.vaultPath.trim(),
				config: JSON.stringify(config),
				encryptedSecret: input.apiKey
					? encryptIntegrationSecret(input.apiKey)
					: existing?.encryptedSecret,
				lastSyncError: null,
				updatedAt: new Date(),
			};

			const [row] = await ctx.db
				.insert(boardIntegrationSyncs)
				.values(values)
				.onConflictDoUpdate({
					target: [
						boardIntegrationSyncs.whiteboardId,
						boardIntegrationSyncs.userId,
						boardIntegrationSyncs.provider,
					],
					set: values,
				})
				.returning();

			return serializeSync(row);
		}),

	syncNow: protectedProcedure
		.input(
			z.object({
				whiteboardId: z.string().uuid(),
				provider: providerSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requireBoardManageShare(ctx, input.whiteboardId);
			const row = await getUserSync(ctx, input);
			if (!row || !row.enabled) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Integration is not configured.",
				});
			}

			try {
				return serializeSync(await runBoardIntegrationSync(ctx.db, row));
			} catch (error) {
				const failed = await markBoardIntegrationSyncFailed(
					ctx.db,
					row.id,
					error,
				);
				if (failed) return serializeSync(failed);
				throw error;
			}
		}),
});
