import {
	createHash,
	createHmac,
	randomBytes,
	randomUUID,
	timingSafeEqual,
} from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";
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
import {
	and,
	count,
	eq,
	gt,
	gte,
	inArray,
	isNull,
	lt,
	max,
	min,
	notExists,
	sql,
} from "drizzle-orm";
import { z } from "zod";
import { env } from "../env";

const AUTHORIZATION_CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REGISTRATIONS_PER_IP_PER_HOUR = 30;
/** Registrations that never led to a grant are removed after this age. */
const UNUSED_CLIENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;
const CLIENT_NAME_MAX_LENGTH = 120;
const DEFAULT_CLIENT_NAME = "MCP Client";

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
const SKEDRA_HOSTNAMES = new Set(
	[env.APP_URL, env.API_URL].map((value) => baseUrl(value).hostname),
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

// Lookalikes for the letters of "skedra" that NFKD folding does not map to ASCII.
const SKEDRA_CONFUSABLES = new Map<string, string>([
	["$", "s"],
	["5", "s"],
	["\u0455", "s"], // Cyrillic dze
	["\ua731", "s"], // Latin small capital s
	["\u043a", "k"], // Cyrillic ka
	["\u03ba", "k"], // Greek kappa
	["\u0138", "k"], // Latin kra
	["\u1d0b", "k"], // Latin small capital k
	["3", "e"],
	["\u0435", "e"], // Cyrillic ie
	["\u04bd", "e"], // Cyrillic abkhasian che
	["\u03b5", "e"], // Greek epsilon
	["\u212e", "e"], // Estimated sign
	["\u0501", "d"], // Cyrillic komi de
	["\u0433", "r"], // Cyrillic ghe
	["\u0280", "r"], // Latin small capital r
	["@", "a"],
	["4", "a"],
	["\u0430", "a"], // Cyrillic a
	["\u0251", "a"], // Latin alpha
	["\u03b1", "a"], // Greek alpha
]);

/** True when the text reads as "Skedra", including spacing, accent, and homoglyph tricks. */
export function impersonatesSkedra(value: string) {
	const skeleton = Array.from(
		value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase(),
		(char) => SKEDRA_CONFUSABLES.get(char) ?? char,
	)
		.join("")
		.replace(/[^a-z]/gu, "");
	return skeleton.includes("skedra");
}

/**
 * Client names come from unauthenticated registrations. Invisible formatting
 * (bidi overrides, zero-width characters) is removed so the consent screen
 * shows exactly what the user reads.
 */
export function normalizeMcpClientName(value: string | null | undefined) {
	const cleaned = (value ?? "")
		.normalize("NFKC")
		.replace(/\p{Cf}/gu, "")
		.replace(/[\s\p{Cc}]+/gu, " ")
		.trim();
	return (
		Array.from(cleaned).slice(0, CLIENT_NAME_MAX_LENGTH).join("").trim() ||
		DEFAULT_CLIENT_NAME
	);
}

/** Registrations from before the impersonation check are neutralized for display. */
function displayClientName(value: string) {
	const name = normalizeMcpClientName(value);
	return impersonatesSkedra(name) ? DEFAULT_CLIENT_NAME : name;
}

/** True for redirect hosts that look like Skedra but are not this instance. */
export function isSkedraLookalikeHost(hostname: string) {
	const host = hostname.toLowerCase();
	return !SKEDRA_HOSTNAMES.has(host) && impersonatesSkedra(host);
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
		clientName: displayClientName(row.clientName),
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
	const clientName = normalizeMcpClientName(input.clientName);
	if (impersonatesSkedra(clientName)) {
		throw new McpOAuthError(
			"invalid_client_metadata",
			"client_name darf nicht nach Skedra aussehen",
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
				clientName,
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

const consentSchema = z
	.object({
		type: z.literal("mcp-consent"),
		clientId: z.string().min(1),
		redirectUri: z.string().url(),
		codeChallenge: z.string().min(1),
		resource: z.string().url(),
		scopes: z.array(z.enum(skedraApiKeyScopes)).min(1),
		state: z.string().optional(),
		userId: z.string().min(1),
		issuedAt: z.number().int().nonnegative(),
		expiresAt: z.number().int().nonnegative(),
		nonce: z.string().min(1),
	})
	.strict();

type SignedConsent = z.infer<typeof consentSchema>;

function sign(value: string) {
	return createHmac("sha256", env.AUTH_SECRET)
		.update("skedra:mcp-consent:v1\0")
		.update(value)
		.digest("base64url");
}

export function createMcpConsentToken(
	request: McpAuthorizationRequest,
	userId: string,
) {
	const issuedAt = Date.now();
	const payload = consentSchema.parse({
		...request,
		type: "mcp-consent",
		userId,
		issuedAt,
		expiresAt: issuedAt + AUTHORIZATION_CODE_TTL_MS,
		nonce: randomBytes(16).toString("base64url"),
	});
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `${encoded}.${sign(encoded)}`;
}

export function verifyMcpConsentToken(token: string, userId: string) {
	const parts = token.split(".");
	const [encoded, suppliedSignature] = parts;
	if (parts.length !== 2 || !encoded || !suppliedSignature) {
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
	let payload: SignedConsent;
	try {
		payload = consentSchema.parse(
			JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
		);
	} catch {
		throw new McpOAuthError("invalid_request", "Ungueltige Freigabe");
	}
	const now = Date.now();
	if (
		payload.userId !== userId ||
		payload.issuedAt > now ||
		payload.expiresAt <= now ||
		payload.expiresAt <= payload.issuedAt ||
		payload.expiresAt - payload.issuedAt > AUTHORIZATION_CODE_TTL_MS
	) {
		throw new McpOAuthError("invalid_request", "Freigabe ist abgelaufen");
	}
	normalizeResource(payload.resource);
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

/**
 * Serializes grant changes per client: code and refresh exchanges share the
 * row lock, revocation takes it exclusively. A revocation therefore either sees
 * the tokens of an in-flight exchange or makes that exchange fail afterwards.
 */
async function lockMcpOauthClient(
	tx: Pick<Database, "select">,
	clientId: string,
	mode: "share" | "update",
) {
	await tx
		.select({ id: mcpOauthClients.id })
		.from(mcpOauthClients)
		.where(eq(mcpOauthClients.id, clientId))
		.for(mode);
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
		await lockMcpOauthClient(tx, input.clientId, "share");
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
		await lockMcpOauthClient(tx, input.clientId, "share");
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

/** Expands a valid IPv6 address, including "::" and an IPv4 tail, into eight groups. */
function ipv6Groups(address: string) {
	let hex = address;
	const embeddedIpv4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/u.exec(address);
	if (embeddedIpv4) {
		const [a, b, c, d] = embeddedIpv4.slice(1).map(Number);
		hex = `${address.slice(0, embeddedIpv4.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
	}
	const [head, tail] = hex.split("::");
	const left = head ? head.split(":") : [];
	const right = tail ? tail.split(":") : [];
	const zeros =
		tail === undefined ? [] : Array(8 - left.length - right.length).fill("0");
	return [...left, ...zeros, ...right].map((group) =>
		Number.parseInt(group, 16),
	);
}

/**
 * Rate-limit bucket for a registration source. IPv4 stays as-is; IPv6 is
 * grouped by /64 because one host or connection usually controls a whole /64
 * and could otherwise rotate addresses to bypass the limit.
 */
export function mcpRegistrationRateLimitKey(value: string) {
	const address = value
		.trim()
		.replace(/^\[(.*)\]$/u, "$1")
		.split("%")[0];
	if (isIPv4(address)) return address;
	if (!isIPv6(address)) return value.trim();
	const groups = ipv6Groups(address);
	if (
		groups.slice(0, 5).every((group) => group === 0) &&
		groups[5] === 0xffff
	) {
		// IPv4-mapped addresses share the bucket of the plain IPv4 address.
		return [
			groups[6] >> 8,
			groups[6] & 0xff,
			groups[7] >> 8,
			groups[7] & 0xff,
		].join(".");
	}
	return `${groups
		.slice(0, 4)
		.map((group) => group.toString(16))
		.join(":")}::/64`;
}

export function hashMcpRegistrationIp(value: string) {
	return createHmac("sha256", env.AUTH_SECRET)
		.update(mcpRegistrationRateLimitKey(value))
		.digest("hex");
}

function redirectHosts(serializedRedirectUris: string) {
	return [
		...new Set(
			(JSON.parse(serializedRedirectUris) as string[]).map(
				(uri) => new URL(uri).host,
			),
		),
	];
}

/** Active OAuth grants of a user, one entry per connected client. */
export async function listMcpConnections(db: Database, userId: string) {
	const active = await db
		.select({
			clientId: mcpOauthTokens.clientId,
			familyId: mcpOauthTokens.familyId,
			scopes: mcpOauthTokens.scopes,
		})
		.from(mcpOauthTokens)
		.where(
			and(
				eq(mcpOauthTokens.userId, userId),
				isNull(mcpOauthTokens.revokedAt),
				gt(mcpOauthTokens.expiresAt, new Date()),
			),
		);
	if (active.length === 0) return [];

	const scopesByClient = new Map<string, Set<SkedraApiKeyScope>>();
	for (const token of active) {
		const scopes = scopesByClient.get(token.clientId) ?? new Set();
		for (const scope of parseApiKeyScopes(token.scopes)) scopes.add(scope);
		scopesByClient.set(token.clientId, scopes);
	}
	// Rotated tokens stay in their family, so its oldest token marks the grant.
	const grants = await db
		.select({
			clientId: mcpOauthClients.id,
			clientName: mcpOauthClients.clientName,
			redirectUris: mcpOauthClients.redirectUris,
			connectedAt: min(mcpOauthTokens.createdAt),
			lastUsedAt: max(mcpOauthTokens.lastUsedAt),
		})
		.from(mcpOauthTokens)
		.innerJoin(mcpOauthClients, eq(mcpOauthClients.id, mcpOauthTokens.clientId))
		.where(
			and(
				eq(mcpOauthTokens.userId, userId),
				inArray(mcpOauthTokens.familyId, [
					...new Set(active.map((token) => token.familyId)),
				]),
			),
		)
		.groupBy(mcpOauthClients.id);

	const lastActivity = (grant: (typeof grants)[number]) =>
		(grant.lastUsedAt ?? grant.connectedAt)?.getTime() ?? 0;
	return grants
		.sort((a, b) => lastActivity(b) - lastActivity(a))
		.map((grant) => ({
			clientId: grant.clientId,
			clientName: displayClientName(grant.clientName),
			redirectHosts: redirectHosts(grant.redirectUris),
			scopes: skedraApiKeyScopes.filter((scope) =>
				scopesByClient.get(grant.clientId)?.has(scope),
			),
			connectedAt: grant.connectedAt,
			lastUsedAt: grant.lastUsedAt,
		}));
}

/**
 * Disconnects a client from the user's account: revokes all of its tokens and
 * voids authorization codes that have not been exchanged yet.
 */
export async function revokeMcpConnection(
	db: Database,
	userId: string,
	clientId: string,
) {
	return db.transaction(async (tx) => {
		await lockMcpOauthClient(tx, clientId, "update");
		const now = new Date();
		const revoked = await tx
			.update(mcpOauthTokens)
			.set({ revokedAt: now })
			.where(
				and(
					eq(mcpOauthTokens.userId, userId),
					eq(mcpOauthTokens.clientId, clientId),
					isNull(mcpOauthTokens.revokedAt),
				),
			)
			.returning({ id: mcpOauthTokens.id });
		await tx
			.update(mcpOauthAuthorizationCodes)
			.set({ usedAt: now })
			.where(
				and(
					eq(mcpOauthAuthorizationCodes.userId, userId),
					eq(mcpOauthAuthorizationCodes.clientId, clientId),
					isNull(mcpOauthAuthorizationCodes.usedAt),
				),
			);
		return revoked.length > 0;
	});
}

/** Deletes registrations that never led to a grant within the retention period. */
export async function pruneUnusedMcpOauthClients(
	db: Database,
	now = new Date(),
) {
	const removed = await db
		.delete(mcpOauthClients)
		.where(
			and(
				lt(
					mcpOauthClients.createdAt,
					new Date(now.getTime() - UNUSED_CLIENT_RETENTION_MS),
				),
				notExists(
					db
						.select({ id: mcpOauthTokens.id })
						.from(mcpOauthTokens)
						.where(eq(mcpOauthTokens.clientId, mcpOauthClients.id)),
				),
				notExists(
					db
						.select({ codeHash: mcpOauthAuthorizationCodes.codeHash })
						.from(mcpOauthAuthorizationCodes)
						.where(
							and(
								eq(mcpOauthAuthorizationCodes.clientId, mcpOauthClients.id),
								gt(mcpOauthAuthorizationCodes.expiresAt, now),
							),
						),
				),
			),
		)
		.returning({ id: mcpOauthClients.id });
	return removed.length;
}

/** Runs the registration cleanup hourly; returns a stop function for shutdown. */
export function startMcpOauthMaintenance(db: Database) {
	let running: Promise<void> | undefined;
	const tick = () => {
		if (running) return;
		running = pruneUnusedMcpOauthClients(db)
			.then((removed) => {
				if (removed > 0) {
					console.log(
						`[skedra-mcp-oauth] Removed ${removed} unused client registration(s).`,
					);
				}
			})
			.catch((error) => {
				console.error("[skedra-mcp-oauth] Client cleanup failed", error);
			})
			.finally(() => {
				running = undefined;
			});
	};
	const initial = setTimeout(tick, 0);
	const interval = setInterval(tick, MAINTENANCE_INTERVAL_MS);
	initial.unref();
	interval.unref();
	return async () => {
		clearTimeout(initial);
		clearInterval(interval);
		await running;
	};
}
