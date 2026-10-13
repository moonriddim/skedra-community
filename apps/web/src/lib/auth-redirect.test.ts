import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthRedirect, twoFactorHandoffPath } from "./auth-redirect";

const sameOrigin = { app: "https://skedra.xyz", api: "https://skedra.xyz" };
const splitOrigins = {
	app: "https://skedra.xyz",
	api: "https://api.skedra.xyz",
};
const authorizeUrl =
	"https://skedra.xyz/api/oauth/authorize?client_id=c&state=s";
const library = { kind: "app", path: "/library" };

test("app paths stay client-side and keep query and fragment", () => {
	assert.deepEqual(resolveAuthRedirect("/board/1?view=2#k=v", sameOrigin), {
		kind: "app",
		path: "/board/1?view=2#k=v",
	});
	assert.deepEqual(
		resolveAuthRedirect("https://skedra.xyz/settings", sameOrigin),
		{ kind: "app", path: "/settings" },
	);
	assert.deepEqual(resolveAuthRedirect(null, sameOrigin), library);
});

test("OAuth authorize URLs load as server pages on the app or API origin", () => {
	assert.deepEqual(resolveAuthRedirect(authorizeUrl, sameOrigin), {
		kind: "server",
		url: authorizeUrl,
	});
	assert.deepEqual(
		resolveAuthRedirect("/api/oauth/authorize?client_id=c", sameOrigin),
		{
			kind: "server",
			url: "https://skedra.xyz/api/oauth/authorize?client_id=c",
		},
	);
	const splitAuthorizeUrl =
		"https://api.skedra.xyz/api/oauth/authorize?client_id=c";
	assert.deepEqual(resolveAuthRedirect(splitAuthorizeUrl, splitOrigins), {
		kind: "server",
		url: splitAuthorizeUrl,
	});
	assert.deepEqual(
		resolveAuthRedirect(
			"https://user:pass@skedra.xyz/api/oauth/authorize",
			sameOrigin,
		),
		{ kind: "server", url: "https://skedra.xyz/api/oauth/authorize" },
		"credentials in the URL are dropped",
	);
});

test("foreign, protocol-relative, and script targets fall back to the library", () => {
	for (const value of [
		"https://evil.example/phish",
		"//evil.example/phish",
		"/\\evil.example/phish",
		"https://skedra.xyz//evil.example/phish",
		"https://skedra.xyz/\\evil.example/phish",
		"/.//evil.example/phish",
		"https://skedra.xyz.evil.example/",
		"http://skedra.xyz/api/oauth/authorize?client_id=c",
		"javascript:alert(1)",
		"data:text/html,<script>alert(1)</script>",
		"blob:https://skedra.xyz/00000000-0000-0000-0000-000000000000",
	]) {
		assert.deepEqual(resolveAuthRedirect(value, sameOrigin), library, value);
	}
});

test("2FA handoff keeps the OAuth return URL and the E2EE key fragment", () => {
	const signIn = new URL("https://skedra.xyz/login");
	signIn.searchParams.set("redirect", authorizeUrl);
	const twoFactor = new URL(
		twoFactorHandoffPath(signIn.toString()),
		"https://skedra.xyz",
	);
	assert.equal(twoFactor.pathname, "/two-factor");
	assert.deepEqual(
		resolveAuthRedirect(twoFactor.searchParams.get("redirect"), sameOrigin),
		{ kind: "server", url: authorizeUrl },
	);

	assert.equal(
		twoFactorHandoffPath(
			"https://skedra.xyz/login?redirect=%2Fboard%2F1#skedraKey=secret",
		),
		"/two-factor?redirect=%2Fboard%2F1#skedraKey=secret",
	);
	assert.equal(
		twoFactorHandoffPath("https://skedra.xyz/login"),
		"/two-factor?redirect=%2Flibrary",
	);
});
