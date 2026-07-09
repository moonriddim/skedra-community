/** Unterstützte LLM-Anbieter für Text-to-Diagram. */
export const skedraAiProviders = [
	"openai",
	"openrouter",
	"deepseek",
	"kimi",
	"ollama",
	"local",
] as const;

export type SkedraAiProvider = (typeof skedraAiProviders)[number];

export const OLLAMA_DEFAULT_CHAT_URL =
	"http://127.0.0.1:11434/v1/chat/completions";
export const OLLAMA_DEFAULT_MODEL = "llama3.2";

export const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/v1/chat/completions";
export const DEEPSEEK_MODELS_URL = "https://api.deepseek.com/models";
export const DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-flash";

/** Moonshot/Kimi — internationaler Endpoint (OpenAI-kompatibel). */
export const KIMI_CHAT_URL = "https://api.moonshot.ai/v1/chat/completions";
export const KIMI_DEFAULT_MODEL = "kimi-k2";

export function isLocalAiProvider(provider: SkedraAiProvider) {
	return provider === "ollama" || provider === "local";
}

export function getDefaultAiModel(provider: SkedraAiProvider) {
	switch (provider) {
		case "openai":
			return "gpt-4o-mini";
		case "openrouter":
			return "openai/gpt-4o-mini";
		case "deepseek":
			return DEEPSEEK_DEFAULT_MODEL;
		case "kimi":
			return KIMI_DEFAULT_MODEL;
		case "ollama":
			return OLLAMA_DEFAULT_MODEL;
		case "local":
			return "local-model";
	}
}

/** Feste Chat-Endpoints fuer Cloud-Anbieter mit BYOK. */
export function getCloudProviderChatUrl(provider: SkedraAiProvider) {
	switch (provider) {
		case "openai":
			return "https://api.openai.com/v1/chat/completions";
		case "openrouter":
			return "https://openrouter.ai/api/v1/chat/completions";
		case "deepseek":
			return DEEPSEEK_CHAT_URL;
		case "kimi":
			return KIMI_CHAT_URL;
		default:
			return null;
	}
}

/** Normalisiert eine OpenAI-kompatible Base-URL auf /v1/chat/completions. */
export function normalizeOpenAiChatCompletionsUrl(baseUrl: string) {
	const trimmed = baseUrl.trim().replace(/\/+$/, "");
	if (trimmed.endsWith("/chat/completions")) return trimmed;
	if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
	return `${trimmed}/v1/chat/completions`;
}

/** OpenAI-kompatible /v1/models URL aus Chat- oder Base-URL ableiten. */
export function getOpenAiModelsUrl(baseUrl: string) {
	const trimmed = baseUrl.trim().replace(/\/+$/, "");
	if (trimmed.endsWith("/chat/completions")) {
		return trimmed.replace(/\/chat\/completions$/, "/models");
	}
	if (trimmed.endsWith("/v1")) return `${trimmed}/models`;
	if (trimmed.endsWith("/models")) return trimmed;
	return `${trimmed}/v1/models`;
}

/** Ollama /api/tags URL aus beliebiger Ollama-URL ableiten. */
export function getOllamaTagsUrl(baseUrl?: string | null) {
	const fallback = "http://127.0.0.1:11434";
	const raw =
		baseUrl?.trim() ||
		OLLAMA_DEFAULT_CHAT_URL.replace("/v1/chat/completions", "");
	try {
		const normalized = raw.includes("://") ? raw : `http://${raw}`;
		const origin = new URL(normalized).origin;
		return `${origin}/api/tags`;
	} catch {
		return `${fallback}/api/tags`;
	}
}
