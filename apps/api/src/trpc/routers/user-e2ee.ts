import { accounts, userE2eeIdentities } from "@skedra/db";
import { TRPCError } from "@trpc/server";
import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Context } from "../context";
import { protectedProcedure, router } from "../init";

const keyMaterialSchema = z.string().min(1).max(50_000);
type AuthenticatedContext = Context & {
	user: NonNullable<Context["user"]>;
	session: NonNullable<Context["session"]>;
};

async function assertAccountPassword(
	ctx: AuthenticatedContext,
	password: string | undefined,
) {
	if (!password) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Account password is required to save an E2EE identity",
		});
	}

	const credentialAccount = await ctx.db.query.accounts.findFirst({
		where: and(
			eq(accounts.userId, ctx.user.id),
			eq(accounts.providerId, "credential"),
		),
		columns: { password: true },
	});

	if (
		!credentialAccount?.password ||
		!(await verifyPassword({ hash: credentialAccount.password, password }))
	) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Account password is invalid",
		});
	}
}

export const userE2eeRouter = router({
	getIdentity: protectedProcedure.query(async ({ ctx }) => {
		const identity = await ctx.db.query.userE2eeIdentities.findFirst({
			where: eq(userE2eeIdentities.userId, ctx.user.id),
			columns: {
				publicKey: true,
				encryptedPrivateKey: true,
				createdAt: true,
				updatedAt: true,
			},
		});
		return identity ?? null;
	}),

	saveIdentity: protectedProcedure
		.input(
			z.object({
				publicKey: keyMaterialSchema,
				encryptedPrivateKey: keyMaterialSchema,
				accountPassword: z.string().min(1).max(500).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.query.userE2eeIdentities.findFirst({
				where: eq(userE2eeIdentities.userId, ctx.user.id),
				columns: {
					publicKey: true,
					encryptedPrivateKey: true,
					createdAt: true,
					updatedAt: true,
				},
			});

			if (existing && existing.publicKey !== input.publicKey) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "E2EE identity already exists for this user",
				});
			}

			if (existing) {
				if (existing.encryptedPrivateKey === input.encryptedPrivateKey) {
					return existing;
				}

				await assertAccountPassword(ctx, input.accountPassword);

				const [updated] = await ctx.db
					.update(userE2eeIdentities)
					.set({
						encryptedPrivateKey: input.encryptedPrivateKey,
						updatedAt: new Date(),
					})
					.where(eq(userE2eeIdentities.userId, ctx.user.id))
					.returning({
						publicKey: userE2eeIdentities.publicKey,
						encryptedPrivateKey: userE2eeIdentities.encryptedPrivateKey,
						createdAt: userE2eeIdentities.createdAt,
						updatedAt: userE2eeIdentities.updatedAt,
					});
				if (!updated) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "E2EE identity could not be updated",
					});
				}
				return updated;
			}

			await assertAccountPassword(ctx, input.accountPassword);

			const [identity] = await ctx.db
				.insert(userE2eeIdentities)
				.values({
					userId: ctx.user.id,
					publicKey: input.publicKey,
					encryptedPrivateKey: input.encryptedPrivateKey,
				})
				.onConflictDoNothing()
				.returning({
					publicKey: userE2eeIdentities.publicKey,
					encryptedPrivateKey: userE2eeIdentities.encryptedPrivateKey,
					createdAt: userE2eeIdentities.createdAt,
					updatedAt: userE2eeIdentities.updatedAt,
				});

			if (!identity) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "E2EE identity was created by another session",
				});
			}

			return identity;
		}),
});
