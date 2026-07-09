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
	"whiteboard_role_id" uuid REFERENCES "whiteboard_roles"("id") ON DELETE set null,
	"board_access_level" "board_access_level",
	"accepted_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "registration_invite_token_unique"
	ON "registration_invites" ("token");

CREATE INDEX IF NOT EXISTS "registration_invite_email_idx"
	ON "registration_invites" ("email");

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
	ADD COLUMN IF NOT EXISTS "e2ee_enabled" boolean DEFAULT false NOT NULL;

ALTER TABLE "whiteboards"
	ADD COLUMN IF NOT EXISTS "e2ee_key_hint" text;

ALTER TABLE "whiteboards"
	ADD COLUMN IF NOT EXISTS "e2ee_created_at" timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS "whiteboard_embed_share_token_unique"
	ON "whiteboards" ("embed_share_token");

UPDATE "whiteboards"
	SET "team_id" = "teams"."id"
	FROM "teams"
	WHERE "whiteboards"."team_id" IS NULL
		AND "teams"."owner_id" = "whiteboards"."owner_id";

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
