import { relations } from "drizzle-orm";
import {
	boolean,
	customType,
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

/** Binary-Typ fuer Y.js-State */
const bytea = customType<{ data: Uint8Array }>({
	dataType() {
		return "bytea";
	},
});

export const presentationShareAccessModeEnum = pgEnum(
	"presentation_share_access_mode",
	["always", "presentation-only"],
);

/** Excalidraw+: Workspace-Mitglied vs. Admin (Verwaltung, Einladungen). */
export const workspaceRoleEnum = pgEnum("workspace_role", ["member", "admin"]);

/** Excalidraw+: Zugriff auf ein Board — nur Ansicht oder Bearbeiten. */
export const boardAccessLevelEnum = pgEnum("board_access_level", [
	"view",
	"edit",
]);

/** Excalidraw+: Kollaborations-Link (Gast ohne Workspace-Mitgliedschaft). */
export const collabShareAccessLevelEnum = pgEnum("collab_share_access_level", [
	"view",
	"edit",
]);

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
});

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
});

export const verifications = pgTable("verifications", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
		e2eeEnabled: boolean("e2ee_enabled").notNull().default(false),
		e2eeKeyHint: text("e2ee_key_hint"),
		e2eeCreatedAt: timestamp("e2ee_created_at"),
		yjsState: bytea("yjs_state"),
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
		index("whiteboard_e2ee_updates_board_created_idx").on(
			table.whiteboardId,
			table.createdAt,
		),
	],
);

/** Rollen nur für dieses Board (nicht workspace-weit). */
export const whiteboardRoles = pgTable("whiteboard_roles", {
	id: uuid("id").primaryKey().defaultRandom(),
	whiteboardId: uuid("whiteboard_id")
		.notNull()
		.references(() => whiteboards.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	color: text("color").notNull(),
	/** JSON: BoardRolePermissions */
	permissions: text("permissions").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
		/** view = nur lesen, edit = Canvas bearbeiten (aus Rolle abgeleitet) */
		accessLevel: boardAccessLevelEnum("access_level").notNull().default("edit"),
		/** Board-Rolle auf diesem Canvas */
		roleId: uuid("role_id").references(() => whiteboardRoles.id, {
			onDelete: "set null",
		}),
		joinedAt: timestamp("joined_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("whiteboard_member_unique").on(
			table.whiteboardId,
			table.userId,
		),
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
});

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
});

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
});

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
});

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
});

/** Benutzerdefinierte Rollen pro Workspace (Name + Farbe). */
export const teamRoles = pgTable("team_roles", {
	id: uuid("id").primaryKey().defaultRandom(),
	teamId: uuid("team_id")
		.notNull()
		.references(() => teams.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	/** Hex-Farbe, z. B. #6366f1 */
	color: text("color").notNull(),
	/** JSON: editCanvas, comment, inviteOthers, useAi */
	permissions: text("permissions").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
	(table) => [uniqueIndex("team_member_unique").on(table.teamId, table.userId)],
);

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
		whiteboardRoleId: uuid("whiteboard_role_id").references(
			() => whiteboardRoles.id,
			{
				onDelete: "set null",
			},
		),
		boardAccessLevel: boardAccessLevelEnum("board_access_level"),
		acceptedAt: timestamp("accepted_at"),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("registration_invite_token_unique").on(table.token),
		index("registration_invite_email_idx").on(table.email),
	],
);

// ===== Relations =====

export const usersRelations = relations(users, ({ one, many }) => ({
	ownedWhiteboards: many(whiteboards),
	whiteboardMemberships: many(whiteboardMembers),
	activities: many(whiteboardActivities),
	apiKeys: many(userApiKeys),
	aiSettings: one(userAiSettings),
	personalShapeLibrary: one(personalShapeLibraries),
	whiteboardFolders: many(whiteboardFolders),
	ownedTeams: many(teams),
	teamMemberships: many(teamMembers),
	registrationInvitesSent: many(registrationInvites),
	commentThreadsCreated: many(whiteboardCommentThreads),
	commentMessagesAuthored: many(whiteboardCommentMessages),
	aiMessages: many(whiteboardAiMessages),
	sessions: many(sessions),
	accounts: many(accounts),
	preferences: one(userPreferences),
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

export const whiteboardsRelations = relations(whiteboards, ({ one, many }) => ({
	owner: one(users, { fields: [whiteboards.ownerId], references: [users.id] }),
	team: one(teams, { fields: [whiteboards.teamId], references: [teams.id] }),
	folder: one(whiteboardFolders, {
		fields: [whiteboards.folderId],
		references: [whiteboardFolders.id],
	}),
	members: many(whiteboardMembers),
	roles: many(whiteboardRoles),
	activities: many(whiteboardActivities),
	commentThreads: many(whiteboardCommentThreads),
	aiMessages: many(whiteboardAiMessages),
	e2eeUpdates: many(whiteboardE2eeUpdates),
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

export const whiteboardRolesRelations = relations(
	whiteboardRoles,
	({ one, many }) => ({
		whiteboard: one(whiteboards, {
			fields: [whiteboardRoles.whiteboardId],
			references: [whiteboards.id],
		}),
		members: many(whiteboardMembers),
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
		role: one(whiteboardRoles, {
			fields: [whiteboardMembers.roleId],
			references: [whiteboardRoles.id],
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
}));

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
}));

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
		whiteboardRole: one(whiteboardRoles, {
			fields: [registrationInvites.whiteboardRoleId],
			references: [whiteboardRoles.id],
		}),
	}),
);
