import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";

export type DatabaseConnectionOptions = {
	maxConnections?: number;
	idleTimeoutSeconds?: number;
	connectTimeoutSeconds?: number;
	maxLifetimeSeconds?: number;
	statementTimeoutMs?: number;
	idleInTransactionTimeoutMs?: number;
	applicationName?: string;
};

export function createDb(
	connectionString: string,
	options: DatabaseConnectionOptions = {},
) {
	const client = postgres(connectionString, {
		max: options.maxConnections,
		idle_timeout: options.idleTimeoutSeconds,
		connect_timeout: options.connectTimeoutSeconds,
		max_lifetime: options.maxLifetimeSeconds,
		connection: {
			application_name: options.applicationName ?? "skedra-api",
			statement_timeout: options.statementTimeoutMs,
			idle_in_transaction_session_timeout: options.idleInTransactionTimeoutMs,
		},
	});
	return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

export async function closeDb(db: Database, timeoutSeconds = 5) {
	await db.$client.end({ timeout: timeoutSeconds });
}
