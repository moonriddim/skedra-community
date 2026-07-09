/**
 * tRPC Router fuer API-Key Verwaltung (nur Session-Auth).
 */

import { skedraApiKeyScopes } from "@skedra/shared";
import { z } from "zod";
import {
	createUserApiKey,
	listUserApiKeys,
	revokeUserApiKey,
} from "../../lib/api-keys";
import { protectedProcedure, router } from "../init";

export const apiKeyRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		return listUserApiKeys(ctx.db, ctx.user.id);
	}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(80),
				/** Optional: Ablauf in Tagen */
				expiresInDays: z.number().min(1).max(365).optional(),
				scopes: z.array(z.enum(skedraApiKeyScopes)).min(1).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const expiresAt = input.expiresInDays
				? new Date(Date.now() + input.expiresInDays * 86_400_000)
				: null;

			return createUserApiKey(ctx.db, {
				userId: ctx.user.id,
				name: input.name,
				expiresAt,
				scopes: input.scopes,
			});
		}),

	revoke: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const success = await revokeUserApiKey(ctx.db, ctx.user.id, input.id);
			if (!success) {
				throw new Error("API Key nicht gefunden");
			}
			return { success: true };
		}),
});
