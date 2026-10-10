import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
	type Database,
	mcpOauthAuthorizationCodes,
	mcpOauthClients,
	mcpOauthTokens,
	users,
} from "@skedra/db";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import {
	MCP_DEFAULT_RESOURCE,
	MCP_OAUTH_SCOPES,
	McpOAuthError,
	createMcpConsentToken,
	exchangeMcpAuthorizationCode,
	exchangeMcpRefreshToken,
	hashMcpRegistrationIp,
	impersonatesSkedra,
	isSkedraLookalikeHost,
	issueMcpAuthorizationCode,
	listMcpConnections,
	mcpRegistrationRateLimitKey,
	normalizeMcpClientName,
	parseMcpAuthorizationRequest,
	pruneUnusedMcpOauthClients,
	registerMcpOauthClient,
	revokeMcpConnection,
	verifyMcpAccessToken,
	verifyMcpConsentToken,
} from "./mcp-oauth";

const validAuthorizationRequest = {
	clientId: "skedra_mcp_client_test",
	redirectUri: "http://127.0.0.1:49152/callback",
	responseType: "code",
	codeChallenge: "pkce-challenge",
	codeChallengeMethod: "S256",
	resource: MCP_DEFAULT_RESOURCE,
	scope: "boards:read boards:write",
	state: "opaque-state",
};

test("parses a PKCE-bound MCP authorization request", () => {
	const request = parseMcpAuthorizationRequest(validAuthorizationRequest);

	assert.equal(request.resource, MCP_DEFAULT_RESOURCE);
	assert.deepEqual(request.scopes, ["boards:read", "boards:write"]);
	assert.equal(request.state, "opaque-state");
});

test("defaults OAuth clients to read and write without destructive scopes", () => {
	const request = parseMcpAuthorizationRequest({
		...validAuthorizationRequest,
		scope: undefined,
	});

	assert.deepEqual(MCP_OAUTH_SCOPES, ["boards:read", "boards:write"]);
	assert.deepEqual(request.scopes, ["boards:read", "boards:write"]);
	assert.ok(!request.scopes.includes("boards:delete"));
});

test("rejects authorization requests without PKCE S256", () => {
	assert.throws(
		() =>
			parseMcpAuthorizationRequest({
				...validAuthorizationRequest,
				codeChallengeMethod: "plain",
			}),
		(error: unknown) =>
			error instanceof McpOAuthError && error.code === "invalid_request",
	);
});

test("rejects tokens requested for another resource", () => {
	assert.throws(
		() =>
			parseMcpAuthorizationRequest({
				...validAuthorizationRequest,
				resource: "https://example.com/api/mcp",
			}),
		(error: unknown) =>
			error instanceof McpOAuthError && error.code === "invalid_target",
	);
});

test("consent tokens are signed, user-bound, and tamper evident", () => {
	const request = parseMcpAuthorizationRequest(validAuthorizationRequest);
	const token = createMcpConsentToken(request, "user-one");

	assert.equal(
		verifyMcpConsentToken(token, "user-one").clientId,
		request.clientId,
	);
	assert.throws(() => verifyMcpConsentToken(token, "user-two"));
	assert.throws(() => verifyMcpConsentToken(`${token}x`, "user-one"));
});

const isOAuthError = (code: string) => (error: unknown) =>
	error instanceof McpOAuthError && error.code === code;

const skedraLookalikes = [
	"Skedra",
	"SKEDRA Official",
	"S k e d r a",
	"\u0405kedra", // Cyrillic capital dze
	"Sk3dra",
	"\uff33\uff4b\uff45\uff44\uff52\uff41", // fullwidth
	"Sk\u00e9dra",
	"S\u200bkedra", // zero-width space
];

test("Skedra impersonation check sees through spacing, accents, and homoglyphs", () => {
	for (const name of [...skedraLookalikes, "skedra.xyz.attacker.example"]) {
		assert.ok(impersonatesSkedra(name), name);
	}
	for (const name of ["Claude", "ChatGPT", "Cursor", "Codex", "Sketch Draw"]) {
		assert.ok(!impersonatesSkedra(name), name);
	}
});

test("client names lose invisible formatting and fall back when empty", () => {
	assert.equal(normalizeMcpClientName("Cl\u202eaude\u200b"), "Claude");
	assert.equal(
		normalizeMcpClientName("  Claude\n\tDesktop "),
		"Claude Desktop",
	);
	assert.equal(normalizeMcpClientName("\u200b\u200e"), "MCP Client");
	assert.equal(normalizeMcpClientName(undefined), "MCP Client");
	assert.equal(normalizeMcpClientName("x".repeat(500)).length, 120);
});

test("registration rejects names that imitate Skedra before any database access", async () => {
	const forbidden = new Proxy({} as Database, {
		get() {
			throw new Error("unexpected DB access");
		},
	});
	for (const clientName of skedraLookalikes) {
		await assert.rejects(
			registerMcpOauthClient(forbidden, {
				clientName,
				redirectUris: ["https://client.example.test/callback"],
			}),
			isOAuthError("invalid_client_metadata"),
			clientName,
		);
	}
});

test("redirect hosts that imitate Skedra are flagged unless they belong to this instance", () => {
	assert.equal(isSkedraLookalikeHost("skedra.xyz.attacker.example"), true);
	assert.equal(isSkedraLookalikeHost("login-sk3dra.example"), true);
	assert.equal(isSkedraLookalikeHost("claude.ai"), false);
	assert.equal(
		isSkedraLookalikeHost(new URL(MCP_DEFAULT_RESOURCE).hostname),
		false,
	);
});

test("registration rate limit groups IPv6 sources by /64", () => {
	assert.equal(mcpRegistrationRateLimitKey("203.0.113.42"), "203.0.113.42");
	assert.equal(
		mcpRegistrationRateLimitKey("::ffff:203.0.113.42"),
		"203.0.113.42",
	);
	assert.equal(
		mcpRegistrationRateLimitKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd"),
		"2001:db8:1:2::/64",
	);
	assert.equal(
		mcpRegistrationRateLimitKey("[2001:DB8:1:2::1]"),
		"2001:db8:1:2::/64",
	);
	assert.equal(mcpRegistrationRateLimitKey("fe80::1%eth0"), "fe80:0:0:0::/64");
	assert.equal(
		mcpRegistrationRateLimitKey("64:ff9b::192.0.2.1"),
		"64:ff9b:0:0::/64",
	);
	assert.equal(mcpRegistrationRateLimitKey("unknown"), "unknown");
	assert.notEqual(
		mcpRegistrationRateLimitKey("2001:db8:1:3::1"),
		mcpRegistrationRateLimitKey("2001:db8:1:2::1"),
	);
	assert.equal(
		hashMcpRegistrationIp("2001:db8:1:2::1"),
		hashMcpRegistrationIp("2001:db8:1:2:ffff::9"),
	);
});

async function oauthDatabase() {
	const pg = new PGlite();
	const migration = await readFile(
		new URL("../../../../deploy/db/selfhost-migrations.sql", import.meta.url),
		"utf8",
	);
	const start = migration.indexOf(
		'CREATE TABLE IF NOT EXISTS "mcp_oauth_clients"',
	);
	const end = migration.indexOf("-- Privacy-sparse launch funnel");
	assert.ok(start >= 0 && end > start, "MCP OAuth tables must be migrated");
	await pg.exec(
		"create table users (id text primary key, name text not null, email text not null, image text)",
	);
	await pg.exec(migration.slice(start, end));
	await pg.exec(
		"insert into users (id, name, email) values ('user-one', 'User One', 'one@example.test'), ('user-two', 'User Two', 'two@example.test')",
	);
	const db = drizzle(pg, {
		schema: {
			users,
			mcpOauthClients,
			mcpOauthAuthorizationCodes,
			mcpOauthTokens,
		},
	}) as unknown as Database;
	return { pg, db };
}

const codeVerifier =
	"connection-test-verifier-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ";

async function consentToAccess(
	db: Database,
	clientId: string,
	redirectUri: string,
) {
	const request = parseMcpAuthorizationRequest({
		clientId,
		redirectUri,
		responseType: "code",
		codeChallenge: createHash("sha256")
			.update(codeVerifier)
			.digest("base64url"),
		codeChallengeMethod: "S256",
		resource: MCP_DEFAULT_RESOURCE,
	});
	const consent = verifyMcpConsentToken(
		createMcpConsentToken(request, "user-one"),
		"user-one",
	);
	return issueMcpAuthorizationCode(db, consent);
}

function exchangeCode(
	db: Database,
	clientId: string,
	redirectUri: string,
	code: string,
) {
	return exchangeMcpAuthorizationCode(db, {
		clientId,
		code,
		codeVerifier,
		redirectUri,
		resource: MCP_DEFAULT_RESOURCE,
	});
}

test("connected apps list active grants and disconnecting cuts off access at once", async (t) => {
	const { pg, db } = await oauthDatabase();
	t.after(() => pg.close());
	const redirectUri = "https://claude.ai/api/mcp/auth_callback";
	const client = await registerMcpOauthClient(db, {
		clientName: "Claude",
		redirectUris: [redirectUri],
	});
	const initial = await exchangeCode(
		db,
		client.clientId,
		redirectUri,
		await consentToAccess(db, client.clientId, redirectUri),
	);
	const tokens = await exchangeMcpRefreshToken(db, {
		clientId: client.clientId,
		refreshToken: initial.refresh_token,
		resource: MCP_DEFAULT_RESOURCE,
	});
	await verifyMcpAccessToken(db, tokens.access_token);

	const connections = await listMcpConnections(db, "user-one");
	assert.equal(connections.length, 1, "rotation must not duplicate a grant");
	const [connection] = connections;
	assert.equal(connection?.clientId, client.clientId);
	assert.equal(connection?.clientName, "Claude");
	assert.deepEqual(connection?.redirectHosts, ["claude.ai"]);
	assert.deepEqual(connection?.scopes, ["boards:read", "boards:write"]);
	assert.ok(connection?.connectedAt instanceof Date);
	assert.ok(connection?.lastUsedAt instanceof Date);
	assert.deepEqual(await listMcpConnections(db, "user-two"), []);

	assert.equal(
		await revokeMcpConnection(db, "user-two", client.clientId),
		false,
		"other users cannot disconnect the grant",
	);
	// A consent given right before disconnecting must not mint a new grant.
	const pendingCode = await consentToAccess(db, client.clientId, redirectUri);
	assert.equal(
		await revokeMcpConnection(db, "user-one", client.clientId),
		true,
	);

	await assert.rejects(
		verifyMcpAccessToken(db, tokens.access_token),
		isOAuthError("invalid_token"),
	);
	await assert.rejects(
		exchangeMcpRefreshToken(db, {
			clientId: client.clientId,
			refreshToken: tokens.refresh_token,
			resource: MCP_DEFAULT_RESOURCE,
		}),
		isOAuthError("invalid_grant"),
	);
	await assert.rejects(
		exchangeCode(db, client.clientId, redirectUri, pendingCode),
		isOAuthError("invalid_grant"),
	);
	assert.deepEqual(await listMcpConnections(db, "user-one"), []);
	assert.equal(
		await revokeMcpConnection(db, "user-one", client.clientId),
		false,
	);
});

test("cleanup removes only stale registrations that never led to a grant", async (t) => {
	const { pg, db } = await oauthDatabase();
	t.after(() => pg.close());
	const redirectUri = "https://client.example.test/callback";
	const register = (clientName: string) =>
		registerMcpOauthClient(db, { clientName, redirectUris: [redirectUri] });
	const staleUnused = await register("Stale unused");
	const staleConnected = await register("Stale connected");
	const staleConsenting = await register("Stale consenting");
	const freshUnused = await register("Fresh unused");
	await exchangeCode(
		db,
		staleConnected.clientId,
		redirectUri,
		await consentToAccess(db, staleConnected.clientId, redirectUri),
	);
	await consentToAccess(db, staleConsenting.clientId, redirectUri);
	await db
		.update(mcpOauthClients)
		.set({ createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) })
		.where(
			inArray(mcpOauthClients.id, [
				staleUnused.clientId,
				staleConnected.clientId,
				staleConsenting.clientId,
			]),
		);

	assert.equal(await pruneUnusedMcpOauthClients(db), 1);
	const remaining = await db
		.select({ id: mcpOauthClients.id })
		.from(mcpOauthClients);
	assert.deepEqual(
		remaining.map((row) => row.id).sort(),
		[
			staleConnected.clientId,
			staleConsenting.clientId,
			freshUnused.clientId,
		].sort(),
	);
});
