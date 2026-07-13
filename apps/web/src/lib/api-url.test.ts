import assert from "node:assert/strict";
import test from "node:test";
import { joinApiUrl, resolveApiBaseUrl, toWebSocketUrl } from "./api-url";

test("runtime API configuration wins and trailing slashes are normalized", () => {
	assert.equal(
		resolveApiBaseUrl(" https://api.example.com/ ", "https://build.invalid"),
		"https://api.example.com",
	);
	assert.equal(
		joinApiUrl("https://api.example.com/", "/api/trpc"),
		"https://api.example.com/api/trpc",
	);
});

test("same-origin API paths stay relative", () => {
	assert.equal(resolveApiBaseUrl("", ""), "");
	assert.equal(joinApiUrl("", "api/health"), "/api/health");
});

test("HTTP API URLs are converted to matching WebSocket URLs", () => {
	assert.equal(
		toWebSocketUrl("/api/boards/board-id/presence", "https://skedra.xyz"),
		"wss://skedra.xyz/api/boards/board-id/presence",
	);
	assert.equal(
		toWebSocketUrl(
			"http://api.example.com/api/boards/board-id/presence",
			"https://skedra.xyz",
		),
		"ws://api.example.com/api/boards/board-id/presence",
	);
});
