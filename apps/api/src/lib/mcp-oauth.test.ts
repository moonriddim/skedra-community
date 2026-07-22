import assert from "node:assert/strict";
import test from "node:test";
import {
	MCP_DEFAULT_RESOURCE,
	MCP_OAUTH_SCOPES,
	McpOAuthError,
	createMcpConsentToken,
	parseMcpAuthorizationRequest,
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
