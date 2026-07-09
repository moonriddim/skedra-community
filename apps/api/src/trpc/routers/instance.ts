/** Instanz-Einstellungen (SMTP, Admin) für Self-Hosting. */

import { instanceSettings } from "@skedra/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
	encryptLiveKitApiSecret,
	encryptSmtpPassword,
	getEnvLiveKitConfigStatus,
	getOrCreateInstanceSettings,
	isInstanceAdmin,
	requireInstanceAdmin,
	resolveLiveKitConfig,
} from "../../lib/instance-settings";
import {
	consumePasswordResetLink,
	getMailDeliveryStatus,
	sendAppEmail,
} from "../../lib/mail";
import { protectedProcedure, publicProcedure, router } from "../init";

const smtpInputSchema = z.object({
	useCustomSmtp: z.boolean(),
	host: z.string().max(255).optional(),
	port: z.number().int().min(1).max(65535).optional(),
	user: z.string().max(255).optional(),
	from: z.string().email().optional(),
	password: z.string().max(500).optional(),
	clearPassword: z.boolean().optional(),
	secure: z.boolean().optional(),
	resetFallback: z.enum(["log", "link"]).optional(),
});

const callsInputSchema = z.object({
	useCustomCalls: z.boolean(),
	callsEnabled: z.boolean(),
	provider: z.enum(["none", "livekit"]),
	livekitUrl: z.string().url().optional(),
	livekitApiKey: z.string().max(255).optional(),
	livekitApiSecret: z.string().max(500).optional(),
	clearApiSecret: z.boolean().optional(),
	tokenTtlSeconds: z.number().int().min(60).max(86_400).optional(),
});

export const instanceRouter = router({
	getMailStatus: protectedProcedure.query(async ({ ctx }) => {
		await requireInstanceAdmin(ctx.db, ctx.user.id);
		const settings = await getOrCreateInstanceSettings(ctx.db);
		const delivery = await getMailDeliveryStatus(ctx.db);

		return {
			...delivery,
			adminUserId: settings.adminUserId,
			isAdmin: await isInstanceAdmin(ctx.db, ctx.user.id),
			useCustomSmtp: settings.useCustomSmtp,
			smtpHost: settings.smtpHost,
			smtpPort: settings.smtpPort,
			smtpUser: settings.smtpUser,
			smtpFrom: settings.smtpFrom,
			smtpSecure: settings.smtpSecure,
			hasStoredPassword: !!settings.encryptedSmtpPassword,
			resetFallback: settings.resetFallback === "link" ? "link" : "log",
		};
	}),

	updateSmtp: protectedProcedure
		.input(smtpInputSchema)
		.mutation(async ({ ctx, input }) => {
			const settings = await getOrCreateInstanceSettings(ctx.db);
			await requireInstanceAdmin(ctx.db, ctx.user.id);

			const adminUserId = settings.adminUserId ?? ctx.user.id;

			let encryptedSmtpPassword = settings.encryptedSmtpPassword;
			if (input.clearPassword) {
				encryptedSmtpPassword = null;
			} else if (input.password?.trim()) {
				encryptedSmtpPassword = encryptSmtpPassword(input.password.trim());
			}

			const [updated] = await ctx.db
				.update(instanceSettings)
				.set({
					adminUserId,
					useCustomSmtp: input.useCustomSmtp,
					smtpHost: input.host?.trim() || null,
					smtpPort: input.port ?? null,
					smtpUser: input.user?.trim() || null,
					smtpFrom: input.from?.trim() || null,
					encryptedSmtpPassword,
					smtpSecure: input.secure ?? false,
					resetFallback: input.resetFallback ?? settings.resetFallback,
					updatedAt: new Date(),
				})
				.where(eq(instanceSettings.id, "default"))
				.returning();

			return { success: true, settings: updated };
		}),

	getCallStatus: protectedProcedure.query(async ({ ctx }) => {
		await requireInstanceAdmin(ctx.db, ctx.user.id);
		const settings = await getOrCreateInstanceSettings(ctx.db);
		const resolved = await resolveLiveKitConfig(ctx.db);
		const envStatus = getEnvLiveKitConfigStatus();

		return {
			isAdmin: await isInstanceAdmin(ctx.db, ctx.user.id),
			source: resolved?.source ?? "none",
			enabled: !!resolved,
			provider: resolved?.provider ?? "none",
			useCustomCalls: settings.useCustomCalls,
			callsEnabled: settings.callsEnabled,
			callProvider:
				settings.callProvider === "livekit" ? ("livekit" as const) : "none",
			livekitUrl: settings.livekitUrl,
			livekitApiKey: settings.livekitApiKey,
			hasStoredApiSecret: !!settings.encryptedLivekitApiSecret,
			tokenTtlSeconds: settings.livekitTokenTtlSeconds,
			envConfigured: envStatus.configured,
			envEnabled: envStatus.enabled,
			envProvider: envStatus.provider,
			envServerUrl: envStatus.serverUrl,
		};
	}),

	updateCalls: protectedProcedure
		.input(callsInputSchema)
		.mutation(async ({ ctx, input }) => {
			const settings = await getOrCreateInstanceSettings(ctx.db);
			await requireInstanceAdmin(ctx.db, ctx.user.id);

			const livekitUrl = input.livekitUrl?.trim() || null;
			const livekitApiKey = input.livekitApiKey?.trim() || null;
			let encryptedLivekitApiSecret = settings.encryptedLivekitApiSecret;
			if (input.clearApiSecret) {
				encryptedLivekitApiSecret = null;
			} else if (input.livekitApiSecret?.trim()) {
				encryptedLivekitApiSecret = encryptLiveKitApiSecret(
					input.livekitApiSecret.trim(),
				);
			}

			if (
				input.useCustomCalls &&
				input.callsEnabled &&
				input.provider === "livekit" &&
				(!livekitUrl || !livekitApiKey || !encryptedLivekitApiSecret)
			) {
				throw new Error(
					"LiveKit URL, API Key und API Secret sind erforderlich.",
				);
			}

			const adminUserId = settings.adminUserId ?? ctx.user.id;

			await ctx.db
				.update(instanceSettings)
				.set({
					adminUserId,
					useCustomCalls: input.useCustomCalls,
					callsEnabled: input.callsEnabled,
					callProvider: input.provider,
					livekitUrl,
					livekitApiKey,
					encryptedLivekitApiSecret,
					livekitTokenTtlSeconds: input.tokenTtlSeconds ?? 3600,
					updatedAt: new Date(),
				})
				.where(eq(instanceSettings.id, "default"));

			return { success: true };
		}),

	sendTestEmail: protectedProcedure.mutation(async ({ ctx }) => {
		await requireInstanceAdmin(ctx.db, ctx.user.id);

		await sendAppEmail(ctx.db, {
			to: ctx.user.email,
			subject: "Skedra – SMTP-Test",
			text: [
				"Diese Test-E-Mail bestätigt, dass dein SMTP-Server korrekt konfiguriert ist.",
				"",
				`Gesendet an: ${ctx.user.email}`,
			].join("\n"),
		});

		return { success: true, email: ctx.user.email };
	}),

	/** Liefert einen lokalen Reset-Link, falls der Mailversand fehlgeschlagen ist. */
	peekPasswordResetLink: publicProcedure
		.input(z.object({ email: z.string().email() }))
		.query(({ input }) => {
			const url = consumePasswordResetLink(input.email);
			return { url };
		}),
});
