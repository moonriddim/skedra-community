import { accounts, sessions, userE2eeIdentities } from "@skedra/db";
import { TRPCError } from "@trpc/server";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { auth } from "../../lib/auth";
import { authenticatedProcedure, router } from "../init";

const passwordSchema = z.string().min(8).max(128);
const encryptedIdentitySchema = z.string().min(1).max(50_000);

export const accountRouter = router({
	setPassword: authenticatedProcedure
		.input(z.object({ newPassword: passwordSchema }))
		.mutation(async ({ ctx, input }) => {
			return auth.api.setPassword({
				body: { newPassword: input.newPassword },
				headers: ctx.headers,
			});
		}),

	changePassword: authenticatedProcedure
		.input(
			z.object({
				currentPassword: z.string().min(1).max(500),
				newPassword: passwordSchema,
				newEncryptedPrivateKey: encryptedIdentitySchema.optional(),
				revokeOtherSessions: z.boolean().default(true),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const credentialAccount = await ctx.db.query.accounts.findFirst({
				where: and(
					eq(accounts.userId, ctx.user.id),
					eq(accounts.providerId, "credential"),
				),
				columns: { id: true, password: true },
			});

			if (
				!credentialAccount?.password ||
				!(await verifyPassword({
					hash: credentialAccount.password,
					password: input.currentPassword,
				}))
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "Das aktuelle Passwort ist nicht korrekt.",
				});
			}

			const identity = await ctx.db.query.userE2eeIdentities.findFirst({
				where: eq(userE2eeIdentities.userId, ctx.user.id),
				columns: { userId: true },
			});
			if (identity && !input.newEncryptedPrivateKey) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Die verschlüsselte E2EE-Identity muss zusammen mit dem Passwort aktualisiert werden.",
				});
			}

			const passwordHash = await hashPassword(input.newPassword);
			await ctx.db.transaction(async (tx) => {
				await tx
					.update(accounts)
					.set({ password: passwordHash, updatedAt: new Date() })
					.where(eq(accounts.id, credentialAccount.id));

				if (identity && input.newEncryptedPrivateKey) {
					await tx
						.update(userE2eeIdentities)
						.set({
							encryptedPrivateKey: input.newEncryptedPrivateKey,
							updatedAt: new Date(),
						})
						.where(eq(userE2eeIdentities.userId, ctx.user.id));
				}

				if (input.revokeOtherSessions) {
					await tx
						.delete(sessions)
						.where(
							and(
								eq(sessions.userId, ctx.user.id),
								ne(sessions.token, ctx.session.token),
							),
						);
				}
			});

			return { status: true };
		}),
});
