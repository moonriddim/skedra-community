import { readProcessEnv } from "@skedra/shared";
import { z } from "zod";

const envSchema = z.object({
	DATABASE_URL: z
		.string()
		.default("postgresql://skedra:skedra_secret@localhost:5434/skedra"),
	REALTIME_PORT: z.coerce.number().int().positive().default(1235),
	AUTH_SECRET: z
		.string()
		.min(32)
		.default("change-me-to-a-random-secret-min-32-chars"),
	DATA_ENCRYPTION_SECRET: z.string().min(32).optional(),
});

export const env = envSchema.parse(readProcessEnv());
