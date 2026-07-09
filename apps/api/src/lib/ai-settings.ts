/**
 * Verschluesselte AI-Key Speicherung (BYOK).
 */

import { type Database, userAiSettings } from "@skedra/db";
import {
	type SkedraAiProvider,
	isLocalAiProvider,
} from "@skedra/shared/ai-providers";
import { decryptText, encryptText } from "@skedra/shared/server-crypto";
import { eq } from "drizzle-orm";
import { env } from "../env";

export type AiProvider = SkedraAiProvider;

export type ResolvedAiCredentials = {
	provider: AiProvider;
	apiKey: string;
	model: string | null;
	baseUrl: string | null;
	source: "user" | "platform";
};

function isPlatformAiConfigured() {
	return !!env.SKEDRA_AI_API_KEY?.trim();
}

function getAiEncryptionOptions() {
	return {
		secret: env.DATA_ENCRYPTION_SECRET ?? env.AUTH_SECRET,
		purpose: "user-ai-api-key",
	};
}

export async function getUserAiSettings(db: Database, userId: string) {
	const row = await db.query.userAiSettings.findFirst({
		where: eq(userAiSettings.userId, userId),
		columns: {
			provider: true,
			model: true,
			baseUrl: true,
			encryptedApiKey: true,
			updatedAt: true,
		},
	});

	if (!row) {
		return {
			configured: false as const,
			platformFallbackAvailable: isPlatformAiConfigured(),
		};
	}

	let keyHint = "";
	if (isLocalAiProvider(row.provider as AiProvider)) {
		keyHint = "lokal";
	} else {
		try {
			const plain = decryptText(row.encryptedApiKey, getAiEncryptionOptions());
			keyHint =
				plain.length > 8 ? `${plain.slice(0, 4)}…${plain.slice(-4)}` : "••••";
		} catch {
			keyHint = "••••";
		}
	}

	return {
		configured: true as const,
		provider: row.provider as AiProvider,
		model: row.model,
		baseUrl: row.baseUrl,
		keyHint,
		updatedAt: row.updatedAt,
		platformFallbackAvailable: isPlatformAiConfigured(),
	};
}

/** User-BYOK oder optionaler Plattform-Fallback-Key. */
export async function resolveAiCredentials(
	db: Database,
	userId: string,
): Promise<ResolvedAiCredentials | null> {
	const userKey = await getDecryptedUserAiKey(db, userId);
	if (userKey) {
		return { ...userKey, source: "user" };
	}

	const platformKey = env.SKEDRA_AI_API_KEY?.trim();
	if (!platformKey) return null;

	return {
		provider: (env.SKEDRA_AI_PROVIDER ?? "openai") as AiProvider,
		apiKey: platformKey,
		model: env.SKEDRA_AI_MODEL?.trim() || null,
		baseUrl: env.SKEDRA_AI_BASE_URL?.trim() || null,
		source: "platform",
	};
}

export async function upsertUserAiSettings(
	db: Database,
	input: {
		userId: string;
		provider: AiProvider;
		apiKey?: string;
		model?: string | null;
		baseUrl?: string | null;
	},
) {
	const existing = await db.query.userAiSettings.findFirst({
		where: eq(userAiSettings.userId, input.userId),
	});

	const newKey = input.apiKey?.trim();
	let encryptedApiKey: string;

	if (newKey) {
		encryptedApiKey = encryptText(newKey, getAiEncryptionOptions());
	} else if (isLocalAiProvider(input.provider)) {
		encryptedApiKey =
			existing?.encryptedApiKey ??
			encryptText("local-only", getAiEncryptionOptions());
	} else if (existing && existing.provider === input.provider) {
		// Modell/URL aktualisieren ohne Key neu einzugeben
		encryptedApiKey = existing.encryptedApiKey;
	} else {
		throw new Error("API-Key fehlt");
	}

	const baseUrl =
		input.baseUrl !== undefined
			? input.baseUrl?.trim() || null
			: existing?.provider === input.provider
				? existing.baseUrl
				: null;

	const model =
		input.model !== undefined
			? input.model?.trim() || null
			: (existing?.model ?? null);

	await db
		.insert(userAiSettings)
		.values({
			userId: input.userId,
			provider: input.provider,
			encryptedApiKey,
			model,
			baseUrl,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: userAiSettings.userId,
			set: {
				provider: input.provider,
				encryptedApiKey,
				model,
				baseUrl,
				updatedAt: new Date(),
			},
		});
}

export async function revokeUserAiSettings(db: Database, userId: string) {
	await db.delete(userAiSettings).where(eq(userAiSettings.userId, userId));
}

export async function getDecryptedUserAiKey(db: Database, userId: string) {
	const row = await db.query.userAiSettings.findFirst({
		where: eq(userAiSettings.userId, userId),
	});

	if (!row) return null;

	return {
		provider: row.provider as AiProvider,
		model: row.model,
		baseUrl: row.baseUrl,
		apiKey: decryptText(row.encryptedApiKey, getAiEncryptionOptions()),
	};
}
