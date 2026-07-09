/**
 * Benutzer-Einstellungen (E-Mail-Benachrichtigungen).
 */

import { userPreferences } from "@skedra/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../init";

export const userPreferencesRouter = router({
	get: protectedProcedure.query(async ({ ctx }) => {
		const existing = await ctx.db.query.userPreferences.findFirst({
			where: eq(userPreferences.userId, ctx.user.id),
		});

		return (
			existing ?? {
				userId: ctx.user.id,
				emailOnMention: true,
				emailOnCommentReply: true,
			}
		);
	}),

	update: protectedProcedure
		.input(
			z.object({
				emailOnMention: z.boolean().optional(),
				emailOnCommentReply: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.query.userPreferences.findFirst({
				where: eq(userPreferences.userId, ctx.user.id),
			});

			if (existing) {
				const [updated] = await ctx.db
					.update(userPreferences)
					.set({
						emailOnMention: input.emailOnMention ?? existing.emailOnMention,
						emailOnCommentReply:
							input.emailOnCommentReply ?? existing.emailOnCommentReply,
						updatedAt: new Date(),
					})
					.where(eq(userPreferences.userId, ctx.user.id))
					.returning();
				return updated;
			}

			const [created] = await ctx.db
				.insert(userPreferences)
				.values({
					userId: ctx.user.id,
					emailOnMention: input.emailOnMention ?? true,
					emailOnCommentReply: input.emailOnCommentReply ?? true,
				})
				.returning();

			return created;
		}),
});
