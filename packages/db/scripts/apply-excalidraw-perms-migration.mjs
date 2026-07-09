/**
 * Einmalige Migration: Excalidraw+-Berechtigungen (fehlende Spalten/Enums).
 * Ausführen: node packages/db/scripts/apply-excalidraw-perms-migration.mjs
 */

import postgres from "postgres";

const connectionString =
	process.env.DATABASE_URL ??
	"postgresql://skedra:skedra_secret@localhost:5434/skedra";

const sql = postgres(connectionString);

const defaultPermissions = JSON.stringify({
	editCanvas: true,
	comment: true,
	inviteOthers: false,
	useAi: true,
});

const statements = [
	`CREATE TABLE IF NOT EXISTS teams (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		name text NOT NULL,
		owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		created_at timestamp DEFAULT now() NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS team_roles (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
		name text NOT NULL,
		color text NOT NULL,
		permissions text NOT NULL DEFAULT '${defaultPermissions.replace(/'/g, "''")}',
		created_at timestamp DEFAULT now() NOT NULL
	)`,
	`DO $$ BEGIN
		CREATE TYPE workspace_role AS ENUM ('member', 'admin');
	EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
	`DO $$ BEGIN
		CREATE TYPE board_access_level AS ENUM ('view', 'edit');
	EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
	`DO $$ BEGIN
		CREATE TYPE collab_share_access_level AS ENUM ('view', 'edit');
	EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
	`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS workspace_role workspace_role NOT NULL DEFAULT 'member'`,
	`ALTER TABLE whiteboard_members ADD COLUMN IF NOT EXISTS access_level board_access_level NOT NULL DEFAULT 'edit'`,
	"ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS collab_share_enabled boolean NOT NULL DEFAULT false",
	"ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS collab_share_token text",
	`ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS collab_share_access_level collab_share_access_level NOT NULL DEFAULT 'edit'`,
	"CREATE UNIQUE INDEX IF NOT EXISTS whiteboard_collab_share_token_unique ON whiteboards (collab_share_token)",
	"ALTER TABLE team_roles ADD COLUMN IF NOT EXISTS permissions text",
	`UPDATE team_roles SET permissions = '{"editCanvas":true,"comment":true,"inviteOthers":false,"useAi":true}' WHERE permissions IS NULL OR permissions = ''`,
	"ALTER TABLE team_roles ALTER COLUMN permissions SET NOT NULL",
	"ALTER TABLE whiteboard_members ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES team_roles(id) ON DELETE SET NULL",
];

try {
	for (const statement of statements) {
		await sql.unsafe(statement);
	}
	console.log("[skedra] Migration erfolgreich angewendet.");
} catch (error) {
	console.error("[skedra] Migration fehlgeschlagen:", error);
	process.exit(1);
} finally {
	await sql.end();
}
