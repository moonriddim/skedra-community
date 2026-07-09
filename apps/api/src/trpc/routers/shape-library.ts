/**
 * Published and submitted shape libraries.
 */

import { personalShapeLibraries } from "@skedra/db";
import {
	SKEDRA_LIB_TYPE,
	SKEDRA_LIB_VERSION,
	type SkedraLibraryFile,
	personalShapeLibraryStateSchema,
	skedraLibrarySchema,
} from "@skedra/shared";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireInstanceAdmin } from "../../lib/instance-settings";
import {
	approveLibrarySubmission,
	deletePublishedShapeLibrary,
	getLibraryCatalogConfig,
	listConfiguredPublicShapeLibraries,
	listPendingLibrarySubmissions,
	listUserShapeLibraries,
	rejectLibrarySubmission,
	submitConfiguredShapeLibraryForReview,
} from "../../lib/shape-libraries";
import { protectedProcedure, publicProcedure, router } from "../init";

const libraryItemSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	elements: z.array(z.record(z.unknown())),
});

async function assertInstanceAdmin(
	db: Parameters<typeof requireInstanceAdmin>[0],
	userId: string,
) {
	try {
		await requireInstanceAdmin(db, userId);
	} catch {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Kein Zugriff auf die Instanz-Einstellungen",
		});
	}
}

function mapSubmissionError(error: unknown): never {
	const message = error instanceof Error ? error.message : "UNKNOWN";
	if (message === "INVALID_SLUG") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Ungueltiger Slug (nur a-z, 0-9, Bindestrich)",
		});
	}
	if (message === "SLUG_TAKEN") {
		throw new TRPCError({
			code: "CONFLICT",
			message: "Dieser Slug ist bereits vergeben",
		});
	}
	if (message === "EMPTY_LIBRARY") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Die Bibliothek ist leer",
		});
	}
	if (message === "REMOTE_CATALOG_NOT_CONFIGURED") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Der zentrale Community-Katalog ist nicht konfiguriert.",
		});
	}
	if (message === "REMOTE_SUBMISSION_FAILED") {
		throw new TRPCError({
			code: "BAD_GATEWAY",
			message:
				"Die Einreichung konnte nicht an den zentralen Katalog gesendet werden.",
		});
	}
	if (message === "INVALID_LIBRARY") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Ungueltige Bibliothek",
		});
	}
	throw error;
}

export const shapeLibraryRouter = router({
	getCatalogConfig: publicProcedure.query(() => getLibraryCatalogConfig()),

	listPublic: publicProcedure.query(async ({ ctx }) => {
		return listConfiguredPublicShapeLibraries(ctx.db);
	}),

	listMine: protectedProcedure.query(async ({ ctx }) => {
		return listUserShapeLibraries(ctx.db, ctx.user.id);
	}),

	getPersonal: protectedProcedure.query(async ({ ctx }) => {
		const row = await ctx.db.query.personalShapeLibraries.findFirst({
			where: eq(personalShapeLibraries.userId, ctx.user.id),
		});
		if (!row) {
			return {
				ownPackages: [],
				activePackageId: null,
				installedLibraries: [],
			};
		}
		try {
			const parsed = personalShapeLibraryStateSchema.parse(
				JSON.parse(row.content),
			);
			return parsed;
		} catch {
			return {
				ownPackages: [],
				activePackageId: null,
				installedLibraries: [],
			};
		}
	}),

	syncPersonal: protectedProcedure
		.input(personalShapeLibraryStateSchema)
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.insert(personalShapeLibraries)
				.values({
					userId: ctx.user.id,
					content: JSON.stringify(input),
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: personalShapeLibraries.userId,
					set: {
						content: JSON.stringify(input),
						updatedAt: new Date(),
					},
				});
			return { success: true };
		}),

	submitForReview: protectedProcedure
		.input(
			z.object({
				slug: z.string().min(3).max(64),
				name: z.string().min(1).max(120),
				description: z.string().max(500).optional(),
				items: z.array(libraryItemSchema).min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const file: SkedraLibraryFile = {
				type: SKEDRA_LIB_TYPE,
				version: SKEDRA_LIB_VERSION,
				name: input.name,
				description: input.description,
				author: ctx.user.name,
				source: "skedra",
				items: input.items,
			};

			const parsed = skedraLibrarySchema.safeParse(file);
			if (!parsed.success) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Ungueltige Bibliothek",
				});
			}

			try {
				const row = await submitConfiguredShapeLibraryForReview(ctx.db, {
					userId: ctx.user.id,
					authorName: ctx.user.name,
					submitterName: ctx.user.name,
					submitterEmail: ctx.user.email,
					slug: input.slug,
					name: input.name,
					description: input.description,
					file: parsed.data,
				});

				return {
					id: row.id,
					slug: row.slug,
					name: row.name,
					status: row.status,
				};
			} catch (error) {
				mapSubmissionError(error);
			}
		}),

	listReviewQueue: protectedProcedure.query(async ({ ctx }) => {
		await assertInstanceAdmin(ctx.db, ctx.user.id);
		return listPendingLibrarySubmissions(ctx.db);
	}),

	approveSubmission: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			await assertInstanceAdmin(ctx.db, ctx.user.id);
			try {
				await approveLibrarySubmission(ctx.db, {
					id: input.id,
					reviewerId: ctx.user.id,
				});
				return { success: true };
			} catch (error) {
				const message = error instanceof Error ? error.message : "UNKNOWN";
				if (message === "SUBMISSION_NOT_FOUND") {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Einreichung nicht gefunden",
					});
				}
				if (message === "SUBMISSION_ALREADY_REVIEWED") {
					throw new TRPCError({
						code: "CONFLICT",
						message: "Einreichung wurde bereits bearbeitet",
					});
				}
				if (message === "SLUG_TAKEN") {
					throw new TRPCError({
						code: "CONFLICT",
						message: "Dieser Slug ist bereits vergeben",
					});
				}
				throw error;
			}
		}),

	rejectSubmission: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				note: z.string().max(500).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await assertInstanceAdmin(ctx.db, ctx.user.id);
			try {
				await rejectLibrarySubmission(ctx.db, {
					id: input.id,
					reviewerId: ctx.user.id,
					note: input.note,
				});
				return { success: true };
			} catch (error) {
				const message = error instanceof Error ? error.message : "UNKNOWN";
				if (message === "SUBMISSION_NOT_FOUND") {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Einreichung nicht gefunden",
					});
				}
				throw error;
			}
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const ok = await deletePublishedShapeLibrary(
				ctx.db,
				ctx.user.id,
				input.id,
			);
			if (!ok) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Bibliothek nicht gefunden",
				});
			}
			return { success: true };
		}),
});
