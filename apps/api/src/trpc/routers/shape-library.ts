/**
 * Published and submitted shape libraries.
 */

import {
	type Database,
	librarySubmissions,
	personalShapeLibraries,
} from "@skedra/db";
import {
	SKEDRA_LIBRARY_LICENSE,
	SKEDRA_LIB_TYPE,
	SKEDRA_LIB_VERSION,
	type SkedraLibraryFile,
	personalShapeLibraryStateSchema,
	skedraLibrarySchema,
} from "@skedra/shared";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getOrCreateInstanceSettings } from "../../lib/instance-settings";
import {
	approveLibrarySubmission,
	deletePublishedShapeLibrary,
	getConfiguredPublishedLibraryFile,
	getLibraryCatalogConfig,
	listConfiguredPublicShapeLibraries,
	listPendingLibrarySubmissions,
	listUserShapeLibraries,
	parseLibraryContent,
	rejectLibrarySubmission,
	submitConfiguredShapeLibraryForReview,
} from "../../lib/shape-libraries";
import { protectedProcedure, publicProcedure, router } from "../init";

const libraryItemSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	elements: z.array(z.record(z.string(), z.unknown())),
});

async function requireLibraryAdmin(db: Database, userId: string) {
	const settings = await getOrCreateInstanceSettings(db);
	if (settings.adminUserId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only the instance administrator can review libraries.",
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
			message: "Der Remote-Katalog ist nicht konfiguriert.",
		});
	}
	if (message === "REMOTE_SUBMISSION_FAILED") {
		throw new TRPCError({
			code: "BAD_GATEWAY",
			message:
				"Die Einreichung konnte nicht an den konfigurierten Remote-Katalog gesendet werden.",
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
	listSubmissions: protectedProcedure.query(async ({ ctx }) => {
		await requireLibraryAdmin(ctx.db, ctx.user.id);
		return listPendingLibrarySubmissions(ctx.db);
	}),
	getSubmissionPreview: protectedProcedure
		.input(z.object({ id: z.string().uuid() }).strict())
		.query(async ({ ctx, input }) => {
			await requireLibraryAdmin(ctx.db, ctx.user.id);
			const submission = await ctx.db.query.librarySubmissions.findFirst({
				where: eq(librarySubmissions.id, input.id),
			});
			if (!submission)
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Submission not found.",
				});
			return {
				slug: submission.slug,
				file: parseLibraryContent(submission.content),
			};
		}),
	reviewSubmission: protectedProcedure
		.input(
			z
				.object({
					id: z.string().uuid(),
					action: z.enum(["approve", "reject"]),
				})
				.strict(),
		)
		.mutation(async ({ ctx, input }) => {
			await requireLibraryAdmin(ctx.db, ctx.user.id);
			return ctx.db.transaction(async (tx) => {
				// Serialize decisions so a concurrent approval/rejection cannot partly publish a library.
				await tx
					.select({ id: librarySubmissions.id })
					.from(librarySubmissions)
					.where(eq(librarySubmissions.id, input.id))
					.for("update");
				const database = tx as unknown as Database;
				return input.action === "approve"
					? approveLibrarySubmission(database, {
							id: input.id,
							reviewerId: ctx.user.id,
						})
					: rejectLibrarySubmission(database, {
							id: input.id,
							reviewerId: ctx.user.id,
						});
			});
		}),

	getCatalogConfig: publicProcedure.query(() => getLibraryCatalogConfig()),

	listPublic: publicProcedure.query(async ({ ctx }) => {
		return listConfiguredPublicShapeLibraries(ctx.db);
	}),

	getPublicPreview: publicProcedure
		.input(z.object({ slug: z.string().min(1).max(64) }))
		.query(async ({ ctx, input }) => {
			const file = await getConfiguredPublishedLibraryFile(ctx.db, input.slug);
			if (!file) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Bibliothek nicht gefunden",
				});
			}
			return {
				items: file.items.slice(0, 12),
				totalItemCount: file.items.length,
			};
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
				licenseAccepted: z.literal(true),
				items: z.array(libraryItemSchema).min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const file: SkedraLibraryFile = {
				type: SKEDRA_LIB_TYPE,
				version: SKEDRA_LIB_VERSION,
				name: input.name,
				description: input.description,
				license: SKEDRA_LIBRARY_LICENSE,
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
					licenseAccepted: input.licenseAccepted,
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
