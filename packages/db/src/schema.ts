import { relations, sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	real,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

export const presentationShareAccessModeEnum = pgEnum(
	"presentation_share_access_mode",
	["always", "presentation-only"],
);

/** Excalidraw+: Workspace-Mitglied vs. Admin (Verwaltung, Einladungen). */
export const workspaceRoleEnum = pgEnum("workspace_role", ["member", "admin"]);

/** Excalidraw+: Kollaborations-Link (Gast ohne Workspace-Mitgliedschaft). */
export const collabShareAccessLevelEnum = pgEnum("collab_share_access_level", [
	"view",
	"edit",
]);

/** Wie Canvas-Inhalte eines Cloud-Boards verschluesselt werden. */
export const whiteboardEncryptionModeEnum = pgEnum(
	"whiteboard_encryption_mode",
	["server", "e2ee"],
);

/** Aktivitaetstypen fuer den Board-Activity-Feed */
export const whiteboardActivityTypeEnum = pgEnum("whiteboard_activity_type", [
	"board_created",
	"board_renamed",
	"board_archived",
	"board_restored",
	"board_deleted",
	"member_invited",
	"presentation_shared",
]);

export const integrationProviderEnum = pgEnum("integration_provider", [
	"notion",
	"obsidian",
]);

// ===== Auth (better-auth) =====

export const users = pgTable("users", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
	image: text("image"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	token: text("token").notNull().unique(),
	expiresAt: timestamp("expires_at").notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [index("sessions_user_idx").on(table.userId)]);

export const accounts = pgTable("accounts", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	scope: text("scope"),
	idToken: text("id_token"),
	password: text("password"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
	index("accounts_user_provider_idx").on(table.userId, table.providerId),
	index("accounts_provider_account_idx").on(table.providerId, table.accountId),
]);

export const verifications = pgTable("verifications", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
	index("verifications_identifier_idx").on(table.identifier),
]);

/** TOTP secret and encrypted recovery codes managed by Better Auth's 2FA plugin. */
export const twoFactors = pgTable(
	"two_factors",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		secret: text("secret").notNull(),
		backupCodes: text("backup_codes").notNull(),
		verified: boolean("verified").default(true).notNull(),
	},
	(table) => [index("two_factors_user_idx").on(table.userId)],
);

// ===== Instanz (Self-Hosting: SMTP, Admin) =====

/** Singleton pro Deployment — Mailversand und Admin-Zuordnung. */
export const instanceSettings = pgTable("instance_settings", {
	id: text("id").primaryKey().default("default"),
	adminUserId: text("admin_user_id").references(() => users.id, {
		onDelete: "set null",
	}),
	useCustomSmtp: boolean("use_custom_smtp").notNull().default(false),
	smtpHost: text("smtp_host"),
	smtpPort: integer("smtp_port"),
	smtpUser: text("smtp_user"),
	smtpFrom: text("smtp_from"),
	/** Verschlüsseltes SMTP-Passwort */
	encryptedSmtpPassword: text("encrypted_smtp_password"),
	smtpSecure: boolean("smtp_secure").notNull().default(false),
	useCustomCalls: boolean("use_custom_calls").notNull().default(false),
	callsEnabled: boolean("calls_enabled").notNull().default(false),
	callProvider: text("call_provider").notNull().default("none"),
	livekitUrl: text("livekit_url"),
	livekitApiKey: text("livekit_api_key"),
	/** Verschluesseltes LiveKit API Secret */
	encryptedLivekitApiSecret: text("encrypted_livekit_api_secret"),
	livekitTokenTtlSeconds: integer("livekit_token_ttl_seconds")
		.notNull()
		.default(3600),
	useCustomObjectStorage: boolean("use_custom_object_storage")
		.notNull()
		.default(false),
	objectStorageProvider: text("object_storage_provider")
		.notNull()
		.default("inline"),
	objectStoragePreset: text("object_storage_preset")
		.notNull()
		.default("custom"),
	objectStorageEndpoint: text("object_storage_endpoint"),
	objectStorageRegion: text("object_storage_region"),
	objectStorageBucket: text("object_storage_bucket"),
	objectStorageAccessKeyId: text("object_storage_access_key_id"),
	/** Encrypted S3-compatible Secret Access Key. */
	encryptedObjectStorageSecretAccessKey: text(
		"encrypted_object_storage_secret_access_key",
	),
	objectStoragePublicBaseUrl: text("object_storage_public_base_url"),
	objectStorageForcePathStyle: boolean("object_storage_force_path_style")
		.notNull()
		.default(false),
	/** Bei Mailfehlern: log = Server-Log, link = Link in der UI anzeigen */
	resetFallback: text("reset_fallback").notNull().default("log"),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** E-Mail-Benachrichtigungen pro User. */
export const userPreferences = pgTable("user_preferences", {
	userId: text("user_id")
		.primaryKey()
		.references(() => users.id, { onDelete: "cascade" }),
	emailOnMention: boolean("email_on_mention").notNull().default(true),
	emailOnCommentReply: boolean("email_on_comment_reply")
		.notNull()
		.default(true),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Client-side E2EE identity. Server stores only public key + encrypted private key. */
export const userE2eeIdentities = pgTable("user_e2ee_identities", {
	userId: text("user_id")
		.primaryKey()
		.references(() => users.id, { onDelete: "cascade" }),
	publicKey: text("public_key").notNull(),
	encryptedPrivateKey: text("encrypted_private_key").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ===== Whiteboards (Canvas) =====

export const whiteboards = pgTable(
	"whiteboards",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** Workspace, in dem dieses Board sichtbar ist. */
		teamId: uuid("team_id").references(() => teams.id, {
			onDelete: "set null",
		}),
		/** Optionaler Ordner/Collection innerhalb des Workspace-Dashboards. */
		folderId: uuid("folder_id").references(() => whiteboardFolders.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
		/** Bestehende Boards bleiben per Migration E2EE; neue Clients waehlen explizit. */
		encryptionMode: whiteboardEncryptionModeEnum("encryption_mode")
			.notNull()
			.default("e2ee"),
		presentationShareEnabled: boolean("presentation_share_enabled")
			.notNull()
			.default(false),
		presentationSharePresenceEnabled: boolean(
			"presentation_share_presence_enabled",
		)
			.notNull()
			.default(true),
		presentationShareAccessMode: presentationShareAccessModeEnum(
			"presentation_share_access_mode",
		)
			.notNull()
			.default("always"),
		presentationActiveUntil: timestamp("presentation_active_until"),
		presentationShareToken: text("presentation_share_token"),
		/** Excalidraw+-ähnlicher Kollaborations-Link (view/edit, Gäste) */
		collabShareEnabled: boolean("collab_share_enabled")
			.notNull()
			.default(false),
		collabShareToken: text("collab_share_token"),
		collabShareAccessLevel: collabShareAccessLevelEnum(
			"collab_share_access_level",
		)
			.notNull()
			.default("edit"),
		/** Separater, read-only Embed-Link fuer iframes/Notion/Docs. */
		embedShareEnabled: boolean("embed_share_enabled").notNull().default(false),
		embedShareToken: text("embed_share_token"),
		/**
		 * Browserseitiges E2EE: Y.js-Updates werden clientseitig verschluesselt
		 * und als Ciphertext in whiteboard_e2ee_updates gespeichert.
		 */
		e2eeKeyHint: text("e2ee_key_hint"),
		e2eeKeyHash: text("e2ee_key_hash"),
		e2eeCreatedAt: timestamp("e2ee_created_at"),
		/** Gesetzt wenn Board archiviert (Papierkorb) statt endgueltig geloescht */
		archivedAt: timestamp("archived_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("whiteboard_presentation_share_token_unique").on(
			table.presentationShareToken,
		),
		uniqueIndex("whiteboard_collab_share_token_unique").on(
			table.collabShareToken,
		),
		uniqueIndex("whiteboard_embed_share_token_unique").on(
			table.embedShareToken,
		),
		index("whiteboards_owner_archived_idx").on(
			table.ownerId,
			table.archivedAt,
		),
		index("whiteboards_team_archived_idx").on(
			table.teamId,
			table.archivedAt,
		),
		index("whiteboards_folder_idx").on(table.folderId),
	],
);

export const whiteboardE2eeUpdates = pgTable(
	"whiteboard_e2ee_updates",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		whiteboardId: uuid("whiteboard_id")
			.notNull()
			.references(() => whiteboards.id, { onDelete: "cascade" }),
		userId: text("user_id"),
		clientId: text("client_id").notNull(),
		/** JSON envelope: algorithm, iv, encrypted Y.js update */
		update: text("update").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("whiteboard_e2ee_updates_board_created_id_idx").on(
			table.whiteboardId,
			table.createdAt,
			table.id,
		),
	],
);

/** Client-encrypted image objects stored outside PostgreSQL. */
export const assets = pgTable(
	"assets",
	{
		id: uuid("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		whiteboardId: uuid("whiteboard_id")
			.notNull()
			.references(() => whiteboards.id, { onDelete: "cascade" }),
		kind: text("kind").notNull().default("image"),
		provider: text("provider").notNull(),
		bucket: text("bucket"),
		key: text("key").notNull(),
		publicUrl: text("public_url"),
		mimeType: text("mime_type").notNull().default("application/octet-stream"),
		sizeBytes: integer("size_bytes").notNull(),
		checksumSha256: text("checksum_sha256"),
		encryptionVersion: integer("encryption_version").notNull().default(1),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("assets_owner_idx").on(table.ownerId),
		index("assets_whiteboard_idx").on(table.whiteboardId),
		index("assets_key_idx").on(table.key),
	],
);

export const whiteboardKeyRecipients = pgTable(
	"whiteboard_key_recipients",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		whiteboardId: uuid("whiteboard_id")
			.notNull()
			.references(() => whiteboards.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** Client-encrypted boardKey envelope for this recipient. */
		encryptedBoardKey: text("encrypted_board_key").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("whiteboard_key_recipient_unique").on(
			table.whiteboardId,
			table.userId,
		),
		index("whiteboard_key_recipients_user_idx").on(table.userId),
	],
);

export const whiteboardMembers = pgTable(
	"whiteboard_members",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		whiteboardId: uuid("whiteboard_id")
			.notNull()
			.references(() => whiteboards.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** Zentrale Team-Rolle fuer direkte Board-Freigaben. */
		teamRoleId: uuid("team_role_id")
			.notNull()
			.references(() => teamRoles.id, {
				onDelete: "cascade",
			}),
		joinedAt: timestamp("joined_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("whiteboard_member_unique").on(
			table.whiteboardId,
			table.userId,
		),
		index("whiteboard_members_user_idx").on(table.userId),
	],
);

export const whiteboardActivities = pgTable("whiteboard_activities", {
	id: uuid("id").primaryKey().defaultRandom(),
	/** Nullable damit Eintraege nach endgueltigem Loeschen im Feed bleiben */
	whiteboardId: uuid("whiteboard_id").references(() => whiteboards.id, {
		onDelete: "set null",
	}),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	type: whiteboardActivityTypeEnum("type").notNull(),
	/** Optionale JSON-Metadaten (Name, E-Mail, …) */
	metadata: text("metadata"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
	index("whiteboard_activities_board_created_idx").on(
		table.whiteboardId,
		table.createdAt,
	),
	index("whiteboard_activities_user_created_idx").on(
		table.userId,
		table.createdAt,
	),
]);

/** Excalidraw-ähnliche Kommentar-Threads — verankert an Canvas-Koordinaten. */
export const whiteboardCommentThreads = pgTable("whiteboard_comment_threads", {
	id: uuid("id").primaryKey().defaultRandom(),
	whiteboardId: uuid("whiteboard_id")
		.notNull()
		.references(() => whiteboards.id, { onDelete: "cascade" }),
	/** Welt-Koordinaten auf dem Canvas */
	x: real("x").notNull(),
	y: real("y").notNull(),
	resolvedAt: timestamp("resolved_at"),
	createdById: text("created_by_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
	index("whiteboard_comment_threads_board_updated_idx").on(
		table.whiteboardId,
		table.updatedAt,
	),
	index("whiteboard_comment_threads_created_by_idx").on(table.createdById),
]);

/** Einzelne Nachrichten innerhalb eines Kommentar-Threads. */
export const whiteboardCommentMessages = pgTable(
	"whiteboard_comment_messages",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		threadId: uuid("thread_id")
			.notNull()
			.references(() => whiteboardCommentThreads.id, { onDelete: "cascade" }),
		authorId: text("author_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		body: text("body").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("whiteboard_comment_messages_thread_created_idx").on(
			table.threadId,
			table.createdAt,
		),
		index("whiteboard_comment_messages_author_idx").on(table.authorId),
	],
);

/** AI Text-to-Diagram Verlauf pro Board (nur fuer den jeweiligen User sichtbar). */
export const whiteboardAiMessages = pgTable("whiteboard_ai_messages", {
	id: uuid("id").primaryKey().defaultRandom(),
	whiteboardId: uuid("whiteboard_id")
		.notNull()
		.references(() => whiteboards.id, { onDelete: "cascade" }),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	role: text("role").notNull(),
	content: text("content").notNull(),
	model: text("model"),
	elementCount: integer("element_count"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
	index("whiteboard_ai_messages_board_user_created_idx").on(
		table.whiteboardId,
		table.userId,
		table.createdAt,
	),
	index("whiteboard_ai_messages_user_idx").on(table.userId),
]);

// ===== AI Settings (BYOK) =====

export const userAiSettings = pgTable("user_ai_settings", {
	userId: text("user_id")
		.primaryKey()
		.references(() => users.id, { onDelete: "cascade" }),
	provider: text("provider").notNull().default("openai"),
	/** Verschluesselter API-Key (DATA_ENCRYPTION_SECRET) */
	encryptedApiKey: text("encrypted_api_key").notNull(),
	/** Optionales Modell, z.B. gpt-4o-mini oder llama3.2 */
	model: text("model"),
	/** OpenAI-kompatible Endpoint-URL für Ollama / lokale LLMs */
	baseUrl: text("base_url"),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===== API Keys (Public API / MCP) =====

export const userApiKeys = pgTable(
	"user_api_keys",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** Anzeigename z.B. "Cursor Agent" */
		name: text("name").notNull(),
		/** Erste Zeichen des Keys zur Identifikation (sked_abc…) */
		keyPrefix: text("key_prefix").notNull(),
		/** SHA-256 Hash des vollstaendigen Keys */
		keyHash: text("key_hash").notNull().unique(),
		lastUsedAt: timestamp("last_used_at"),
		expiresAt: timestamp("expires_at"),
		revokedAt: timestamp("revoked_at"),
		/** JSON-Array von Scopes, z.B. ["boards:read","boards:write"] */
		scopes: text("scopes"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("user_api_key_prefix_unique").on(table.userId, table.keyPrefix),
	],
);

export const boardIntegrationSyncs = pgTable(
	"board_integration_syncs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		whiteboardId: uuid("whiteboard_id")
			.notNull()
			.references(() => whiteboards.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		provider: integrationProviderEnum("provider").notNull(),
		enabled: boolean("enabled").notNull().default(true),
		target: text("target").notNull(),
		/** Provider-spezifische JSON-Konfiguration ohne Secrets. */
		config: text("config").notNull().default("{}"),
		encryptedSecret: text("encrypted_secret"),
		lastSyncedAt: timestamp("last_synced_at"),
		lastSyncError: text("last_sync_error"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("board_integration_sync_unique").on(
			table.whiteboardId,
			table.userId,
			table.provider,
		),
		index("board_integration_sync_board_idx").on(table.whiteboardId),
		index("board_integration_sync_user_idx").on(table.userId),
	],
);

// ===== Teams (Workspaces) =====

export const teams = pgTable("teams", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	ownerId: text("owner_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("teams_owner_idx").on(table.ownerId)]);

/** Workspace-Ordner/Collections fuer Boards. */
export const whiteboardFolders = pgTable("whiteboard_folders", {
	id: uuid("id").primaryKey().defaultRandom(),
	teamId: uuid("team_id")
		.notNull()
		.references(() => teams.id, { onDelete: "cascade" }),
	ownerId: text("owner_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	parentId: uuid("parent_id"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
	index("whiteboard_folders_team_name_idx").on(table.teamId, table.name),
	index("whiteboard_folders_owner_idx").on(table.ownerId),
	index("whiteboard_folders_parent_idx").on(table.parentId),
]);

/** Benutzerdefinierte Rollen pro Workspace (Name + Farbe). */
export const teamRoles = pgTable("team_roles", {
	id: uuid("id").primaryKey().defaultRandom(),
	teamId: uuid("team_id")
		.notNull()
		.references(() => teams.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	/** Hex-Farbe, z. B. #6366f1 */
	color: text("color").notNull(),
	/** JSON: admin, manageWorkspaceAdmins, editCanvas, comment, ... */
	permissions: text("permissions").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
	index("team_roles_team_created_idx").on(table.teamId, table.createdAt),
]);

/** Welche zentralen Team-Rollen auf ein Board zugreifen duerfen. */
export const whiteboardTeamRoleAccess = pgTable(
	"whiteboard_team_role_access",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		whiteboardId: uuid("whiteboard_id")
			.notNull()
			.references(() => whiteboards.id, { onDelete: "cascade" }),
		teamRoleId: uuid("team_role_id")
			.notNull()
			.references(() => teamRoles.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("whiteboard_team_role_access_unique").on(
			table.whiteboardId,
			table.teamRoleId,
		),
		index("whiteboard_team_role_access_role_idx").on(table.teamRoleId),
	],
);

export const teamMembers = pgTable(
	"team_members",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		teamId: uuid("team_id")
			.notNull()
			.references(() => teams.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		roleId: uuid("role_id").references(() => teamRoles.id, {
			onDelete: "set null",
		}),
		/** member = Workspace-Nutzer, admin = darf Team verwalten & einladen */
		workspaceRole: workspaceRoleEnum("workspace_role")
			.notNull()
			.default("member"),
		joinedAt: timestamp("joined_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("team_member_unique").on(table.teamId, table.userId),
		index("team_members_user_workspace_role_idx").on(
			table.userId,
			table.workspaceRole,
		),
		index("team_members_team_role_idx").on(table.teamId, table.roleId),
	],
);

// ===== Managed billing (Stripe) =====

/**
 * The managed cloud workspace is the billable entity. Stripe remains the
 * financial source of truth; this is a webhook-synchronized entitlement cache
 * for authorizing Skedra features without calling Stripe during every request.
 */
export const workspaceSubscriptions = pgTable(
	"workspace_subscriptions",
	{
		teamId: uuid("team_id")
			.primaryKey()
			.references(() => teams.id, { onDelete: "cascade" }),
		stripeCustomerId: text("stripe_customer_id").notNull().unique(),
		stripeSubscriptionId: text("stripe_subscription_id").unique(),
		stripePriceId: text("stripe_price_id"),
		status: text("status").notNull().default("inactive"),
		cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
		currentPeriodEnd: timestamp("current_period_end"),
		/** Prevent out-of-order Stripe events from overwriting newer state. */
		lastStripeEventCreatedAt: timestamp("last_stripe_event_created_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [index("workspace_subscriptions_status_idx").on(table.status)],
);

/** Every registered SaaS user owns and pays for their own cloud entitlement. */
export const userSubscriptions = pgTable(
	"user_subscriptions",
	{
		userId: text("user_id")
			.primaryKey()
			.references(() => users.id, { onDelete: "cascade" }),
		stripeCustomerId: text("stripe_customer_id").notNull().unique(),
		stripeSubscriptionId: text("stripe_subscription_id").unique(),
		stripePriceId: text("stripe_price_id"),
		status: text("status").notNull().default("inactive"),
		cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
		currentPeriodEnd: timestamp("current_period_end"),
		lastStripeEventCreatedAt: timestamp("last_stripe_event_created_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [index("user_subscriptions_status_idx").on(table.status)],
);

/**
 * Founder-managed product access that doesn't create a Stripe customer or
 * invoice. Revoked grants are retained as an audit trail.
 */
export const complimentaryAccessGrants = pgTable(
	"complimentary_access_grants",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		reason: text("reason").notNull(),
		expiresAt: timestamp("expires_at"),
		grantedByEmail: text("granted_by_email").notNull(),
		revokedAt: timestamp("revoked_at"),
		revokedByEmail: text("revoked_by_email"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("complimentary_access_grants_user_idx").on(table.userId),
		index("complimentary_access_grants_revoked_idx").on(table.revokedAt),
		uniqueIndex("complimentary_access_grants_one_current_idx")
			.on(table.userId)
			.where(sql`${table.revokedAt} IS NULL`),
	],
);

/** Webhook event IDs make Stripe's at-least-once delivery safe to retry. */
export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
	id: text("id").primaryKey(),
	type: text("type").notNull(),
	livemode: boolean("livemode").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Pending Self-Host invites for users that do not have an account yet. */
export const registrationInvites = pgTable(
	"registration_invites",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		email: text("email").notNull(),
		token: text("token").notNull(),
		purpose: text("purpose").notNull().default("app"),
		invitedById: text("invited_by_id").references(() => users.id, {
			onDelete: "set null",
		}),
		teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
		teamRoleId: uuid("team_role_id").references(() => teamRoles.id, {
			onDelete: "set null",
		}),
		workspaceRole: workspaceRoleEnum("workspace_role")
			.notNull()
			.default("member"),
		whiteboardId: uuid("whiteboard_id").references(() => whiteboards.id, {
			onDelete: "cascade",
		}),
		whiteboardTeamRoleId: uuid("whiteboard_team_role_id").references(
			() => teamRoles.id,
			{
				onDelete: "set null",
			},
		),
		acceptedAt: timestamp("accepted_at"),
		complimentaryAccessReason: text("complimentary_access_reason"),
		complimentaryAccessExpiresAt: timestamp("complimentary_access_expires_at"),
		complimentaryAccessGrantedByEmail: text(
			"complimentary_access_granted_by_email",
		),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("registration_invite_token_unique").on(table.token),
		index("registration_invite_email_idx").on(table.email),
		index("registration_invites_invited_by_idx").on(table.invitedById),
		index("registration_invites_team_idx").on(table.teamId),
		index("registration_invites_team_role_idx").on(table.teamRoleId),
		index("registration_invites_whiteboard_idx").on(table.whiteboardId),
		index("registration_invites_whiteboard_role_idx").on(
			table.whiteboardTeamRoleId,
		),
	],
);

// ===== Relations =====

export const usersRelations = relations(users, ({ one, many }) => ({
	ownedWhiteboards: many(whiteboards),
	whiteboardMemberships: many(whiteboardMembers),
	activities: many(whiteboardActivities),
	apiKeys: many(userApiKeys),
	aiSettings: one(userAiSettings),
	e2eeIdentity: one(userE2eeIdentities),
	whiteboardKeyRecipients: many(whiteboardKeyRecipients),
	personalShapeLibrary: one(personalShapeLibraries),
	whiteboardFolders: many(whiteboardFolders),
	ownedTeams: many(teams),
	teamMemberships: many(teamMembers),
	registrationInvitesSent: many(registrationInvites),
	commentThreadsCreated: many(whiteboardCommentThreads),
	commentMessagesAuthored: many(whiteboardCommentMessages),
	aiMessages: many(whiteboardAiMessages),
	assets: many(assets),
	sessions: many(sessions),
	accounts: many(accounts),
	preferences: one(userPreferences),
	subscription: one(userSubscriptions),
	complimentaryAccessGrants: many(complimentaryAccessGrants),
}));

export const instanceSettingsRelations = relations(
	instanceSettings,
	({ one }) => ({
		admin: one(users, {
			fields: [instanceSettings.adminUserId],
			references: [users.id],
		}),
	}),
);

export const userPreferencesRelations = relations(
	userPreferences,
	({ one }) => ({
		user: one(users, {
			fields: [userPreferences.userId],
			references: [users.id],
		}),
	}),
);

export const userE2eeIdentitiesRelations = relations(
	userE2eeIdentities,
	({ one }) => ({
		user: one(users, {
			fields: [userE2eeIdentities.userId],
			references: [users.id],
		}),
	}),
);

export const whiteboardsRelations = relations(whiteboards, ({ one, many }) => ({
	owner: one(users, { fields: [whiteboards.ownerId], references: [users.id] }),
	team: one(teams, { fields: [whiteboards.teamId], references: [teams.id] }),
	folder: one(whiteboardFolders, {
		fields: [whiteboards.folderId],
		references: [whiteboardFolders.id],
	}),
	members: many(whiteboardMembers),
	teamRoleAccess: many(whiteboardTeamRoleAccess),
	activities: many(whiteboardActivities),
	commentThreads: many(whiteboardCommentThreads),
	aiMessages: many(whiteboardAiMessages),
	e2eeUpdates: many(whiteboardE2eeUpdates),
	assets: many(assets),
	keyRecipients: many(whiteboardKeyRecipients),
	integrationSyncs: many(boardIntegrationSyncs),
}));

export const whiteboardE2eeUpdatesRelations = relations(
	whiteboardE2eeUpdates,
	({ one }) => ({
		whiteboard: one(whiteboards, {
			fields: [whiteboardE2eeUpdates.whiteboardId],
			references: [whiteboards.id],
		}),
	}),
);

export const assetsRelations = relations(assets, ({ one }) => ({
	owner: one(users, {
		fields: [assets.ownerId],
		references: [users.id],
	}),
	whiteboard: one(whiteboards, {
		fields: [assets.whiteboardId],
		references: [whiteboards.id],
	}),
}));

export const whiteboardKeyRecipientsRelations = relations(
	whiteboardKeyRecipients,
	({ one }) => ({
		whiteboard: one(whiteboards, {
			fields: [whiteboardKeyRecipients.whiteboardId],
			references: [whiteboards.id],
		}),
		user: one(users, {
			fields: [whiteboardKeyRecipients.userId],
			references: [users.id],
		}),
	}),
);

export const whiteboardActivitiesRelations = relations(
	whiteboardActivities,
	({ one }) => ({
		whiteboard: one(whiteboards, {
			fields: [whiteboardActivities.whiteboardId],
			references: [whiteboards.id],
		}),
		user: one(users, {
			fields: [whiteboardActivities.userId],
			references: [users.id],
		}),
	}),
);

export const whiteboardMembersRelations = relations(
	whiteboardMembers,
	({ one }) => ({
		whiteboard: one(whiteboards, {
			fields: [whiteboardMembers.whiteboardId],
			references: [whiteboards.id],
		}),
		user: one(users, {
			fields: [whiteboardMembers.userId],
			references: [users.id],
		}),
		teamRole: one(teamRoles, {
			fields: [whiteboardMembers.teamRoleId],
			references: [teamRoles.id],
		}),
	}),
);

export const whiteboardCommentThreadsRelations = relations(
	whiteboardCommentThreads,
	({ one, many }) => ({
		whiteboard: one(whiteboards, {
			fields: [whiteboardCommentThreads.whiteboardId],
			references: [whiteboards.id],
		}),
		createdBy: one(users, {
			fields: [whiteboardCommentThreads.createdById],
			references: [users.id],
		}),
		messages: many(whiteboardCommentMessages),
	}),
);

export const whiteboardCommentMessagesRelations = relations(
	whiteboardCommentMessages,
	({ one }) => ({
		thread: one(whiteboardCommentThreads, {
			fields: [whiteboardCommentMessages.threadId],
			references: [whiteboardCommentThreads.id],
		}),
		author: one(users, {
			fields: [whiteboardCommentMessages.authorId],
			references: [users.id],
		}),
	}),
);

export const whiteboardAiMessagesRelations = relations(
	whiteboardAiMessages,
	({ one }) => ({
		whiteboard: one(whiteboards, {
			fields: [whiteboardAiMessages.whiteboardId],
			references: [whiteboards.id],
		}),
		user: one(users, {
			fields: [whiteboardAiMessages.userId],
			references: [users.id],
		}),
	}),
);

export const userApiKeysRelations = relations(userApiKeys, ({ one }) => ({
	user: one(users, { fields: [userApiKeys.userId], references: [users.id] }),
}));

export const boardIntegrationSyncsRelations = relations(
	boardIntegrationSyncs,
	({ one }) => ({
		whiteboard: one(whiteboards, {
			fields: [boardIntegrationSyncs.whiteboardId],
			references: [whiteboards.id],
		}),
		user: one(users, {
			fields: [boardIntegrationSyncs.userId],
			references: [users.id],
		}),
	}),
);

/** Persoenliche Shape-Bibliothek, serverseitig pro User synchronisiert. */
export const personalShapeLibraries = pgTable("personal_shape_libraries", {
	userId: text("user_id")
		.primaryKey()
		.references(() => users.id, { onDelete: "cascade" }),
	/** Serialisiertes PersonalShapeLibraryState JSON. */
	content: text("content").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Öffentliche Shape-Bibliotheken (.skedralib), gehostet unter /api/libraries/:slug */
export const publishedShapeLibraries = pgTable(
	"published_shape_libraries",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		description: text("description"),
		author: text("author"),
		/** Serialisiertes SkedraLibraryFile (JSON) */
		content: text("content").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		slugUnique: uniqueIndex("published_shape_libraries_slug_unique").on(
			table.slug,
		),
	}),
);

/** User-Einreichungen fuer den zentral moderierten Community-Katalog. */
export const librarySubmissions = pgTable(
	"library_submissions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		description: text("description"),
		author: text("author"),
		submitterName: text("submitter_name"),
		submitterEmail: text("submitter_email"),
		sourceInstanceUrl: text("source_instance_url"),
		/** pending | approved | rejected */
		status: text("status").notNull().default("pending"),
		reviewNote: text("review_note"),
		reviewedById: text("reviewed_by_id").references(() => users.id, {
			onDelete: "set null",
		}),
		reviewedAt: timestamp("reviewed_at"),
		/** Serialisiertes SkedraLibraryFile (JSON) */
		content: text("content").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		statusIdx: index("library_submissions_status_idx").on(table.status),
		userIdx: index("library_submissions_user_idx").on(table.userId),
	}),
);

export const userAiSettingsRelations = relations(userAiSettings, ({ one }) => ({
	user: one(users, { fields: [userAiSettings.userId], references: [users.id] }),
}));

export const personalShapeLibrariesRelations = relations(
	personalShapeLibraries,
	({ one }) => ({
		user: one(users, {
			fields: [personalShapeLibraries.userId],
			references: [users.id],
		}),
	}),
);

export const publishedShapeLibrariesRelations = relations(
	publishedShapeLibraries,
	({ one }) => ({
		owner: one(users, {
			fields: [publishedShapeLibraries.userId],
			references: [users.id],
		}),
	}),
);

export const librarySubmissionsRelations = relations(
	librarySubmissions,
	({ one }) => ({
		submitter: one(users, {
			fields: [librarySubmissions.userId],
			references: [users.id],
		}),
		reviewer: one(users, {
			fields: [librarySubmissions.reviewedById],
			references: [users.id],
		}),
	}),
);

export const teamsRelations = relations(teams, ({ one, many }) => ({
	owner: one(users, { fields: [teams.ownerId], references: [users.id] }),
	members: many(teamMembers),
	roles: many(teamRoles),
	folders: many(whiteboardFolders),
	whiteboards: many(whiteboards),
	subscription: one(workspaceSubscriptions),
}));

export const workspaceSubscriptionsRelations = relations(
	workspaceSubscriptions,
	({ one }) => ({
		team: one(teams, {
			fields: [workspaceSubscriptions.teamId],
			references: [teams.id],
		}),
	}),
);

export const userSubscriptionsRelations = relations(
	userSubscriptions,
	({ one }) => ({
		user: one(users, {
			fields: [userSubscriptions.userId],
			references: [users.id],
		}),
	}),
);

export const complimentaryAccessGrantsRelations = relations(
	complimentaryAccessGrants,
	({ one }) => ({
		user: one(users, {
			fields: [complimentaryAccessGrants.userId],
			references: [users.id],
		}),
	}),
);

export const whiteboardFoldersRelations = relations(
	whiteboardFolders,
	({ one, many }) => ({
		team: one(teams, {
			fields: [whiteboardFolders.teamId],
			references: [teams.id],
		}),
		owner: one(users, {
			fields: [whiteboardFolders.ownerId],
			references: [users.id],
		}),
		whiteboards: many(whiteboards),
	}),
);

export const teamRolesRelations = relations(teamRoles, ({ one, many }) => ({
	team: one(teams, { fields: [teamRoles.teamId], references: [teams.id] }),
	members: many(teamMembers),
	boardAccess: many(whiteboardTeamRoleAccess),
}));

export const whiteboardTeamRoleAccessRelations = relations(
	whiteboardTeamRoleAccess,
	({ one }) => ({
		whiteboard: one(whiteboards, {
			fields: [whiteboardTeamRoleAccess.whiteboardId],
			references: [whiteboards.id],
		}),
		teamRole: one(teamRoles, {
			fields: [whiteboardTeamRoleAccess.teamRoleId],
			references: [teamRoles.id],
		}),
	}),
);

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
	team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
	user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
	role: one(teamRoles, {
		fields: [teamMembers.roleId],
		references: [teamRoles.id],
	}),
}));

export const registrationInvitesRelations = relations(
	registrationInvites,
	({ one }) => ({
		invitedBy: one(users, {
			fields: [registrationInvites.invitedById],
			references: [users.id],
		}),
		team: one(teams, {
			fields: [registrationInvites.teamId],
			references: [teams.id],
		}),
		teamRole: one(teamRoles, {
			fields: [registrationInvites.teamRoleId],
			references: [teamRoles.id],
		}),
		whiteboard: one(whiteboards, {
			fields: [registrationInvites.whiteboardId],
			references: [whiteboards.id],
		}),
		whiteboardTeamRole: one(teamRoles, {
			fields: [registrationInvites.whiteboardTeamRoleId],
			references: [teamRoles.id],
		}),
	}),
);
