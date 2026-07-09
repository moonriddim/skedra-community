/**
 * Legt fehlende Team-/Rollen-Tabellen an (ohne interaktives drizzle-kit push).
 * Ausführen: node packages/db/scripts/apply-team-roles-migration.mjs
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
	"ALTER TABLE team_roles ADD COLUMN IF NOT EXISTS permissions text",
	`UPDATE team_roles SET permissions = '${defaultPermissions.replace(/'/g, "''")}' WHERE permissions IS NULL OR permissions = ''`,
	`ALTER TABLE team_roles ALTER COLUMN permissions SET DEFAULT '${defaultPermissions.replace(/'/g, "''")}'`,
	`DO $$ BEGIN
		ALTER TABLE team_roles ALTER COLUMN permissions SET NOT NULL;
	EXCEPTION WHEN others THEN NULL;
	END $$`,
	`CREATE TABLE IF NOT EXISTS team_members (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
		user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		role_id uuid REFERENCES team_roles(id) ON DELETE SET NULL,
		workspace_role workspace_role NOT NULL DEFAULT 'member',
		joined_at timestamp DEFAULT now() NOT NULL
	)`,
	"CREATE UNIQUE INDEX IF NOT EXISTS team_member_unique ON team_members (team_id, user_id)",
	"ALTER TABLE team_members ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES team_roles(id) ON DELETE SET NULL",
	"ALTER TABLE whiteboard_members ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES team_roles(id) ON DELETE SET NULL",
];

try {
	for (const statement of statements) {
		await sql.unsafe(statement);
	}
	console.log("[skedra] Team-Rollen-Migration erfolgreich.");
} catch (error) {
	console.error("[skedra] Migration fehlgeschlagen:", error);
	process.exit(1);
} finally {
	await sql.end();
}
