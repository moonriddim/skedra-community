/** Instanz-Einstellungen (SMTP, Admin) für Self-Hosting. */

import { instanceSettings } from "@skedra/db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "../../env";
import {
	encryptLiveKitApiSecret,
	encryptSmtpPassword,
	getEnvLiveKitConfigStatus,
	getOrCreateInstanceSettings,
	isFounderAccount,
	isInstanceAdmin,
	requireInstanceAdmin,
	resolveLiveKitConfig,
} from "../../lib/instance-settings";
import {
	consumePasswordResetLink,
	getMailDeliveryStatus,
	sendAppEmail,
} from "../../lib/mail";
import {
	ObjectStorageConfigChangeError,
	getEnvObjectStorageStatus,
	getObjectStorageStatus,
	updateObjectStorageSettings,
} from "../../lib/object-storage";
import { authenticatedProcedure, protectedProcedure, router } from "../init";

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

const objectStorageInputSchema = z.object({
	useCustomObjectStorage: z.boolean(),
	provider: z.enum(["inline", "s3"]),
	preset: z.enum(["custom", "r2", "ovh", "aws"]),
	endpoint: z.string().url().optional(),
	region: z.string().max(80).optional(),
	bucket: z.string().max(255).optional(),
	accessKeyId: z.string().max(255).optional(),
	secretAccessKey: z.string().max(500).optional(),
	clearSecretAccessKey: z.boolean().optional(),
	publicBaseUrl: z.string().url().optional(),
	forcePathStyle: z.boolean().optional(),
});

function requireSelfHostedDeployment() {
	if (env.SKEDRA_DEPLOYMENT_MODE === "managed") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "System-Einstellungen sind im Managed-Betrieb nicht verfügbar.",
		});
	}
}

export const instanceRouter = router({
	getFounderAccess: authenticatedProcedure.query(async ({ ctx }) => ({
		isFounder: isFounderAccount(ctx.user.email),
		managedDeployment: env.SKEDRA_DEPLOYMENT_MODE === "managed",
	})),

	getMailStatus: protectedProcedure.query(async ({ ctx }) => {
		requireSelfHostedDeployment();
		await requireInstanceAdmin(ctx.db, ctx.user.id);
		const settings = await getOrCreateInstanceSettings(ctx.db);
		const delivery = await getMailDeliveryStatus(ctx.db);

		return {
			...delivery,
			adminUserId: settings.adminUserId,
			isAdmin: await isInstanceAdmin(ctx.db, ctx.user.id),
			managedDeployment: env.SKEDRA_DEPLOYMENT_MODE === "managed",
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
			requireSelfHostedDeployment();
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
		requireSelfHostedDeployment();
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
			requireSelfHostedDeployment();
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

	getObjectStorageStatus: protectedProcedure.query(async ({ ctx }) => {
		requireSelfHostedDeployment();
		await requireInstanceAdmin(ctx.db, ctx.user.id);
		const resolved = await getObjectStorageStatus(ctx.db);

		const settings = await getOrCreateInstanceSettings(ctx.db);
		const envStatus = getEnvObjectStorageStatus();
		const storedPreset = settings.objectStoragePreset;
		return {
			...resolved,
			isAdmin: true,
			objectStorageSettingsEditable: true,
			useCustomObjectStorage: settings.useCustomObjectStorage,
			objectStorageProvider:
				settings.objectStorageProvider === "s3"
					? ("s3" as const)
					: envStatus.provider,
			objectStoragePreset:
				storedPreset === "r2" ||
				storedPreset === "ovh" ||
				storedPreset === "aws"
					? storedPreset
					: envStatus.preset,
			objectStorageEndpoint:
				settings.objectStorageEndpoint ?? envStatus.endpoint,
			objectStorageRegion: settings.objectStorageRegion ?? envStatus.region,
			objectStorageBucket: settings.objectStorageBucket ?? envStatus.bucket,
			objectStorageAccessKeyId: settings.objectStorageAccessKeyId ?? null,
			hasStoredSecretAccessKey:
				!!settings.encryptedObjectStorageSecretAccessKey,
			objectStoragePublicBaseUrl:
				settings.objectStoragePublicBaseUrl ?? envStatus.publicBaseUrl,
			objectStorageForcePathStyle:
				settings.objectStorageForcePathStyle ?? envStatus.forcePathStyle,
			envConfigured: envStatus.configured,
			envProvider: envStatus.provider,
			envPreset: envStatus.preset,
			envBucket: envStatus.bucket,
			envPublicBaseUrl: envStatus.publicBaseUrl,
		};
	}),

	updateObjectStorage: protectedProcedure
		.input(objectStorageInputSchema)
		.mutation(async ({ ctx, input }) => {
			requireSelfHostedDeployment();
			await requireInstanceAdmin(ctx.db, ctx.user.id);
			const settings = await getOrCreateInstanceSettings(ctx.db);
			const endpoint = input.endpoint?.trim() || null;
			const region = input.region?.trim() || null;
			const bucket = input.bucket?.trim() || null;
			const accessKeyId = input.accessKeyId?.trim() || null;
			const publicBaseUrl = input.publicBaseUrl?.trim() || null;
			const hasStoredSecret =
				!!settings.encryptedObjectStorageSecretAccessKey &&
				!input.clearSecretAccessKey;
			const hasNextSecret = hasStoredSecret || !!input.secretAccessKey?.trim();

			if (
				input.useCustomObjectStorage &&
				input.provider === "s3" &&
				(!bucket ||
					!accessKeyId ||
					!hasNextSecret ||
					(input.preset !== "aws" && !endpoint))
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Bucket, Access Key, Secret und Endpoint sind für S3-kompatiblen Storage erforderlich.",
				});
			}

			try {
				await updateObjectStorageSettings(ctx.db, {
					useCustomObjectStorage: input.useCustomObjectStorage,
					provider: input.provider,
					preset: input.preset,
					endpoint,
					region,
					bucket,
					accessKeyId,
					secretAccessKey: input.secretAccessKey,
					clearSecretAccessKey: input.clearSecretAccessKey,
					publicBaseUrl,
					forcePathStyle: input.forcePathStyle,
					adminUserId: settings.adminUserId ?? ctx.user.id,
				});
			} catch (error) {
				if (error instanceof ObjectStorageConfigChangeError) {
					throw new TRPCError({ code: "CONFLICT", message: error.message });
				}
				throw error;
			}

			return { success: true };
		}),

	sendTestEmail: protectedProcedure.mutation(async ({ ctx }) => {
		requireSelfHostedDeployment();
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

	/**
	 * Liefert einen lokalen Reset-Link, falls der Mailversand fehlgeschlagen ist.
	 *
	 * Fix A1: War zuvor ein `publicProcedure` — dadurch konnte JEDER anonym den
	 * Reset-Link eines fremden Kontos allein anhand der E-Mail abrufen und so das
	 * Konto übernehmen. Jetzt nur noch für angemeldete Instanz-Admins zugänglich;
	 * der Admin ruft den Link ab und übergibt ihn dem betroffenen Nutzer manuell.
	 */
	peekPasswordResetLink: protectedProcedure
		.input(z.object({ email: z.string().email() }))
		.query(async ({ ctx, input }) => {
			requireSelfHostedDeployment();
			await requireInstanceAdmin(ctx.db, ctx.user.id);
			const url = consumePasswordResetLink(input.email);
			return { url };
		}),
});
