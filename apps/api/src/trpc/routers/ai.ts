/**
 * AI-Einstellungen (BYOK) und Text-to-Diagram.
 */

import { userAiSettings } from "@skedra/db";
import { formatAssistantContent } from "@skedra/shared/ai-generation";
import {
	isLocalAiProvider,
	skedraAiProviders,
} from "@skedra/shared/ai-providers";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { ZodError, z } from "zod";
import {
	appendWhiteboardAiMessage,
	clearWhiteboardAiMessages,
	listWhiteboardAiMessages,
	toAiChatHistory,
} from "../../lib/ai-chat";
import { generateDiagramElements } from "../../lib/ai-diagram";
import { fetchAvailableAiModels } from "../../lib/ai-models";
import {
	type AiProvider,
	getDecryptedUserAiKey,
	getUserAiSettings,
	resolveAiCredentials,
	revokeUserAiSettings,
	upsertUserAiSettings,
} from "../../lib/ai-settings";
import { requireBoardAi, requireBoardMember } from "../../lib/permissions";
import { protectedProcedure, router } from "../init";

const upsertAiSettingsSchema = z.object({
	provider: z.enum(skedraAiProviders),
	apiKey: z.string().max(512).optional(),
	model: z.string().max(120).optional(),
	baseUrl: z.string().max(512).optional(),
});

export const aiRouter = router({
	getSettings: protectedProcedure.query(async ({ ctx }) => {
		return getUserAiSettings(ctx.db, ctx.user.id);
	}),

	listModels: protectedProcedure
		.input(
			z.object({
				provider: z.enum(skedraAiProviders),
				apiKey: z.string().max(512).optional(),
				baseUrl: z.string().max(512).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const stored = await getDecryptedUserAiKey(ctx.db, ctx.user.id);
			const provider = input.provider as AiProvider;

			const apiKey =
				input.apiKey?.trim() ||
				(stored?.provider === provider ? stored.apiKey : undefined) ||
				(isLocalAiProvider(provider) ? "local-only" : undefined);

			const baseUrl =
				input.baseUrl?.trim() ||
				(stored?.provider === provider ? stored.baseUrl : undefined) ||
				null;

			if (
				!isLocalAiProvider(provider) &&
				(!apiKey || apiKey === "local-only")
			) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Bitte zuerst einen API-Key eingeben oder speichern.",
				});
			}

			if (provider === "local" && !baseUrl) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Bitte zuerst eine Base-URL eingeben.",
				});
			}

			try {
				const models = await fetchAvailableAiModels({
					provider,
					apiKey: apiKey ?? "local-only",
					baseUrl,
				});
				return { models };
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						error instanceof Error
							? error.message
							: "Modelle konnten nicht geladen werden.",
				});
			}
		}),

	/** Nur Modell ändern — gespeicherter API-Key bleibt unangetastet. */
	updateModel: protectedProcedure
		.input(z.object({ model: z.string().min(1).max(120) }))
		.mutation(async ({ ctx, input }) => {
			const row = await ctx.db.query.userAiSettings.findFirst({
				where: eq(userAiSettings.userId, ctx.user.id),
			});

			if (!row) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Kein AI-Key hinterlegt. Bitte zuerst konfigurieren.",
				});
			}

			await ctx.db
				.update(userAiSettings)
				.set({
					model: input.model.trim(),
					updatedAt: new Date(),
				})
				.where(eq(userAiSettings.userId, ctx.user.id));

			return { success: true };
		}),

	upsertSettings: protectedProcedure
		.input(upsertAiSettingsSchema)
		.mutation(async ({ ctx, input }) => {
			const existingRow = await ctx.db.query.userAiSettings.findFirst({
				where: eq(userAiSettings.userId, ctx.user.id),
			});

			const provider = input.provider as AiProvider;
			const newKeyRaw = input.apiKey?.trim() ?? "";
			const hasValidNewKey = newKeyRaw.length >= 8;
			const hasStoredCloudKey =
				!!existingRow?.encryptedApiKey &&
				existingRow.provider === provider &&
				!isLocalAiProvider(provider);

			if (provider === "local") {
				const baseUrl =
					input.baseUrl?.trim() ||
					(existingRow?.provider === provider
						? existingRow.baseUrl?.trim()
						: undefined);
				if (!baseUrl) {
					throw new TRPCError({
						code: "PRECONDITION_FAILED",
						message: "Für lokale LLMs ist eine Base-URL erforderlich.",
					});
				}
			}

			if (!isLocalAiProvider(provider)) {
				if (newKeyRaw.length > 0 && !hasValidNewKey) {
					throw new TRPCError({
						code: "PRECONDITION_FAILED",
						message:
							"API-Key muss mindestens 8 Zeichen haben — oder Feld leer lassen, um den gespeicherten Key zu behalten.",
					});
				}
				if (!hasValidNewKey && !hasStoredCloudKey) {
					throw new TRPCError({
						code: "PRECONDITION_FAILED",
						message: "Cloud-Anbieter benötigen einen gültigen API-Key.",
					});
				}
			}

			try {
				await upsertUserAiSettings(ctx.db, {
					userId: ctx.user.id,
					provider,
					apiKey: hasValidNewKey ? newKeyRaw : undefined,
					model: input.model,
					baseUrl: input.baseUrl,
				});
			} catch (error) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message:
						error instanceof Error
							? error.message
							: "AI-Einstellungen konnten nicht gespeichert werden.",
				});
			}

			return { success: true };
		}),

	revokeSettings: protectedProcedure.mutation(async ({ ctx }) => {
		await revokeUserAiSettings(ctx.db, ctx.user.id);
		return { success: true };
	}),

	listMessages: protectedProcedure
		.input(z.object({ whiteboardId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			await requireBoardMember(ctx, input.whiteboardId);
			return listWhiteboardAiMessages(ctx.db, input.whiteboardId, ctx.user.id);
		}),

	clearMessages: protectedProcedure
		.input(z.object({ whiteboardId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			await requireBoardMember(ctx, input.whiteboardId);
			await clearWhiteboardAiMessages(ctx.db, input.whiteboardId, ctx.user.id);
			return { success: true };
		}),

	generateDiagram: protectedProcedure
		.input(
			z.object({
				whiteboardId: z.string().uuid(),
				prompt: z.string().min(3).max(4000),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requireBoardAi(ctx, input.whiteboardId);

			const credentials = await resolveAiCredentials(ctx.db, ctx.user.id);
			if (!credentials) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message:
						"Kein AI-Key hinterlegt. Bitte in den Einstellungen konfigurieren.",
				});
			}

			const prompt = input.prompt.trim();
			const priorMessages = await listWhiteboardAiMessages(
				ctx.db,
				input.whiteboardId,
				ctx.user.id,
			);

			await appendWhiteboardAiMessage(ctx.db, {
				whiteboardId: input.whiteboardId,
				userId: ctx.user.id,
				role: "user",
				content: prompt,
			});

			try {
				const generation = await generateDiagramElements({
					provider: credentials.provider,
					apiKey: credentials.apiKey,
					model: credentials.model,
					baseUrl: credentials.baseUrl,
					prompt,
					history: toAiChatHistory(priorMessages),
				});

				await appendWhiteboardAiMessage(ctx.db, {
					whiteboardId: input.whiteboardId,
					userId: ctx.user.id,
					role: "assistant",
					content: formatAssistantContent(generation),
					model: credentials.model ?? null,
					elementCount: generation.elements.length,
				});

				return {
					elements: generation.elements,
					source: credentials.source,
					resultKind: generation.resultKind,
					summary: generation.summary,
				};
			} catch (error) {
				if (error instanceof ZodError) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"Das LLM lieferte ungültige Elemente (z. B. fehlende Größe). Bitte erneut versuchen oder den Prompt vereinfachen.",
					});
				}
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						error instanceof Error
							? error.message
							: "Diagramm konnte nicht erzeugt werden",
				});
			}
		}),
});
