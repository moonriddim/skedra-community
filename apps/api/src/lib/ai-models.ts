/**
 * Verfügbare Modelle von AI-Anbietern abfragen (OpenAI, OpenRouter, Ollama, lokal).
 * Es werden nur Chat-/JSON-taugliche Modelle angezeigt.
 */

import {
	filterDiagramSuitableModelIds,
	isDiagramSuitableOpenRouterModel,
} from "@skedra/shared/ai-model-filter";
import {
	DEEPSEEK_MODELS_URL,
	OLLAMA_DEFAULT_CHAT_URL,
	type SkedraAiProvider,
	getCloudProviderChatUrl,
	getOllamaTagsUrl,
	getOpenAiModelsUrl,
	normalizeOpenAiChatCompletionsUrl,
} from "@skedra/shared/ai-providers";

const FETCH_TIMEOUT_MS = 12_000;

function requireCloudProviderChatUrl(provider: SkedraAiProvider) {
	const url = getCloudProviderChatUrl(provider);
	if (!url) {
		throw new Error(`Keine Chat-URL fuer ${provider} konfiguriert.`);
	}
	return url;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

	try {
		const response = await fetch(url, { ...init, signal: controller.signal });
		const payload = (await response.json()) as T & {
			error?: { message?: string };
		};

		if (!response.ok) {
			const message =
				typeof payload === "object" &&
				payload &&
				"error" in payload &&
				payload.error &&
				typeof payload.error === "object" &&
				"message" in payload.error
					? String(payload.error.message)
					: `Anbieter antwortete mit ${response.status}`;
			throw new Error(message);
		}

		return payload;
	} finally {
		clearTimeout(timeout);
	}
}

async function fetchOpenAiModels(apiKey: string) {
	return fetchCloudProviderModels(
		requireCloudProviderChatUrl("openai"),
		apiKey,
		"openai",
	);
}

async function fetchCloudProviderModels(
	chatUrl: string,
	apiKey: string,
	provider: SkedraAiProvider,
	extraHeaders?: Record<string, string>,
) {
	const modelsUrl = getOpenAiModelsUrl(chatUrl);
	const payload = await fetchJson<{ data?: Array<{ id?: string }> }>(
		modelsUrl,
		{
			headers: {
				Authorization: `Bearer ${apiKey}`,
				...extraHeaders,
			},
		},
	);

	const ids = (payload.data ?? [])
		.map((entry) => entry.id)
		.filter(Boolean) as string[];
	return filterDiagramSuitableModelIds(ids, provider);
}

async function fetchDeepSeekModels(apiKey: string) {
	const payload = await fetchJson<{ data?: Array<{ id?: string }> }>(
		DEEPSEEK_MODELS_URL,
		{
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		},
	);

	const ids = (payload.data ?? [])
		.map((entry) => entry.id)
		.filter(Boolean) as string[];
	return filterDiagramSuitableModelIds(ids, "deepseek");
}

async function fetchOpenRouterModels(apiKey: string) {
	const payload = await fetchJson<{
		data?: Array<{
			id?: string;
			name?: string;
			architecture?: { modality?: string; output_modalities?: string[] };
		}>;
	}>("https://openrouter.ai/api/v1/models", {
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"HTTP-Referer": "https://skedra.app",
			"X-Title": "Skedra",
		},
	});

	const ids = (payload.data ?? [])
		.filter(isDiagramSuitableOpenRouterModel)
		.map((entry) => entry.id ?? entry.name)
		.filter(Boolean) as string[];

	return filterDiagramSuitableModelIds(ids, "openrouter");
}

async function fetchOllamaModels(baseUrl?: string | null) {
	const tagsUrl = getOllamaTagsUrl(baseUrl ?? OLLAMA_DEFAULT_CHAT_URL);
	const payload = await fetchJson<{
		models?: Array<{ name?: string; model?: string }>;
	}>(tagsUrl);

	const ids = (payload.models ?? [])
		.map((entry) => entry.name ?? entry.model)
		.filter(Boolean) as string[];

	return filterDiagramSuitableModelIds(ids, "ollama");
}

async function fetchOpenAiCompatibleModels(baseUrl: string, apiKey?: string) {
	const modelsUrl = getOpenAiModelsUrl(
		normalizeOpenAiChatCompletionsUrl(baseUrl),
	);
	const headers: Record<string, string> = {};
	if (apiKey && apiKey !== "local-only") {
		headers.Authorization = `Bearer ${apiKey}`;
	}

	const payload = await fetchJson<{ data?: Array<{ id?: string }> }>(
		modelsUrl,
		{ headers },
	);
	const ids = (payload.data ?? [])
		.map((entry) => entry.id)
		.filter(Boolean) as string[];

	if (ids.length > 0) {
		return filterDiagramSuitableModelIds(ids, "local");
	}

	return fetchOllamaModels(baseUrl);
}

export async function fetchAvailableAiModels(input: {
	provider: SkedraAiProvider;
	apiKey: string;
	baseUrl?: string | null;
}) {
	switch (input.provider) {
		case "openai":
			return fetchOpenAiModels(input.apiKey);
		case "openrouter":
			return fetchOpenRouterModels(input.apiKey);
		case "deepseek":
			return fetchDeepSeekModels(input.apiKey);
		case "kimi":
			return fetchCloudProviderModels(
				requireCloudProviderChatUrl("kimi"),
				input.apiKey,
				"kimi",
			);
		case "ollama":
			return fetchOllamaModels(input.baseUrl);
		case "local":
			if (!input.baseUrl?.trim()) {
				throw new Error("Für lokale LLMs ist eine Base-URL erforderlich.");
			}
			return fetchOpenAiCompatibleModels(input.baseUrl, input.apiKey);
		default:
			return [];
	}
}
