import assert from "node:assert/strict";
import test from "node:test";
import { mcpConsentContentSecurityPolicy, mcpConsentHtml } from "./mcp-consent";

test("consent identifies the registered redirect host and escapes client data", () => {
	const html = mcpConsentHtml({
		clientName: '<script>alert("cursor")</script>',
		userName: "Test User",
		redirectUri: "https://oauth.example.test/callback?code=ignored",
		scopes: ["boards:read", "boards:write"],
		consentToken: "signed-token",
	});

	assert.match(html, /oauth\.example\.test/u);
	assert.doesNotMatch(html, /code=ignored/u);
	assert.doesNotMatch(html, /<script>/u);
	assert.match(html, /&lt;script&gt;/u);
});

test("consent warns about local callback clients", () => {
	const html = mcpConsentHtml({
		clientName: "Codex",
		userName: "Test User",
		redirectUri: "http://127.0.0.1:49152/callback",
		scopes: ["boards:read"],
		consentToken: "signed-token",
	});

	assert.match(html, /127\.0\.0\.1:49152/u);
	assert.match(html, /Lokale Anwendung/u);
});

test("consent marks dynamically registered clients as unverified", () => {
	const html = mcpConsentHtml({
		clientName: "Claude",
		userName: "Test User",
		redirectUri: "https://claude.ai/api/mcp/auth_callback",
		scopes: ["boards:read"],
		consentToken: "signed-token",
	});

	assert.match(html, /Nicht verifiziert/u);
	assert.doesNotMatch(html, /gehoert aber nicht zu Skedra/u);
});

test("consent warns when the redirect host imitates Skedra", () => {
	const html = mcpConsentHtml({
		clientName: "Claude",
		userName: "Test User",
		redirectUri: "https://skedra.xyz.attacker.example/callback",
		redirectLooksLikeSkedra: true,
		scopes: ["boards:read"],
		consentToken: "signed-token",
	});

	assert.match(html, /skedra\.xyz\.attacker\.example/u);
	assert.match(html, /gehoert aber nicht zu Skedra/u);
});

test("consent CSP permits only the registered OAuth callback target", () => {
	const policy = mcpConsentContentSecurityPolicy(
		"http://127.0.0.1:49152/callback/codex",
	);

	assert.match(policy, /form-action 'self' http:\/\/127\.0\.0\.1:49152/u);
	assert.doesNotMatch(policy, /https:/u);
});
