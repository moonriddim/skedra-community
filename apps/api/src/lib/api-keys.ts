/**
 * API-Key Erstellung, Validierung und Verwaltung.
 * Keys erben Board-Berechtigungen des Users, beschraenkt durch Scopes.
 */

import { createHash, randomBytes } from "node:crypto";
import { type Database, userApiKeys, users } from "@skedra/db";
import {
	SKEDRA_API_KEY_DEFAULT_SCOPES,
	SKEDRA_API_KEY_PREFIX,
	type SkedraApiKeyScope,
	isSkedraApiKey,
	parseApiKeyScopes,
	serializeApiKeyScopes,
	skedraApiKeyScopes,
} from "@skedra/shared";
import { and, desc, eq, isNull } from "drizzle-orm";

export type ApiKeyUser = {
	id: string;
	name: string;
	email: string;
	image: string | null;
};

export type AuthenticatedApiKey = {
	user: ApiKeyUser;
	keyId: string;
	scopes: SkedraApiKeyScope[];
};

function hashApiKey(plainKey: string) {
	return createHash("sha256").update(plainKey).digest("hex");
}

function generatePlainApiKey() {
	return `${SKEDRA_API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

function normalizeScopes(scopes?: SkedraApiKeyScope[]) {
	if (!scopes || scopes.length === 0) return [...SKEDRA_API_KEY_DEFAULT_SCOPES];
	const unique = [
		...new Set(scopes.filter((scope) => skedraApiKeyScopes.includes(scope))),
	];
	return unique.length > 0 ? unique : [...SKEDRA_API_KEY_DEFAULT_SCOPES];
}

/** Erstellt einen neuen API Key — Plaintext wird nur einmal zurueckgegeben. */
export async function createUserApiKey(
	db: Database,
	input: {
		userId: string;
		name: string;
		expiresAt?: Date | null;
		scopes?: SkedraApiKeyScope[];
	},
) {
	const plainKey = generatePlainApiKey();
	const keyHash = hashApiKey(plainKey);
	const keyPrefix = plainKey.slice(0, 16);
	const scopes = normalizeScopes(input.scopes);

	const [created] = await db
		.insert(userApiKeys)
		.values({
			userId: input.userId,
			name: input.name.trim(),
			keyPrefix,
			keyHash,
			expiresAt: input.expiresAt ?? null,
			scopes: serializeApiKeyScopes(scopes),
		})
		.returning({
			id: userApiKeys.id,
			name: userApiKeys.name,
			keyPrefix: userApiKeys.keyPrefix,
			expiresAt: userApiKeys.expiresAt,
			scopes: userApiKeys.scopes,
			createdAt: userApiKeys.createdAt,
		});

	return { ...created, scopes, plainKey };
}

export async function listUserApiKeys(db: Database, userId: string) {
	const rows = await db.query.userApiKeys.findMany({
		where: and(eq(userApiKeys.userId, userId), isNull(userApiKeys.revokedAt)),
		orderBy: desc(userApiKeys.createdAt),
		columns: {
			id: true,
			name: true,
			keyPrefix: true,
			lastUsedAt: true,
			expiresAt: true,
			scopes: true,
			createdAt: true,
		},
	});

	return rows.map((row) => ({
		...row,
		scopes: parseApiKeyScopes(row.scopes),
	}));
}

export async function revokeUserApiKey(
	db: Database,
	userId: string,
	keyId: string,
) {
	const [updated] = await db
		.update(userApiKeys)
		.set({ revokedAt: new Date() })
		.where(
			and(
				eq(userApiKeys.id, keyId),
				eq(userApiKeys.userId, userId),
				isNull(userApiKeys.revokedAt),
			),
		)
		.returning({ id: userApiKeys.id });

	return !!updated;
}

/** Authentifiziert Bearer-Token und gibt User + Scopes zurueck. */
export async function authenticateApiKey(
	db: Database,
	plainKey: string,
): Promise<AuthenticatedApiKey | null> {
	if (!isSkedraApiKey(plainKey)) return null;

	const keyHash = hashApiKey(plainKey);
	const record = await db.query.userApiKeys.findFirst({
		where: and(eq(userApiKeys.keyHash, keyHash), isNull(userApiKeys.revokedAt)),
		with: {
			user: {
				columns: { id: true, name: true, email: true, image: true },
			},
		},
	});

	if (!record) return null;
	if (record.expiresAt && record.expiresAt.getTime() < Date.now()) return null;

	await db
		.update(userApiKeys)
		.set({ lastUsedAt: new Date() })
		.where(eq(userApiKeys.id, record.id));

	return {
		keyId: record.id,
		user: record.user,
		scopes: parseApiKeyScopes(record.scopes),
	};
}

/** Laedt User fuer interne Permission-Checks. */
async function getApiKeyUserById(
	db: Database,
	userId: string,
): Promise<ApiKeyUser | null> {
	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
		columns: { id: true, name: true, email: true, image: true },
	});
	return user ?? null;
}
