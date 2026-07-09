/**
 * Fehlende Tabellen: Kommentare, Instanz-SMTP, User-Preferences.
 * node packages/db/scripts/apply-comments-instance-migration.mjs
 */

import postgres from "postgres";

const sql = postgres(
	process.env.DATABASE_URL ??
		"postgresql://skedra:skedra_secret@localhost:5434/skedra",
);

const statements = [
	`CREATE TABLE IF NOT EXISTS instance_settings (
		id text PRIMARY KEY DEFAULT 'default' NOT NULL,
		admin_user_id text REFERENCES users(id) ON DELETE SET NULL,
		use_custom_smtp boolean NOT NULL DEFAULT false,
		smtp_host text,
		smtp_port integer,
		smtp_user text,
		smtp_from text,
		encrypted_smtp_password text,
		smtp_secure boolean NOT NULL DEFAULT false,
		use_custom_calls boolean NOT NULL DEFAULT false,
		calls_enabled boolean NOT NULL DEFAULT false,
		call_provider text NOT NULL DEFAULT 'none',
		livekit_url text,
		livekit_api_key text,
		encrypted_livekit_api_secret text,
		livekit_token_ttl_seconds integer NOT NULL DEFAULT 3600,
		reset_fallback text NOT NULL DEFAULT 'log',
		updated_at timestamp DEFAULT now() NOT NULL
	)`,
	"ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS use_custom_calls boolean NOT NULL DEFAULT false",
	"ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS calls_enabled boolean NOT NULL DEFAULT false",
	`ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS call_provider text NOT NULL DEFAULT 'none'`,
	"ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS livekit_url text",
	"ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS livekit_api_key text",
	"ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS encrypted_livekit_api_secret text",
	"ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS livekit_token_ttl_seconds integer NOT NULL DEFAULT 3600",
	`CREATE TABLE IF NOT EXISTS user_preferences (
		user_id text PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		email_on_mention boolean NOT NULL DEFAULT true,
		email_on_comment_reply boolean NOT NULL DEFAULT true,
		updated_at timestamp DEFAULT now() NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS whiteboard_comment_threads (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		whiteboard_id uuid NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
		x real NOT NULL,
		y real NOT NULL,
		resolved_at timestamp,
		created_by_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		created_at timestamp DEFAULT now() NOT NULL,
		updated_at timestamp DEFAULT now() NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS whiteboard_comment_messages (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		thread_id uuid NOT NULL REFERENCES whiteboard_comment_threads(id) ON DELETE CASCADE,
		author_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		body text NOT NULL,
		created_at timestamp DEFAULT now() NOT NULL
	)`,
];

try {
	for (const statement of statements) {
		await sql.unsafe(statement);
	}
	console.log("[skedra] Kommentar-/Instanz-Migration erfolgreich.");
} catch (error) {
	console.error("[skedra] Migration fehlgeschlagen:", error);
	process.exit(1);
} finally {
	await sql.end();
}
