import {
	createHash,
	createHmac,
	randomBytes,
	randomUUID,
	timingSafeEqual,
} from "node:crypto";
import {
	type Database,
	mcpOauthAuthorizationCodes,
	mcpOauthClients,
	mcpOauthTokens,
	users,
} from "@skedra/db";
import {
	type SkedraApiKeyScope,
	parseApiKeyScopes,
	serializeApiKeyScopes,
	skedraApiKeyScopes,
} from "@skedra/shared";
import { and, count, eq, gt, gte, isNull, sql } from "drizzle-orm";
import { env } from "../env";

const AUTHORIZATION_CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REGISTRATIONS_PER_IP_PER_HOUR = 30;

/** Minimal scopes advertised to MCP clients for the normal read/edit workflow. */
export const MCP_OAUTH_SCOPES: SkedraApiKeyScope[] = [
	"boards:read",
	"boards:write",
];

/** Additional scopes remain requestable explicitly and are shown in consent. */
export const MCP_OAUTH_SUPPORTED_SCOPES = [...skedraApiKeyScopes];

function baseUrl(value: string) {
	return new URL("/", value);
}

export const MCP_OAUTH_ISSUER = baseUrl(env.API_URL)
	.toString()
	.replace(/\/$/u, "");
export const MCP_DEFAULT_RESOURCE = new URL(
	"/api/mcp",
	baseUrl(env.APP_URL),
).toString();
export const MCP_ALLOWED_RESOURCES = new Set(
	[env.APP_URL, env.API_URL].map((value) =>
		new URL("/api/mcp", baseUrl(value)).toString(),
	),
);

export class McpOAuthError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly status: 400 | 401 | 403 | 429 = 400,
	) {
		super(message);
		this.name = "McpOAuthError";
	}
}

function hashSecret(value: string) {
	return createHash("sha256").update(value).digest("hex");
}

function randomSecret(prefix: string) {
	return `${prefix}${randomBytes(32).toString("base64url")}`;
}

function normalizeResource(value: string | null | undefined) {
	if (!value) throw new McpOAuthError("invalid_target", "resource fehlt");
	let resource: string;
	try {
		const url = new URL(value);
		url.hash = "";
		resource = url.toString();
	} catch {
		throw new McpOAuthError("invalid_target", "resource ist ungueltig");
	}
	if (!MCP_ALLOWED_RESOURCES.has(resource)) {
		throw new McpOAuthError("invalid_target", "resource ist nicht Skedra MCP");
	}
	return resource;
}

function normalizeScopes(value: string | null | undefined) {
	if (!value?.trim()) return [...MCP_OAUTH_SCOPES];
	const requested = [...new Set(value.trim().split(/\s+/u))];
	if (
		requested.length === 0 ||
		requested.some(
			(scope) => !skedraApiKeyScopes.includes(scope as SkedraApiKeyScope),
		)
	) {
		throw new McpOAuthError("invalid_scope", "Unbekannte MCP-Berechtigung");
	}
	return requested as SkedraApiKeyScope[];
}

function isSafeRedirectUri(value: string) {
	try {
		const url = new URL(value);
		if (url.hash) return false;
		if (url.protocol === "https:") return true;
		return (
			url.protocol === "http:" &&
			(url.hostname === "localhost" ||
				url.hostname === "127.0.0.1" ||
				url.hostname === "[::1]")
		);
	} catch {
		return false;
	}
}

export type RegisteredMcpOauthClient = {
	clientId: string;
	clientName: string;
	redirectUris: string[];
	clientUri: string | null;
	tokenEndpointAuthMethod: "none";
};

function deserializeClient(row: typeof mcpOauthClients.$inferSelect) {
	return {
		clientId: row.id,
		clientName: row.clientName,
		redirectUris: JSON.parse(row.redirectUris) as string[],
		clientUri: row.clientUri,
		tokenEndpointAuthMethod: "none" as const,
	};
}

export async function registerMcpOauthClient(
	db: Database,
	input: {
		clientName?: string;
		redirectUris: string[];
		clientUri?: string;
		tokenEndpointAuthMethod?: string;
		registrationIpHash?: string;
	},
) {
	if (
		input.redirectUris.length < 1 ||
		input.redirectUris.length > 10 ||
		input.redirectUris.some((uri) => !isSafeRedirectUri(uri))
	) {
		throw new McpOAuthError(
			"invalid_redirect_uri",
			"redirect_uris muessen HTTPS oder lokale Callback-URLs sein",
		);
	}
	if (
		input.tokenEndpointAuthMethod &&
		input.tokenEndpointAuthMethod !== "none"
	) {
		throw new McpOAuthError(
			"invalid_client_metadata",
			"Skedra MCP unterstuetzt oeffentliche OAuth-Clients mit PKCE",
		);
	}
	if (input.clientUri && !isSafeRedirectUri(input.clientUri)) {
		throw new McpOAuthError(
			"invalid_client_metadata",
			"client_uri ist ungueltig",
		);
	}

	return db.transaction(async (tx) => {
		if (input.registrationIpHash) {
			// Serialize the sliding-window count and insert for one IP. Without this
			// transaction-scoped lock, parallel DCR requests can all observe the same
			// pre-insert count and exceed the public registration limit.
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtextextended(${input.registrationIpHash}, 0))`,
			);
			const since = new Date(Date.now() - 60 * 60 * 1000);
			const [registrations] = await tx
				.select({ count: count() })
				.from(mcpOauthClients)
				.where(
					and(
						eq(mcpOauthClients.registrationIpHash, input.registrationIpHash),
						gte(mcpOauthClients.createdAt, since),
					),
				);
			if ((registrations?.count ?? 0) >= REGISTRATIONS_PER_IP_PER_HOUR) {
				throw new McpOAuthError(
					"temporarily_unavailable",
					"Zu viele Client-Registrierungen",
					429,
				);
			}
		}

		const clientId = randomSecret("skedra_mcp_client_");
		const [created] = await tx
			.insert(mcpOauthClients)
			.values({
				id: clientId,
				clientName: input.clientName?.trim().slice(0, 120) || "MCP Client",
				redirectUris: JSON.stringify([...new Set(input.redirectUris)]),
				clientUri: input.clientUri ?? null,
				tokenEndpointAuthMethod: "none",
				registrationIpHash: input.registrationIpHash ?? null,
			})
			.returning();
		return deserializeClient(created);
	});
}

export async function getMcpOauthClient(db: Database, clientId: string) {
	const row = await db.query.mcpOauthClients.findFirst({
		where: eq(mcpOauthClients.id, clientId),
	});
	return row ? deserializeClient(row) : null;
}

export function parseMcpAuthorizationRequest(input: {
	clientId?: string;
	redirectUri?: string;
	responseType?: string;
	codeChallenge?: string;
	codeChallengeMethod?: string;
	resource?: string;
	scope?: string;
	state?: string;
}) {
	if (!input.clientId)
		throw new McpOAuthError("invalid_request", "client_id fehlt");
	if (!input.redirectUri) {
		throw new McpOAuthError("invalid_request", "redirect_uri fehlt");
	}
	if (input.responseType !== "code") {
		throw new McpOAuthError(
			"unsupported_response_type",
			"Nur code wird unterstuetzt",
		);
	}
	if (!input.codeChallenge || input.codeChallengeMethod !== "S256") {
		throw new McpOAuthError("invalid_request", "PKCE S256 ist erforderlich");
	}
	return {
		clientId: input.clientId,
		redirectUri: input.redirectUri,
		codeChallenge: input.codeChallenge,
		resource: normalizeResource(input.resource),
		scopes: normalizeScopes(input.scope),
		state: input.state,
	};
}

export type McpAuthorizationRequest = ReturnType<
	typeof parseMcpAuthorizationRequest
>;

type SignedConsent = McpAuthorizationRequest & {
	userId: string;
	expiresAt: number;
	nonce: string;
};

function sign(value: string) {
	return createHmac("sha256", env.AUTH_SECRET)
		.update(value)
		.digest("base64url");
}

export function createMcpConsentToken(
	request: McpAuthorizationRequest,
	userId: string,
) {
	const payload: SignedConsent = {
		...request,
		userId,
		expiresAt: Date.now() + AUTHORIZATION_CODE_TTL_MS,
		nonce: randomBytes(16).toString("base64url"),
	};
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `${encoded}.${sign(encoded)}`;
}

export function verifyMcpConsentToken(token: string, userId: string) {
	const [encoded, suppliedSignature] = token.split(".");
	if (!encoded || !suppliedSignature) {
		throw new McpOAuthError("invalid_request", "Ungueltige Freigabe");
	}
	const expected = Buffer.from(sign(encoded));
	const supplied = Buffer.from(suppliedSignature);
	if (
		expected.length !== supplied.length ||
		!timingSafeEqual(expected, supplied)
	) {
		throw new McpOAuthError("invalid_request", "Ungueltige Freigabe");
	}
	const payload = JSON.parse(
		Buffer.from(encoded, "base64url").toString("utf8"),
	) as SignedConsent;
	if (payload.userId !== userId || payload.expiresAt < Date.now()) {
		throw new McpOAuthError("invalid_request", "Freigabe ist abgelaufen");
	}
	return payload;
}

export async function issueMcpAuthorizationCode(
	db: Database,
	input: SignedConsent,
) {
	const client = await getMcpOauthClient(db, input.clientId);
	if (!client || !client.redirectUris.includes(input.redirectUri)) {
		throw new McpOAuthError("invalid_client", "OAuth-Client ist ungueltig");
	}
	const code = randomSecret("skm_code_");
	await db.insert(mcpOauthAuthorizationCodes).values({
		codeHash: hashSecret(code),
		userId: input.userId,
		clientId: input.clientId,
		redirectUri: input.redirectUri,
		resource: normalizeResource(input.resource),
		codeChallenge: input.codeChallenge,
		scopes: serializeApiKeyScopes(input.scopes),
		expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS),
	});
	return code;
}

function verifyPkce(codeVerifier: string, expectedChallenge: string) {
	const challenge = createHash("sha256")
		.update(codeVerifier)
		.digest("base64url");
	const actual = Buffer.from(challenge);
	const expected = Buffer.from(expectedChallenge);
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function insertTokenPair(
	db: Pick<Database, "insert">,
	input: {
		userId: string;
		clientId: string;
		resource: string;
		scopes: SkedraApiKeyScope[];
		familyId?: string;
	},
) {
	const accessToken = randomSecret("skm_at_");
	const refreshToken = randomSecret("skm_rt_");
	const familyId = input.familyId ?? randomUUID();
	await db.insert(mcpOauthTokens).values([
		{
			familyId,
			kind: "access",
			tokenHash: hashSecret(accessToken),
			userId: input.userId,
			clientId: input.clientId,
			resource: input.resource,
			scopes: serializeApiKeyScopes(input.scopes),
			expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
		},
		{
			familyId,
			kind: "refresh",
			tokenHash: hashSecret(refreshToken),
			userId: input.userId,
			clientId: input.clientId,
			resource: input.resource,
			scopes: serializeApiKeyScopes(input.scopes),
			expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
		},
	]);
	return {
		access_token: accessToken,
		token_type: "Bearer" as const,
		expires_in: ACCESS_TOKEN_TTL_MS / 1000,
		refresh_token: refreshToken,
		scope: input.scopes.join(" "),
	};
}

export async function exchangeMcpAuthorizationCode(
	db: Database,
	input: {
		clientId: string;
		code: string;
		codeVerifier: string;
		redirectUri: string;
		resource?: string;
	},
) {
	const resource = normalizeResource(input.resource);
	const codeHash = hashSecret(input.code);
	return db.transaction(async (tx) => {
		const record = await tx.query.mcpOauthAuthorizationCodes.findFirst({
			where: eq(mcpOauthAuthorizationCodes.codeHash, codeHash),
		});
		if (
			!record ||
			record.usedAt ||
			record.expiresAt.getTime() <= Date.now() ||
			record.clientId !== input.clientId ||
			record.redirectUri !== input.redirectUri ||
			record.resource !== resource ||
			!verifyPkce(input.codeVerifier, record.codeChallenge)
		) {
			throw new McpOAuthError(
				"invalid_grant",
				"Autorisierungscode ist ungueltig",
			);
		}

		const [claimed] = await tx
			.update(mcpOauthAuthorizationCodes)
			.set({ usedAt: new Date() })
			.where(
				and(
					eq(mcpOauthAuthorizationCodes.codeHash, codeHash),
					isNull(mcpOauthAuthorizationCodes.usedAt),
					gt(mcpOauthAuthorizationCodes.expiresAt, new Date()),
				),
			)
			.returning({ codeHash: mcpOauthAuthorizationCodes.codeHash });
		if (!claimed) {
			throw new McpOAuthError(
				"invalid_grant",
				"Autorisierungscode wurde verwendet",
			);
		}
		return insertTokenPair(tx, {
			userId: record.userId,
			clientId: record.clientId,
			resource,
			scopes: parseApiKeyScopes(record.scopes),
		});
	});
}

export async function exchangeMcpRefreshToken(
	db: Database,
	input: {
		clientId: string;
		refreshToken: string;
		resource?: string;
		scope?: string;
	},
) {
	const resource = normalizeResource(input.resource);
	const tokenHash = hashSecret(input.refreshToken);
	const outcome = await db.transaction(async (tx) => {
		const record = await tx.query.mcpOauthTokens.findFirst({
			where: eq(mcpOauthTokens.tokenHash, tokenHash),
		});
		if (
			!record ||
			record.kind !== "refresh" ||
			record.clientId !== input.clientId ||
			record.resource !== resource ||
			record.expiresAt.getTime() <= Date.now()
		) {
			throw new McpOAuthError("invalid_grant", "Refresh-Token ist ungueltig");
		}

		const revokeFamily = () =>
			tx
				.update(mcpOauthTokens)
				.set({ revokedAt: new Date() })
				.where(eq(mcpOauthTokens.familyId, record.familyId));
		if (record.revokedAt) {
			await revokeFamily();
			return { replayed: true as const };
		}

		const originalScopes = parseApiKeyScopes(record.scopes);
		const scopes = input.scope ? normalizeScopes(input.scope) : originalScopes;
		if (scopes.some((scope) => !originalScopes.includes(scope))) {
			throw new McpOAuthError(
				"invalid_scope",
				"Scope-Erweiterung ist nicht erlaubt",
			);
		}
		const [rotated] = await tx
			.update(mcpOauthTokens)
			.set({ revokedAt: new Date() })
			.where(
				and(eq(mcpOauthTokens.id, record.id), isNull(mcpOauthTokens.revokedAt)),
			)
			.returning({ id: mcpOauthTokens.id });
		if (!rotated) {
			await revokeFamily();
			return { replayed: true as const };
		}
		return {
			tokens: await insertTokenPair(tx, {
				userId: record.userId,
				clientId: record.clientId,
				resource,
				scopes,
				familyId: record.familyId,
			}),
		};
	});
	if ("replayed" in outcome) {
		throw new McpOAuthError(
			"invalid_grant",
			"Refresh-Token wurde wiederverwendet",
		);
	}
	return outcome.tokens;
}

export async function verifyMcpAccessToken(db: Database, plainToken: string) {
	if (!plainToken.startsWith("skm_at_")) {
		throw new McpOAuthError("invalid_token", "Access-Token ist ungueltig", 401);
	}
	const [record] = await db
		.select({
			id: mcpOauthTokens.id,
			clientId: mcpOauthTokens.clientId,
			resource: mcpOauthTokens.resource,
			scopes: mcpOauthTokens.scopes,
			expiresAt: mcpOauthTokens.expiresAt,
			userId: users.id,
			userName: users.name,
			userEmail: users.email,
			userImage: users.image,
		})
		.from(mcpOauthTokens)
		.innerJoin(users, eq(users.id, mcpOauthTokens.userId))
		.where(
			and(
				eq(mcpOauthTokens.tokenHash, hashSecret(plainToken)),
				eq(mcpOauthTokens.kind, "access"),
				isNull(mcpOauthTokens.revokedAt),
				gt(mcpOauthTokens.expiresAt, new Date()),
			),
		);
	if (!record) {
		throw new McpOAuthError(
			"invalid_token",
			"Access-Token ist abgelaufen",
			401,
		);
	}
	await db
		.update(mcpOauthTokens)
		.set({ lastUsedAt: new Date() })
		.where(eq(mcpOauthTokens.id, record.id));
	return {
		token: plainToken,
		clientId: record.clientId,
		scopes: parseApiKeyScopes(record.scopes),
		expiresAt: Math.floor(record.expiresAt.getTime() / 1000),
		resource: new URL(record.resource),
		user: {
			id: record.userId,
			name: record.userName,
			email: record.userEmail,
			image: record.userImage,
		},
	};
}

export async function revokeMcpOauthToken(
	db: Database,
	input: { clientId: string; token: string },
) {
	const record = await db.query.mcpOauthTokens.findFirst({
		where: eq(mcpOauthTokens.tokenHash, hashSecret(input.token)),
	});
	if (!record || record.clientId !== input.clientId) return;
	await db
		.update(mcpOauthTokens)
		.set({ revokedAt: new Date() })
		.where(eq(mcpOauthTokens.familyId, record.familyId));
}

export function hashMcpRegistrationIp(value: string) {
	return createHmac("sha256", env.AUTH_SECRET).update(value).digest("hex");
}
