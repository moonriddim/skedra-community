DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_role') THEN
		CREATE TYPE "workspace_role" AS ENUM ('member', 'admin');
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'collab_share_access_level') THEN
		CREATE TYPE "collab_share_access_level" AS ENUM ('view', 'edit');
	END IF;
END $$;

CREATE TABLE IF NOT EXISTS "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "team_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"permissions" text DEFAULT '{"admin":false,"manageWorkspaceAdmins":false,"editCanvas":true,"comment":true,"resolveComments":true,"inviteOthers":false,"manageShare":false,"manageMembers":false,"viewActivity":true,"useAi":true}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"role_id" uuid REFERENCES "team_roles"("id") ON DELETE set null,
	"workspace_role" "workspace_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_member_unique"
	ON "team_members" ("team_id", "user_id");

ALTER TABLE "team_roles"
	ADD COLUMN IF NOT EXISTS "permissions" text;

ALTER TABLE "team_roles"
	ALTER COLUMN "permissions" SET DEFAULT '{"admin":false,"manageWorkspaceAdmins":false,"editCanvas":true,"comment":true,"resolveComments":true,"inviteOthers":false,"manageShare":false,"manageMembers":false,"viewActivity":true,"useAi":true}';

UPDATE "team_roles"
	SET "permissions" = '{"admin":false,"manageWorkspaceAdmins":false,"editCanvas":true,"comment":true,"resolveComments":true,"inviteOthers":false,"manageShare":false,"manageMembers":false,"viewActivity":true,"useAi":true}'
	WHERE "permissions" IS NULL OR "permissions" = '';

ALTER TABLE "team_roles"
	ALTER COLUMN "permissions" SET NOT NULL;

ALTER TABLE "team_members"
	ADD COLUMN IF NOT EXISTS "role_id" uuid REFERENCES "team_roles"("id") ON DELETE set null;

ALTER TABLE "team_members"
	ADD COLUMN IF NOT EXISTS "workspace_role" "workspace_role" DEFAULT 'member' NOT NULL;

ALTER TABLE "whiteboards"
	ADD COLUMN IF NOT EXISTS "collab_share_access_level" "collab_share_access_level" DEFAULT 'edit' NOT NULL;

ALTER TABLE "whiteboards"
	ADD COLUMN IF NOT EXISTS "team_id" uuid REFERENCES "teams"("id") ON DELETE set null;

CREATE TABLE IF NOT EXISTS "registration_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"purpose" text DEFAULT 'app' NOT NULL,
	"invited_by_id" text REFERENCES "users"("id") ON DELETE set null,
	"team_id" uuid REFERENCES "teams"("id") ON DELETE cascade,
	"team_role_id" uuid REFERENCES "team_roles"("id") ON DELETE set null,
	"workspace_role" "workspace_role" DEFAULT 'member' NOT NULL,
	"whiteboard_id" uuid REFERENCES "whiteboards"("id") ON DELETE cascade,
	"whiteboard_team_role_id" uuid REFERENCES "team_roles"("id") ON DELETE set null,
	"accepted_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "registration_invite_token_unique"
	ON "registration_invites" ("token");

CREATE INDEX IF NOT EXISTS "registration_invite_email_idx"
	ON "registration_invites" ("email");

ALTER TABLE "registration_invites"
	ADD COLUMN IF NOT EXISTS "whiteboard_team_role_id" uuid REFERENCES "team_roles"("id") ON DELETE set null;

ALTER TABLE "whiteboard_members"
	ADD COLUMN IF NOT EXISTS "team_role_id" uuid;

ALTER TABLE "whiteboard_members"
	DROP CONSTRAINT IF EXISTS "whiteboard_members_team_role_id_team_roles_id_fk";

ALTER TABLE "whiteboard_members"
	DROP CONSTRAINT IF EXISTS "whiteboard_members_team_role_id_fkey";

ALTER TABLE "whiteboard_members"
	ADD CONSTRAINT "whiteboard_members_team_role_id_team_roles_id_fk"
	FOREIGN KEY ("team_role_id") REFERENCES "team_roles"("id") ON DELETE cascade;

UPDATE "team_roles"
	SET "permissions" = '{"admin":false,"manageWorkspaceAdmins":false,"editCanvas":true,"comment":true,"resolveComments":true,"inviteOthers":false,"manageShare":false,"manageMembers":false,"viewActivity":true,"useAi":true}'
	WHERE "permissions" IS NULL OR "permissions" = '';

INSERT INTO "team_roles" ("team_id", "name", "color", "permissions")
	SELECT "teams"."id", 'Mitglied', '#2563eb', '{"admin":false,"manageWorkspaceAdmins":false,"editCanvas":true,"comment":true,"resolveComments":true,"inviteOthers":false,"manageShare":false,"manageMembers":false,"viewActivity":true,"useAi":true}'
	FROM "teams"
	WHERE NOT EXISTS (
		SELECT 1 FROM "team_roles" WHERE "team_roles"."team_id" = "teams"."id"
	);

WITH "first_roles" AS (
	SELECT DISTINCT ON ("team_id") "id", "team_id"
	FROM "team_roles"
	ORDER BY "team_id", "created_at" ASC
)
UPDATE "team_members"
	SET "role_id" = "first_roles"."id"
	FROM "first_roles"
	WHERE "team_members"."team_id" = "first_roles"."team_id"
		AND "team_members"."role_id" IS NULL;

DO $$
DECLARE
	viewer_permissions text := '{"admin":false,"manageWorkspaceAdmins":false,"editCanvas":false,"comment":false,"resolveComments":false,"inviteOthers":false,"manageShare":false,"manageMembers":false,"viewActivity":true,"useAi":false}';
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'whiteboard_members'
			AND column_name = 'access_level'
	) THEN
		INSERT INTO "team_roles" ("team_id", "name", "color", "permissions")
			SELECT DISTINCT "whiteboards"."team_id", 'Betrachter', '#64748b', viewer_permissions
			FROM "whiteboard_members"
			INNER JOIN "whiteboards" ON "whiteboards"."id" = "whiteboard_members"."whiteboard_id"
			WHERE "whiteboards"."team_id" IS NOT NULL
				AND "whiteboard_members"."access_level"::text = 'view'
				AND NOT EXISTS (
					SELECT 1
					FROM "team_roles"
					WHERE "team_roles"."team_id" = "whiteboards"."team_id"
						AND "team_roles"."permissions" = viewer_permissions
				);

		WITH "viewer_roles" AS (
			SELECT DISTINCT ON ("team_id") "id", "team_id"
			FROM "team_roles"
			WHERE "permissions" = viewer_permissions
			ORDER BY "team_id", "created_at" ASC
		)
		UPDATE "whiteboard_members"
			SET "team_role_id" = "viewer_roles"."id"
			FROM "whiteboards", "viewer_roles"
			WHERE "whiteboard_members"."whiteboard_id" = "whiteboards"."id"
				AND "whiteboards"."team_id" = "viewer_roles"."team_id"
				AND "whiteboard_members"."access_level"::text = 'view'
				AND "whiteboard_members"."team_role_id" IS NULL;
	END IF;
END $$;

UPDATE "whiteboard_members"
	SET "team_role_id" = "team_members"."role_id"
	FROM "whiteboards", "team_members"
	WHERE "whiteboard_members"."whiteboard_id" = "whiteboards"."id"
		AND "whiteboards"."team_id" = "team_members"."team_id"
		AND "whiteboard_members"."user_id" = "team_members"."user_id"
		AND "whiteboard_members"."team_role_id" IS NULL
		AND "team_members"."role_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "whiteboard_team_role_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"whiteboard_id" uuid NOT NULL REFERENCES "whiteboards"("id") ON DELETE cascade,
	"team_role_id" uuid NOT NULL REFERENCES "team_roles"("id") ON DELETE cascade,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "whiteboard_team_role_access_unique"
	ON "whiteboard_team_role_access" ("whiteboard_id", "team_role_id");

INSERT INTO "whiteboard_team_role_access" ("whiteboard_id", "team_role_id")
	SELECT "whiteboards"."id", "team_roles"."id"
	FROM "whiteboards"
	INNER JOIN "team_roles" ON "team_roles"."team_id" = "whiteboards"."team_id"
	WHERE "whiteboards"."team_id" IS NOT NULL
	ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "library_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text REFERENCES "users"("id") ON DELETE cascade,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"author" text,
	"submitter_name" text,
	"submitter_email" text,
	"source_instance_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_by_id" text REFERENCES "users"("id") ON DELETE set null,
	"reviewed_at" timestamp,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "library_submissions"
	ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "library_submissions"
	ADD COLUMN IF NOT EXISTS "submitter_name" text;

ALTER TABLE "library_submissions"
	ADD COLUMN IF NOT EXISTS "submitter_email" text;

ALTER TABLE "library_submissions"
	ADD COLUMN IF NOT EXISTS "source_instance_url" text;

CREATE INDEX IF NOT EXISTS "library_submissions_status_idx"
	ON "library_submissions" ("status");

CREATE INDEX IF NOT EXISTS "library_submissions_user_idx"
	ON "library_submissions" ("user_id");

INSERT INTO "teams" ("name", "owner_id")
	SELECT "users"."name" || '''s Workspace', "users"."id"
	FROM "users"
	WHERE NOT EXISTS (
		SELECT 1 FROM "teams" WHERE "teams"."owner_id" = "users"."id"
	);

INSERT INTO "team_roles" ("team_id", "name", "color", "permissions")
	SELECT "teams"."id", 'Mitglied', '#2563eb', '{"admin":false,"manageWorkspaceAdmins":false,"editCanvas":true,"comment":true,"resolveComments":true,"inviteOthers":false,"manageShare":false,"manageMembers":false,"viewActivity":true,"useAi":true}'
	FROM "teams"
	WHERE NOT EXISTS (
		SELECT 1 FROM "team_roles" WHERE "team_roles"."team_id" = "teams"."id"
	);

WITH "first_roles" AS (
	SELECT DISTINCT ON ("team_id") "id", "team_id"
	FROM "team_roles"
	ORDER BY "team_id", "created_at" ASC
)
UPDATE "team_members"
	SET "role_id" = "first_roles"."id"
	FROM "first_roles"
	WHERE "team_members"."team_id" = "first_roles"."team_id"
		AND "team_members"."role_id" IS NULL;

CREATE TABLE IF NOT EXISTS "whiteboard_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
	"owner_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "whiteboards"
	ADD COLUMN IF NOT EXISTS "team_id" uuid REFERENCES "teams"("id") ON DELETE set null;

ALTER TABLE "whiteboards"
	ADD COLUMN IF NOT EXISTS "folder_id" uuid REFERENCES "whiteboard_folders"("id") ON DELETE set null;

ALTER TABLE "whiteboards"
	ADD COLUMN IF NOT EXISTS "embed_share_enabled" boolean DEFAULT false NOT NULL;

ALTER TABLE "whiteboards"
	ADD COLUMN IF NOT EXISTS "embed_share_token" text;

ALTER TABLE "whiteboards"
	ADD COLUMN IF NOT EXISTS "e2ee_key_hint" text;

ALTER TABLE "whiteboards"
	ADD COLUMN IF NOT EXISTS "e2ee_key_hash" text;

ALTER TABLE "whiteboards"
	ADD COLUMN IF NOT EXISTS "e2ee_created_at" timestamp;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whiteboard_encryption_mode') THEN
		CREATE TYPE "whiteboard_encryption_mode" AS ENUM ('server', 'e2ee');
	END IF;
END $$;

ALTER TABLE "whiteboards"
	ADD COLUMN IF NOT EXISTS "encryption_mode" "whiteboard_encryption_mode" DEFAULT 'e2ee' NOT NULL;

ALTER TABLE "whiteboards"
	DROP COLUMN IF EXISTS "e2ee_enabled";

ALTER TABLE "whiteboards"
	DROP COLUMN IF EXISTS "yjs_state";

CREATE UNIQUE INDEX IF NOT EXISTS "whiteboard_embed_share_token_unique"
	ON "whiteboards" ("embed_share_token");

UPDATE "whiteboards"
	SET "team_id" = "teams"."id"
	FROM "teams"
	WHERE "whiteboards"."team_id" IS NULL
		AND "teams"."owner_id" = "whiteboards"."owner_id";

DO $$
DECLARE
	viewer_permissions text := '{"admin":false,"manageWorkspaceAdmins":false,"editCanvas":false,"comment":false,"resolveComments":false,"inviteOthers":false,"manageShare":false,"manageMembers":false,"viewActivity":true,"useAi":false}';
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'whiteboard_members'
			AND column_name = 'access_level'
	) THEN
		INSERT INTO "team_roles" ("team_id", "name", "color", "permissions")
			SELECT DISTINCT "whiteboards"."team_id", 'Betrachter', '#64748b', viewer_permissions
			FROM "whiteboard_members"
			INNER JOIN "whiteboards" ON "whiteboards"."id" = "whiteboard_members"."whiteboard_id"
			WHERE "whiteboards"."team_id" IS NOT NULL
				AND "whiteboard_members"."access_level"::text = 'view'
				AND NOT EXISTS (
					SELECT 1
					FROM "team_roles"
					WHERE "team_roles"."team_id" = "whiteboards"."team_id"
						AND "team_roles"."permissions" = viewer_permissions
				);

		WITH "viewer_roles" AS (
			SELECT DISTINCT ON ("team_id") "id", "team_id"
			FROM "team_roles"
			WHERE "permissions" = viewer_permissions
			ORDER BY "team_id", "created_at" ASC
		)
		UPDATE "whiteboard_members"
			SET "team_role_id" = "viewer_roles"."id"
			FROM "whiteboards", "viewer_roles"
			WHERE "whiteboard_members"."whiteboard_id" = "whiteboards"."id"
				AND "whiteboards"."team_id" = "viewer_roles"."team_id"
				AND "whiteboard_members"."access_level"::text = 'view'
				AND "whiteboard_members"."team_role_id" IS NULL;
	END IF;
END $$;

UPDATE "whiteboard_members"
	SET "team_role_id" = "team_members"."role_id"
	FROM "whiteboards", "team_members"
	WHERE "whiteboard_members"."whiteboard_id" = "whiteboards"."id"
		AND "whiteboards"."team_id" = "team_members"."team_id"
		AND "whiteboard_members"."user_id" = "team_members"."user_id"
		AND "whiteboard_members"."team_role_id" IS NULL
		AND "team_members"."role_id" IS NOT NULL;

WITH "first_roles" AS (
	SELECT DISTINCT ON ("team_id") "id", "team_id"
	FROM "team_roles"
	ORDER BY "team_id", "created_at" ASC
)
UPDATE "whiteboard_members"
	SET "team_role_id" = "first_roles"."id"
	FROM "whiteboards", "first_roles"
	WHERE "whiteboard_members"."whiteboard_id" = "whiteboards"."id"
		AND "whiteboards"."team_id" = "first_roles"."team_id"
		AND "whiteboard_members"."team_role_id" IS NULL;

DELETE FROM "whiteboard_members"
	WHERE "team_role_id" IS NULL;

ALTER TABLE "whiteboard_members"
	ALTER COLUMN "team_role_id" SET NOT NULL;

ALTER TABLE "whiteboard_members"
	DROP COLUMN IF EXISTS "role_id";

ALTER TABLE "whiteboard_members"
	DROP COLUMN IF EXISTS "access_level";

ALTER TABLE "registration_invites"
	DROP COLUMN IF EXISTS "whiteboard_role_id";

ALTER TABLE "registration_invites"
	DROP COLUMN IF EXISTS "board_access_level";

DROP TABLE IF EXISTS "whiteboard_roles";

DROP TYPE IF EXISTS "board_access_level";

INSERT INTO "whiteboard_team_role_access" ("whiteboard_id", "team_role_id")
	SELECT "whiteboards"."id", "team_roles"."id"
	FROM "whiteboards"
	INNER JOIN "team_roles" ON "team_roles"."team_id" = "whiteboards"."team_id"
	WHERE "whiteboards"."team_id" IS NOT NULL
	ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "personal_shape_libraries" (
	"user_id" text PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "whiteboard_e2ee_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"whiteboard_id" uuid NOT NULL REFERENCES "whiteboards"("id") ON DELETE cascade,
	"user_id" text,
	"client_id" text NOT NULL,
	"update" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "whiteboard_e2ee_updates_board_created_idx"
	ON "whiteboard_e2ee_updates" ("whiteboard_id", "created_at");

CREATE INDEX IF NOT EXISTS "whiteboard_e2ee_updates_board_created_id_idx"
	ON "whiteboard_e2ee_updates" ("whiteboard_id", "created_at", "id");

CREATE TABLE IF NOT EXISTS "user_e2ee_identities" (
	"user_id" text PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"public_key" text NOT NULL,
	"encrypted_private_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "whiteboard_key_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"whiteboard_id" uuid NOT NULL REFERENCES "whiteboards"("id") ON DELETE cascade,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"encrypted_board_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "whiteboard_key_recipient_unique"
	ON "whiteboard_key_recipients" ("whiteboard_id", "user_id");

CREATE INDEX IF NOT EXISTS "whiteboard_key_recipients_user_idx"
	ON "whiteboard_key_recipients" ("user_id");

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_provider') THEN
		CREATE TYPE "integration_provider" AS ENUM ('notion', 'obsidian');
	END IF;
END $$;

CREATE TABLE IF NOT EXISTS "board_integration_syncs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"whiteboard_id" uuid NOT NULL REFERENCES "whiteboards"("id") ON DELETE cascade,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"provider" "integration_provider" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"target" text NOT NULL,
	"config" text DEFAULT '{}' NOT NULL,
	"encrypted_secret" text,
	"last_synced_at" timestamp,
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "board_integration_sync_unique"
	ON "board_integration_syncs" ("whiteboard_id", "user_id", "provider");

CREATE INDEX IF NOT EXISTS "board_integration_sync_board_idx"
	ON "board_integration_syncs" ("whiteboard_id");

CREATE TABLE IF NOT EXISTS "instance_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"admin_user_id" text REFERENCES "users"("id") ON DELETE set null,
	"use_custom_smtp" boolean DEFAULT false NOT NULL,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_user" text,
	"smtp_from" text,
	"encrypted_smtp_password" text,
	"smtp_secure" boolean DEFAULT false NOT NULL,
	"use_custom_calls" boolean DEFAULT false NOT NULL,
	"calls_enabled" boolean DEFAULT false NOT NULL,
	"call_provider" text DEFAULT 'none' NOT NULL,
	"livekit_url" text,
	"livekit_api_key" text,
	"encrypted_livekit_api_secret" text,
	"livekit_token_ttl_seconds" integer DEFAULT 3600 NOT NULL,
	"reset_fallback" text DEFAULT 'log' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "use_custom_calls" boolean DEFAULT false NOT NULL;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "calls_enabled" boolean DEFAULT false NOT NULL;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "call_provider" text DEFAULT 'none' NOT NULL;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "livekit_url" text;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "livekit_api_key" text;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "encrypted_livekit_api_secret" text;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "livekit_token_ttl_seconds" integer DEFAULT 3600 NOT NULL;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "use_custom_object_storage" boolean DEFAULT false NOT NULL;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "object_storage_provider" text DEFAULT 'inline' NOT NULL;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "object_storage_preset" text DEFAULT 'custom' NOT NULL;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "object_storage_endpoint" text;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "object_storage_region" text;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "object_storage_bucket" text;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "object_storage_access_key_id" text;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "encrypted_object_storage_secret_access_key" text;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "object_storage_public_base_url" text;

ALTER TABLE "instance_settings"
	ADD COLUMN IF NOT EXISTS "object_storage_force_path_style" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"whiteboard_id" uuid NOT NULL REFERENCES "whiteboards"("id") ON DELETE cascade,
	"kind" text DEFAULT 'image' NOT NULL,
	"provider" text NOT NULL,
	"bucket" text,
	"key" text NOT NULL,
	"public_url" text,
	"mime_type" text DEFAULT 'application/octet-stream' NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum_sha256" text,
	"encryption_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "assets_owner_idx" ON "assets" ("owner_id");
CREATE INDEX IF NOT EXISTS "assets_whiteboard_idx" ON "assets" ("whiteboard_id");
CREATE INDEX IF NOT EXISTS "assets_key_idx" ON "assets" ("key");

-- Managed Stripe Billing: harmless for self-hosted installs without Stripe,
-- but required for safe upgrades of hosted deployments.
CREATE TABLE IF NOT EXISTS "workspace_subscriptions" (
	"team_id" uuid PRIMARY KEY NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
	"stripe_customer_id" text UNIQUE NOT NULL,
	"stripe_subscription_id" text UNIQUE,
	"stripe_price_id" text,
	"status" text DEFAULT 'inactive' NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"current_period_end" timestamp,
	"last_stripe_event_created_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "workspace_subscriptions_status_idx"
	ON "workspace_subscriptions" ("status");

CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"livemode" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
