import { isAbsolute } from "node:path";
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
const optionalUrl = z.preprocess(
	emptyStringToUndefined,
	z.string().url().optional(),
);
const optionalEmail = z.preprocess(
	emptyStringToUndefined,
	z.string().email().optional(),
);
const optionalString = z.preprocess(
	emptyStringToUndefined,
	z.string().min(1).optional(),
);
const optionalBoolean = z
	.string()
	.optional()
	.transform((value) => value === "true" || value === "1");

const envSchema = z
	.object({
		DATABASE_URL: z
			.string()
			.default("postgresql://skedra:skedra_secret@localhost:5434/skedra"),
		DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
		DATABASE_IDLE_TIMEOUT_SECONDS: z.coerce
			.number()
			.int()
			.min(1)
			.max(3600)
			.default(30),
		DATABASE_CONNECT_TIMEOUT_SECONDS: z.coerce
			.number()
			.int()
			.min(1)
			.max(300)
			.default(10),
		DATABASE_MAX_LIFETIME_SECONDS: z.coerce
			.number()
			.int()
			.min(60)
			.max(86400)
			.default(1800),
		DATABASE_STATEMENT_TIMEOUT_MS: z.coerce
			.number()
			.int()
			.min(1000)
			.max(600000)
			.default(30000),
		DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS: z.coerce
			.number()
			.int()
			.min(1000)
			.max(600000)
			.default(30000),
		AUTH_SECRET: z
			.string()
			.default("change-me-to-a-random-secret-min-32-chars"),
		DATA_ENCRYPTION_SECRET: z.string().min(32).optional(),
		SKEDRA_DEPLOYMENT_MODE: z.literal("selfhost").default("selfhost"),
		APP_URL: z.string().default("http://localhost:5174"),
		/** Öffentlicher Katalog (apps/libraries), z. B. http://localhost:5175 */
		LIBRARIES_URL: z.string().default("http://localhost:5175"),
		API_URL: z.string().default("http://localhost:3001"),
		/** Interner REST-Endpunkt fuer Remote-MCP-Toolaufrufe; nie an Clients ausliefern. */
		MCP_INTERNAL_API_URL: optionalUrl,
		GOOGLE_CLIENT_ID: optionalString,
		GOOGLE_CLIENT_SECRET: optionalString,
		GITHUB_CLIENT_ID: optionalString,
		GITHUB_CLIENT_SECRET: optionalString,
		SKEDRA_REGISTRATION_MODE: z
			.enum(["open", "invite", "closed"])
			.default("invite"),
		SKEDRA_REQUIRE_EMAIL_VERIFICATION: optionalBoolean,
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
		LIVEKIT_TOKEN_TTL_SECONDS: z.coerce
			.number()
			.min(60)
			.max(86400)
			.default(3600),
		SKEDRA_OBJECT_STORAGE_PROVIDER: z
			.enum(["inline", "s3", "filesystem"])
			.default("inline"),
		SKEDRA_OBJECT_STORAGE_PATH: z.preprocess(
			emptyStringToUndefined,
			z
				.string()
				.trim()
				.refine(isAbsolute, "Storage path must be absolute.")
				.optional(),
		),
		SKEDRA_OBJECT_STORAGE_PRESET: z
			.enum(["custom", "r2", "ovh", "aws"])
			.default("custom"),
		SKEDRA_OBJECT_STORAGE_ENDPOINT: optionalUrl,
		SKEDRA_OBJECT_STORAGE_REGION: optionalString,
		SKEDRA_OBJECT_STORAGE_BUCKET: optionalString,
		SKEDRA_OBJECT_STORAGE_ACCESS_KEY_ID: optionalString,
		SKEDRA_OBJECT_STORAGE_SECRET_ACCESS_KEY: optionalString,
		SKEDRA_OBJECT_STORAGE_PUBLIC_BASE_URL: optionalUrl,
		SKEDRA_OBJECT_STORAGE_FORCE_PATH_STYLE: optionalBoolean,
		SKEDRA_ASSET_MAX_IMAGE_BYTES: z.coerce
			.number()
			.int()
			.min(1024 * 100)
			.max(1024 * 1024 * 50)
			.default(1024 * 1024 * 8),
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
	})
	.superRefine((value, ctx) => {
		for (const [provider, clientId, clientSecret] of [
			["Google", value.GOOGLE_CLIENT_ID, value.GOOGLE_CLIENT_SECRET],
			["GitHub", value.GITHUB_CLIENT_ID, value.GITHUB_CLIENT_SECRET],
		] as const) {
			if (Boolean(clientId) === Boolean(clientSecret)) continue;
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: [
					clientId
						? `${provider.toUpperCase()}_CLIENT_SECRET`
						: `${provider.toUpperCase()}_CLIENT_ID`,
				],
				message: `${provider} social login requires both client ID and client secret.`,
			});
		}

		if (
			value.SKEDRA_OBJECT_STORAGE_PROVIDER === "filesystem" &&
			!value.SKEDRA_OBJECT_STORAGE_PATH
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["SKEDRA_OBJECT_STORAGE_PATH"],
				message:
					"SKEDRA_OBJECT_STORAGE_PATH is required for filesystem storage.",
			});
		}
	});

export const env = envSchema.parse(readProcessEnv());
