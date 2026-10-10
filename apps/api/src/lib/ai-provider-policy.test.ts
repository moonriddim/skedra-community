import assert from "node:assert/strict";
import test from "node:test";
import type { Database } from "@skedra/db";
import { env } from "../env";
import { generateDiagramElements } from "./ai-diagram";
import { fetchAvailableAiModels } from "./ai-models";
import { assertAiBaseUrlAllowed } from "./ai-provider-policy";
import { upsertUserAiSettings } from "./ai-settings";

test("managed local AI is rejected before DB or network access, including defaults and DNS/redirect entry points", async (t) => {
	const originalMode = env.SKEDRA_DEPLOYMENT_MODE;
	env.SKEDRA_DEPLOYMENT_MODE = "managed";
	t.after(() => {
		env.SKEDRA_DEPLOYMENT_MODE = originalMode;
	});
	const fetch = t.mock.method(globalThis, "fetch", async () => {
		throw new Error("Unexpected network access");
	});
	for (const provider of ["local", "ollama"] as const) {
		for (const baseUrl of [
			undefined,
			null,
			"",
			"http://127.0.0.1:11434",
			"http://169.254.169.254",
			"https://custom.example.test",
		]) {
			assert.throws(
				() => assertAiBaseUrlAllowed(provider, baseUrl),
				/Selfhosting/,
			);
			await assert.rejects(
				fetchAvailableAiModels({ provider, baseUrl, apiKey: "local-only" }),
				/Selfhosting/,
			);
			await assert.rejects(
				generateDiagramElements({
					provider,
					baseUrl,
					apiKey: "local-only",
					prompt: "Draw a box",
				}),
				/Selfhosting/,
			);
			await assert.rejects(
				upsertUserAiSettings({} as Database, {
					userId: "user",
					provider,
					baseUrl,
				}),
				/Selfhosting/,
			);
		}
	}
	assert.equal(fetch.mock.callCount(), 0);
});

test("managed cloud requests use fixed URLs and reject redirects for models and generation", async (t) => {
	const originalMode = env.SKEDRA_DEPLOYMENT_MODE;
	env.SKEDRA_DEPLOYMENT_MODE = "managed";
	t.after(() => {
		env.SKEDRA_DEPLOYMENT_MODE = originalMode;
	});
	const fetch = t.mock.method(
		globalThis,
		"fetch",
		async (_url: unknown, init?: RequestInit) => {
			assert.equal(init?.redirect, "error");
			assert.ok(init?.signal);
			return new Response(
				JSON.stringify({
					data: [{ id: "gpt-4o" }],
					error: { message: "offline-test-response" },
				}),
				{ status: init?.method === "POST" ? 400 : 200 },
			);
		},
	);
	await fetchAvailableAiModels({
		provider: "openai",
		apiKey: "test",
		baseUrl: "http://127.0.0.1",
	});
	assert.equal(
		fetch.mock.calls[0].arguments[0],
		"https://api.openai.com/v1/models",
	);
	await assert.rejects(
		generateDiagramElements({
			provider: "openai",
			apiKey: "test",
			baseUrl: "http://127.0.0.1",
			prompt: "Draw a box",
		}),
		/offline-test-response/,
	);
	assert.equal(
		fetch.mock.calls[1].arguments[0],
		"https://api.openai.com/v1/chat/completions",
	);
});

test("selfhost keeps local model discovery, including the Ollama default", async (t) => {
	const originalMode = env.SKEDRA_DEPLOYMENT_MODE;
	env.SKEDRA_DEPLOYMENT_MODE = "selfhost";
	t.after(() => {
		env.SKEDRA_DEPLOYMENT_MODE = originalMode;
	});
	const fetch = t.mock.method(
		globalThis,
		"fetch",
		async () =>
			new Response(
				JSON.stringify({
					models: [{ name: "llama3.2" }],
					data: [{ id: "llama3.2" }],
				}),
			),
	);
	assert.doesNotThrow(() =>
		assertAiBaseUrlAllowed("local", "http://127.0.0.1:1234"),
	);
	await fetchAvailableAiModels({ provider: "ollama", apiKey: "local-only" });
	assert.equal(
		fetch.mock.calls[0].arguments[0],
		"http://127.0.0.1:11434/api/tags",
	);
	await fetchAvailableAiModels({
		provider: "local",
		apiKey: "local-only",
		baseUrl: "http://127.0.0.1:1234",
	});
	assert.equal(
		fetch.mock.calls[1].arguments[0],
		"http://127.0.0.1:1234/v1/models",
	);
});
