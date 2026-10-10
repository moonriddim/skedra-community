/**
 * tRPC Router fuer per OAuth verbundene MCP-Anwendungen (nur Session-Auth).
 * Bewusst ohne Abo-Pruefung: Widerrufen muss auch ohne aktiven Zugang gehen.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { listMcpConnections, revokeMcpConnection } from "../../lib/mcp-oauth";
import { authenticatedProcedure, router } from "../init";

export const mcpConnectionRouter = router({
	list: authenticatedProcedure.query(async ({ ctx }) => {
		return listMcpConnections(ctx.db, ctx.user.id);
	}),

	revoke: authenticatedProcedure
		.input(z.object({ clientId: z.string().min(1).max(200) }))
		.mutation(async ({ ctx, input }) => {
			const revoked = await revokeMcpConnection(
				ctx.db,
				ctx.user.id,
				input.clientId,
			);
			if (!revoked) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Verbindung nicht gefunden",
				});
			}
			return { success: true };
		}),
});
