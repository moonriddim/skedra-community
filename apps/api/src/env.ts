import { readProcessEnv } from "@skedra/shared";
import { z } from "zod";

// Bekannte Platzhalter-Secrets aus den .env-Beispielen. Im Managed/SaaS-Modus
// dürfen genau diese Werte NICHT verwendet werden (Fix A2).
const DEFAULT_AUTH_SECRET = "change-me-to-a-random-secret-min-32-chars";
const DEFAULT_DATA_ENCRYPTION_SECRET =
	"change-me-to-a-long-random-secret-min-32-chars";

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
		AUTH_SECRET: z
			.string()
			.default("change-me-to-a-random-secret-min-32-chars"),
		DATA_ENCRYPTION_SECRET: z.string().min(32).optional(),
		SKEDRA_DEPLOYMENT_MODE: z.enum(["selfhost", "managed"]).default("selfhost"),
		SKEDRA_FOUNDER_EMAIL: optionalEmail,
		APP_URL: z.string().default("http://localhost:5174"),
		/** Öffentlicher Katalog (apps/libraries), z. B. http://localhost:5175 */
		LIBRARIES_URL: z.string().default("http://localhost:5175"),
		API_URL: z.string().default("http://localhost:3001"),
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
		LIVEKIT_TOKEN_TTL_SECONDS: z.coerce
			.number()
			.min(60)
			.max(86400)
			.default(3600),
		SKEDRA_OBJECT_STORAGE_PROVIDER: z.enum(["inline", "s3"]).default("inline"),
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
		/** Stripe Billing: the secret key is server-side only. */
		STRIPE_SECRET_KEY: optionalString,
		STRIPE_WEBHOOK_SECRET: optionalString,
		STRIPE_PRICE_PRO_MONTHLY: optionalString,
		STRIPE_PRICE_PRO_YEARLY: optionalString,
	})
	// Fix A2/A3: Im Managed/SaaS-Modus müssen echte, eindeutige Secrets gesetzt sein.
	// Sonst wären Sessions fälschbar und gespeicherte Geheimnisse (SMTP-Passwort,
	// AI-Keys, LiveKit-Secret) mit einem öffentlich bekannten Schlüssel entschlüsselbar.
	.superRefine((value, ctx) => {
		if (value.SKEDRA_DEPLOYMENT_MODE !== "managed") return;

		if (
			value.AUTH_SECRET === DEFAULT_AUTH_SECRET ||
			value.AUTH_SECRET.trim().length < 32
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["AUTH_SECRET"],
				message:
					"AUTH_SECRET must be a unique random value (>= 32 chars) when SKEDRA_DEPLOYMENT_MODE=managed.",
			});
		}

		if (
			!value.DATA_ENCRYPTION_SECRET ||
			value.DATA_ENCRYPTION_SECRET === DEFAULT_DATA_ENCRYPTION_SECRET ||
			value.DATA_ENCRYPTION_SECRET.trim().length < 32
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["DATA_ENCRYPTION_SECRET"],
				message:
					"DATA_ENCRYPTION_SECRET must be a unique random value (>= 32 chars) when SKEDRA_DEPLOYMENT_MODE=managed.",
			});
		}

		if (value.SKEDRA_OBJECT_STORAGE_PROVIDER !== "s3") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["SKEDRA_OBJECT_STORAGE_PROVIDER"],
				message:
					"Managed Skedra requires SKEDRA_OBJECT_STORAGE_PROVIDER=s3 so image bytes are not stored in PostgreSQL.",
			});
		}

		const requiredS3Fields: Array<keyof typeof value> = [
			"SKEDRA_OBJECT_STORAGE_BUCKET",
			"SKEDRA_OBJECT_STORAGE_ACCESS_KEY_ID",
			"SKEDRA_OBJECT_STORAGE_SECRET_ACCESS_KEY",
		];
		for (const field of requiredS3Fields) {
			if (!value[field]) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: [field],
					message: `${field} is required when SKEDRA_DEPLOYMENT_MODE=managed.`,
				});
			}
		}

		if (
			value.SKEDRA_OBJECT_STORAGE_PRESET !== "aws" &&
			!value.SKEDRA_OBJECT_STORAGE_ENDPOINT
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["SKEDRA_OBJECT_STORAGE_ENDPOINT"],
				message:
					"SKEDRA_OBJECT_STORAGE_ENDPOINT is required for managed non-AWS object storage.",
			});
		}
	});

export const env = envSchema.parse(readProcessEnv());
