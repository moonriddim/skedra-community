/**
 * Board-Rollen pro Canvas (whiteboard_roles) + FK auf whiteboard_members.
 * node packages/db/scripts/apply-board-roles-migration.mjs
 */

import postgres from "postgres";

const sql = postgres(
	process.env.DATABASE_URL ??
		"postgresql://skedra:skedra_secret@localhost:5434/skedra",
);

const defaultPermissions = JSON.stringify({
	editCanvas: true,
	comment: true,
	resolveComments: true,
	inviteOthers: false,
	manageShare: false,
	manageMembers: false,
	viewActivity: true,
	useAi: true,
});

const statements = [
	`CREATE TABLE IF NOT EXISTS whiteboard_roles (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		whiteboard_id uuid NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
		name text NOT NULL,
		color text NOT NULL,
		permissions text NOT NULL DEFAULT '${defaultPermissions.replace(/'/g, "''")}',
		created_at timestamp DEFAULT now() NOT NULL
	)`,
	"UPDATE whiteboard_members SET role_id = NULL WHERE role_id IS NOT NULL",
	"ALTER TABLE whiteboard_members DROP CONSTRAINT IF EXISTS whiteboard_members_role_id_fkey",
	"ALTER TABLE whiteboard_members DROP CONSTRAINT IF EXISTS whiteboard_members_role_id_team_roles_id_fk",
	"ALTER TABLE whiteboard_members DROP CONSTRAINT IF EXISTS whiteboard_members_role_id_whiteboard_roles_id_fk",
	`ALTER TABLE whiteboard_members
		ADD CONSTRAINT whiteboard_members_role_id_whiteboard_roles_id_fk
		FOREIGN KEY (role_id) REFERENCES whiteboard_roles(id) ON DELETE SET NULL`,
];

try {
	for (const statement of statements) {
		await sql.unsafe(statement);
	}
	console.log("[skedra] Board-Rollen-Migration erfolgreich.");
} catch (error) {
	console.error("[skedra] Migration fehlgeschlagen:", error);
	process.exit(1);
} finally {
	await sql.end();
}
