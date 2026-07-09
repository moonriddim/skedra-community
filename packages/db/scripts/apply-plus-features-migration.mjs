/**
 * Excalidraw+-parity primitives:
 * - workspace-owned boards
 * - board folders/collections
 * - server-synced personal shape libraries
 * - dedicated read-only embed links
 *
 * node packages/db/scripts/apply-plus-features-migration.mjs
 */

import postgres from "postgres";

const sql = postgres(
	process.env.DATABASE_URL ??
		"postgresql://skedra:skedra_secret@localhost:5434/skedra",
);

const statements = [
	`INSERT INTO teams (name, owner_id)
		SELECT users.name || '''s Workspace', users.id
		FROM users
		WHERE NOT EXISTS (
			SELECT 1 FROM teams WHERE teams.owner_id = users.id
		)`,
	`CREATE TABLE IF NOT EXISTS whiteboard_folders (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
		owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		name text NOT NULL,
		parent_id uuid,
		created_at timestamp DEFAULT now() NOT NULL,
		updated_at timestamp DEFAULT now() NOT NULL
	)`,
	"ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE SET NULL",
	"ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES whiteboard_folders(id) ON DELETE SET NULL",
	"ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS embed_share_enabled boolean NOT NULL DEFAULT false",
	"ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS embed_share_token text",
	"ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS e2ee_enabled boolean NOT NULL DEFAULT false",
	"ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS e2ee_key_hint text",
	"ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS e2ee_created_at timestamp",
	"CREATE UNIQUE INDEX IF NOT EXISTS whiteboard_embed_share_token_unique ON whiteboards(embed_share_token)",
	`UPDATE whiteboards
		SET team_id = teams.id
		FROM teams
		WHERE whiteboards.team_id IS NULL
			AND teams.owner_id = whiteboards.owner_id`,
	`CREATE TABLE IF NOT EXISTS personal_shape_libraries (
		user_id text PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		content text NOT NULL,
		created_at timestamp DEFAULT now() NOT NULL,
		updated_at timestamp DEFAULT now() NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS whiteboard_e2ee_updates (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		whiteboard_id uuid NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
		user_id text,
		client_id text NOT NULL,
		update text NOT NULL,
		created_at timestamp DEFAULT now() NOT NULL
	)`,
	`CREATE INDEX IF NOT EXISTS whiteboard_e2ee_updates_board_created_idx
		ON whiteboard_e2ee_updates(whiteboard_id, created_at)`,
	`DO $$
	BEGIN
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_provider') THEN
			CREATE TYPE integration_provider AS ENUM ('notion', 'obsidian');
		END IF;
	END $$`,
	`CREATE TABLE IF NOT EXISTS board_integration_syncs (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		whiteboard_id uuid NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
		user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		provider integration_provider NOT NULL,
		enabled boolean DEFAULT true NOT NULL,
		target text NOT NULL,
		config text DEFAULT '{}' NOT NULL,
		encrypted_secret text,
		last_synced_at timestamp,
		last_sync_error text,
		created_at timestamp DEFAULT now() NOT NULL,
		updated_at timestamp DEFAULT now() NOT NULL
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS board_integration_sync_unique
		ON board_integration_syncs(whiteboard_id, user_id, provider)`,
	`CREATE INDEX IF NOT EXISTS board_integration_sync_board_idx
		ON board_integration_syncs(whiteboard_id)`,
];

try {
	for (const statement of statements) {
		await sql.unsafe(statement);
	}
	console.log("[skedra] Plus-Feature-Migration erfolgreich.");
} catch (error) {
	console.error("[skedra] Migration fehlgeschlagen:", error);
	process.exit(1);
} finally {
	await sql.end();
}
