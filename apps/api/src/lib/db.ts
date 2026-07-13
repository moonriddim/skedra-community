import { closeDb, createDb } from "@skedra/db";
import { env } from "../env";

export const db = createDb(env.DATABASE_URL, {
	maxConnections: env.DATABASE_POOL_MAX,
	idleTimeoutSeconds: env.DATABASE_IDLE_TIMEOUT_SECONDS,
	connectTimeoutSeconds: env.DATABASE_CONNECT_TIMEOUT_SECONDS,
	maxLifetimeSeconds: env.DATABASE_MAX_LIFETIME_SECONDS,
	statementTimeoutMs: env.DATABASE_STATEMENT_TIMEOUT_MS,
	idleInTransactionTimeoutMs: env.DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS,
	applicationName: "skedra-api",
});

export function closeDatabase() {
	return closeDb(db);
}
