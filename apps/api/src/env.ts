import { readProcessEnv } from "@skedra/shared";
import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
	typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalLiveKitUrl = z.preprocess(
	emptyStringToUndefined,
	z.string().url().optional(),
);
const optionalLiveKitSecret = z.preprocess(
	emptyStringToUndefined,
	z.string().min(1).optional(),
);

const envSchema = z.object({
	DATABASE_URL: z
		.string()
		.default("postgresql://skedra:skedra_secret@localhost:5434/skedra"),
	AUTH_SECRET: z.string().default("change-me-to-a-random-secret-min-32-chars"),
	DATA_ENCRYPTION_SECRET: z.string().min(32).optional(),
	APP_URL: z.string().default("http://localhost:5174"),
	/** Öffentlicher Katalog (apps/libraries), z. B. http://localhost:5175 */
	LIBRARIES_URL: z.string().default("http://localhost:5175"),
	API_URL: z.string().default("http://localhost:3001"),
	REALTIME_URL: z.string().default("ws://localhost:1235"),
	SKEDRA_REGISTRATION_MODE: z
		.enum(["open", "invite", "closed"])
		.default("invite"),
	SKEDRA_LIBRARY_CATALOG_MODE: z.enum(["local", "remote"]).default("local"),
	SKEDRA_LIBRARY_CATALOG_API_URL: z.string().optional(),
	SKEDRA_LIBRARY_SUBMIT_URL: z.string().optional(),
	SKEDRA_CALLS_ENABLED: z
		.string()
		.optional()
		.transform((value) => value === "true" || value === "1"),
	SKEDRA_CALL_PROVIDER: z.enum(["none", "livekit"]).default("none"),
	SKEDRA_PUBLIC_LIVEKIT_URL: optionalLiveKitUrl,
	LIVEKIT_API_KEY: optionalLiveKitSecret,
	LIVEKIT_API_SECRET: optionalLiveKitSecret,
	LIVEKIT_TOKEN_TTL_SECONDS: z.coerce.number().min(60).max(86400).default(3600),
	/** Optionaler Plattform-Fallback fuer AI wenn User keinen BYOK-Key hat */
	SKEDRA_AI_API_KEY: z.string().min(8).optional(),
	SKEDRA_AI_PROVIDER: z
		.enum(["openai", "openrouter", "deepseek", "kimi", "ollama", "local"])
		.optional(),
	SKEDRA_AI_MODEL: z.string().optional(),
	SKEDRA_AI_BASE_URL: z.string().optional(),
	/** Optionaler SMTP-Fallback aus der Server-Umgebung */
	SMTP_HOST: z.string().optional(),
	SMTP_PORT: z.coerce.number().optional(),
	SMTP_USER: z.string().optional(),
	SMTP_PASSWORD: z.string().optional(),
	SMTP_FROM: z.string().optional(),
	SMTP_SECURE: z
		.string()
		.optional()
		.transform((value) => value === "true" || value === "1"),
});

export const env = envSchema.parse(readProcessEnv());
