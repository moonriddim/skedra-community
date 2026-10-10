import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { Database } from "@skedra/db";
import { env } from "../env";
import {
	authenticateInternalMcpApiToken,
	createInternalMcpApiToken,
} from "./mcp-internal-auth";
import {
	MCP_DEFAULT_RESOURCE,
	createMcpConsentToken,
	parseMcpAuthorizationRequest,
	verifyMcpConsentToken,
} from "./mcp-oauth";

const user = {
	id: "security-test-user",
	name: "Test",
	email: "test@example.test",
	image: null,
};
const db = {
	query: { users: { findFirst: async () => user } },
} as unknown as Database;
const request = parseMcpAuthorizationRequest({
	clientId: "test-client",
	redirectUri: "https://client.example.test/callback",
	responseType: "code",
	codeChallenge: "A".repeat(43),
	codeChallengeMethod: "S256",
	resource: MCP_DEFAULT_RESOURCE,
	scope: "boards:read",
});

function signed(payload: unknown, purpose: string) {
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
	const signature = createHmac("sha256", env.AUTH_SECRET)
		.update(purpose)
		.update(encoded)
		.digest("base64url");
	return `${encoded}.${signature}`;
}

test("consent and internal bearer tokens cannot be substituted in either direction", async () => {
	const consent = createMcpConsentToken(request, user.id);
	const internal = createInternalMcpApiToken({
		userId: user.id,
		scopes: ["boards:read"],
	});
	assert.equal(
		await authenticateInternalMcpApiToken(db, `ski_mcp_${consent}`),
		null,
	);
	assert.throws(() =>
		verifyMcpConsentToken(internal.slice("ski_mcp_".length), user.id),
	);
	assert.deepEqual(
		(await authenticateInternalMcpApiToken(db, internal))?.scopes,
		["boards:read"],
	);
	assert.deepEqual(verifyMcpConsentToken(consent, user.id).scopes, [
		"boards:read",
	]);
	assert.equal(
		await authenticateInternalMcpApiToken(db, `${internal}.extra`),
		null,
	);
	assert.equal(await authenticateInternalMcpApiToken(db, `${internal}x`), null);
	assert.throws(() => verifyMcpConsentToken(`${consent}.extra`, user.id));
});

test("internal tokens reject invalid scopes, claims and lifetimes even with a valid signature", async () => {
	const now = Date.now();
	const payload = {
		type: "internal-mcp",
		audience: "skedra-rest-api",
		userId: user.id,
		scopes: ["boards:read"],
		issuedAt: now,
		expiresAt: now + 60_000,
		nonce: "test-nonce",
	};
	const invalid = [
		{ scopes: undefined },
		{ scopes: null },
		{ scopes: [] },
		{ scopes: '["boards:read"]' },
		{ scopes: ["unknown"] },
		{ type: "mcp-consent" },
		{ audience: "other-service" },
		{ userId: "" },
		{ expiresAt: undefined },
		{ expiresAt: "forever" },
		{ expiresAt: now },
		{ expiresAt: now + 600_000 },
		{ issuedAt: now + 60_000 },
		{ unexpected: "claim" },
	];
	let lookups = 0;
	const neverDb = {
		query: {
			users: {
				findFirst: async () => {
					lookups++;
					return user;
				},
			},
		},
	} as unknown as Database;
	for (const override of invalid) {
		assert.equal(
			await authenticateInternalMcpApiToken(
				neverDb,
				`ski_mcp_${signed({ ...payload, ...override }, "skedra:internal-mcp:v1\0")}`,
			),
			null,
			JSON.stringify(override),
		);
	}
	assert.equal(lookups, 0);
	assert.equal(
		await authenticateInternalMcpApiToken(db, `ski_mcp_${signed(payload, "")}`),
		null,
		"legacy signatures must not be accepted",
	);
});

test("consent rejects malformed claims, wrong resources, expiration and legacy signatures", () => {
	const token = createMcpConsentToken(request, user.id);
	const payload = JSON.parse(
		Buffer.from(token.split(".")[0], "base64url").toString("utf8"),
	);
	for (const override of [
		{ scopes: undefined },
		{ scopes: [] },
		{ scopes: '["boards:read"]' },
		{ type: "internal-mcp" },
		{ expiresAt: undefined },
		{ expiresAt: Date.now() },
		{ expiresAt: Date.now() + 3_600_000 },
		{ issuedAt: Date.now() + 60_000 },
		{ resource: "https://other.example.test/api/mcp" },
		{ userId: "other-user" },
	]) {
		assert.throws(() =>
			verifyMcpConsentToken(
				signed({ ...payload, ...override }, "skedra:mcp-consent:v1\0"),
				user.id,
			),
		);
	}
	assert.throws(() => verifyMcpConsentToken(signed(payload, ""), user.id));
});

test("a valid internal token expires after one minute and cannot authenticate a deleted user", async (t) => {
	const now = Date.now();
	const clock = t.mock.method(Date, "now", () => now);
	const token = createInternalMcpApiToken({
		userId: user.id,
		scopes: ["boards:read"],
	});
	const missingUserDb = {
		query: { users: { findFirst: async () => undefined } },
	} as unknown as Database;
	assert.equal(
		await authenticateInternalMcpApiToken(missingUserDb, token),
		null,
	);
	clock.mock.mockImplementation(() => now + 59_999);
	assert.ok(await authenticateInternalMcpApiToken(db, token));
	clock.mock.mockImplementation(() => now + 60_000);
	assert.equal(await authenticateInternalMcpApiToken(db, token), null);
});
