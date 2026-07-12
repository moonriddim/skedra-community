import { instanceSettings } from "@skedra/db";
import type { Database } from "@skedra/db";
import { decryptText, encryptText } from "@skedra/shared/server-crypto";
import { eq } from "drizzle-orm";
import { env } from "../env";
import { hasFounderAccess } from "./founder-access";

const SINGLETON_ID = "default";

export type MailConfigSource = "database" | "env" | "none";
export type CallsConfigSource = "database" | "env";
export type ResetFallbackMode = "log" | "link";

export interface ResolvedMailConfig {
	source: MailConfigSource;
	host: string;
	port: number;
	user: string;
	password: string;
	from: string;
	secure: boolean;
}

export interface ResolvedLiveKitConfig {
	source: CallsConfigSource;
	provider: "livekit";
	serverUrl: string;
	apiKey: string;
	apiSecret: string;
	tokenTtlSeconds: number;
}

function getEncryptionOptions(purpose = "smtp-password") {
	// Fix A3: Fallback auf AUTH_SECRET nur für Selfhost gedacht (keine Schlüssel-
	// trennung). Im Managed-Modus wird DATA_ENCRYPTION_SECRET per env.ts erzwungen (A2).
	return {
		secret: env.DATA_ENCRYPTION_SECRET ?? env.AUTH_SECRET,
		purpose,
	};
}

export async function getOrCreateInstanceSettings(db: Database) {
	const existing = await db.query.instanceSettings.findFirst({
		where: eq(instanceSettings.id, SINGLETON_ID),
	});

	if (existing) return existing;

	const [created] = await db
		.insert(instanceSettings)
		.values({ id: SINGLETON_ID })
		.returning();

	return created;
}

function resolveMailConfigFromEnv(): ResolvedMailConfig | null {
	if (!env.SMTP_HOST || !env.SMTP_FROM) return null;

	return {
		source: "env",
		host: env.SMTP_HOST,
		port: env.SMTP_PORT ?? (env.SMTP_SECURE ? 465 : 587),
		user: env.SMTP_USER ?? "",
		password: env.SMTP_PASSWORD ?? "",
		from: env.SMTP_FROM,
		secure: env.SMTP_SECURE ?? false,
	};
}

function normalizeTokenTtlSeconds(value: number | null | undefined) {
	if (!value || Number.isNaN(value)) return 3600;
	return Math.min(Math.max(Math.trunc(value), 60), 86_400);
}

function resolveLiveKitConfigFromEnv(): ResolvedLiveKitConfig | null {
	if (
		!env.SKEDRA_CALLS_ENABLED ||
		env.SKEDRA_CALL_PROVIDER !== "livekit" ||
		!env.SKEDRA_PUBLIC_LIVEKIT_URL ||
		!env.LIVEKIT_API_KEY ||
		!env.LIVEKIT_API_SECRET
	) {
		return null;
	}

	return {
		source: "env",
		provider: "livekit",
		serverUrl: env.SKEDRA_PUBLIC_LIVEKIT_URL,
		apiKey: env.LIVEKIT_API_KEY,
		apiSecret: env.LIVEKIT_API_SECRET,
		tokenTtlSeconds: normalizeTokenTtlSeconds(env.LIVEKIT_TOKEN_TTL_SECONDS),
	};
}

export async function resolveMailConfig(
	db: Database,
): Promise<ResolvedMailConfig | null> {
	const settings = await getOrCreateInstanceSettings(db);

	if (settings.useCustomSmtp && settings.smtpHost && settings.smtpFrom) {
		const password = settings.encryptedSmtpPassword
			? decryptText(settings.encryptedSmtpPassword, getEncryptionOptions())
			: "";

		return {
			source: "database",
			host: settings.smtpHost,
			port: settings.smtpPort ?? (settings.smtpSecure ? 465 : 587),
			user: settings.smtpUser ?? "",
			password,
			from: settings.smtpFrom,
			secure: settings.smtpSecure,
		};
	}

	return resolveMailConfigFromEnv();
}

export async function resolveLiveKitConfig(
	db: Database,
): Promise<ResolvedLiveKitConfig | null> {
	const settings = await getOrCreateInstanceSettings(db);

	if (settings.useCustomCalls) {
		if (
			!settings.callsEnabled ||
			settings.callProvider !== "livekit" ||
			!settings.livekitUrl ||
			!settings.livekitApiKey ||
			!settings.encryptedLivekitApiSecret
		) {
			return null;
		}

		return {
			source: "database",
			provider: "livekit",
			serverUrl: settings.livekitUrl,
			apiKey: settings.livekitApiKey,
			apiSecret: decryptText(
				settings.encryptedLivekitApiSecret,
				getEncryptionOptions("livekit-api-secret"),
			),
			tokenTtlSeconds: normalizeTokenTtlSeconds(
				settings.livekitTokenTtlSeconds,
			),
		};
	}

	return resolveLiveKitConfigFromEnv();
}

export function getEnvLiveKitConfigStatus() {
	return {
		configured: !!resolveLiveKitConfigFromEnv(),
		enabled: env.SKEDRA_CALLS_ENABLED,
		provider: env.SKEDRA_CALL_PROVIDER,
		serverUrl: env.SKEDRA_PUBLIC_LIVEKIT_URL ?? null,
		hasApiKey: !!env.LIVEKIT_API_KEY,
		hasApiSecret: !!env.LIVEKIT_API_SECRET,
		tokenTtlSeconds: normalizeTokenTtlSeconds(env.LIVEKIT_TOKEN_TTL_SECONDS),
	};
}

export async function isInstanceAdmin(db: Database, userId: string) {
	const settings = await getOrCreateInstanceSettings(db);
	return !settings.adminUserId || settings.adminUserId === userId;
}

export function isFounderAccount(email: string | null | undefined) {
	return hasFounderAccess({
		deploymentMode: env.SKEDRA_DEPLOYMENT_MODE,
		founderEmail: env.SKEDRA_FOUNDER_EMAIL,
		accountEmail: email,
	});
}

export async function requireInstanceAdmin(db: Database, userId: string) {
	const allowed = await isInstanceAdmin(db, userId);
	if (!allowed) {
		throw new Error("Kein Zugriff auf die Instanz-Einstellungen");
	}
}

export function encryptSmtpPassword(password: string) {
	return encryptText(password, getEncryptionOptions());
}

export function encryptLiveKitApiSecret(secret: string) {
	return encryptText(secret, getEncryptionOptions("livekit-api-secret"));
}

export async function getResetFallbackMode(
	db: Database,
): Promise<ResetFallbackMode> {
	const settings = await getOrCreateInstanceSettings(db);
	return settings.resetFallback === "link" ? "link" : "log";
}
