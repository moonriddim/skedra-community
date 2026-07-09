/**
 * Filtert Modell-Listen auf LLMs, die fuer Text-to-Diagram (JSON/Chat) sinnvoll sind.
 */

import type { SkedraAiProvider } from "./ai-providers";

/** Modelle die explizit nicht fuer Chat/JSON-Diagramme geeignet sind. */
const EXCLUDED_ID_PATTERNS = [
	/embed/i,
	/embedding/i,
	/bge-/i,
	/nomic-embed/i,
	/mxbai-embed/i,
	/all-minilm/i,
	/whisper/i,
	/tts/i,
	/transcribe/i,
	/dall-?e/i,
	/gpt-image/i,
	/sora/i,
	/flux/i,
	/stable-diffusion/i,
	/midjourney/i,
	/moderation/i,
	/rerank/i,
	/classifier/i,
	/guard/i,
	/safety/i,
	/audio/i,
	/realtime/i,
	/ocr/i,
	/vision-only/i,
];

/** OpenAI: nur aktuelle Chat-/Reasoning-Linien. */
const OPENAI_INCLUDED = /^(gpt-|o[134]|chatgpt-)/i;

/** Ollama/lokal: typische Embedding-/Spezial-Tags ausschliessen. */
const LOCAL_EXCLUDED = [
	/:-embed$/i,
	/embed$/i,
	/^embed-/i,
	/vision$/i, // reine Vision-Varianten — schlechter fuer JSON
];

/** Bekannte gute Defaults fuer Diagramm-Tasks (Sortierung oben). */
const PREFERRED_MODEL_HINTS = [
	"gpt-4o-mini",
	"gpt-4o",
	"gpt-4.1",
	"o4-mini",
	"o3-mini",
	"kimi-k2",
	"kimi",
	"moonshot",
	"deepseek-v4-flash",
	"deepseek-v4-pro",
	"deepseek-chat",
	"deepseek",
	"claude-3.5-sonnet",
	"claude-sonnet-4",
	"llama3.2",
	"llama3.1",
	"mistral",
	"qwen2.5",
	"deepseek",
	"gemma",
	"phi",
];

export type OpenRouterModelMeta = {
	id?: string;
	name?: string;
	architecture?: {
		modality?: string;
		output_modalities?: string[];
	};
};

function normalizeModelId(id: string) {
	return id.trim().toLowerCase();
}

function matchesAnyPattern(id: string, patterns: RegExp[]) {
	return patterns.some((pattern) => pattern.test(id));
}

/** Passt die Modell-ID fuer Text-to-Diagram? */
export function isDiagramSuitableModelId(
	id: string,
	provider?: SkedraAiProvider,
) {
	const normalized = normalizeModelId(id);
	if (!normalized) return false;

	if (matchesAnyPattern(normalized, EXCLUDED_ID_PATTERNS)) return false;

	if (provider === "openai") {
		return OPENAI_INCLUDED.test(id);
	}

	if (provider === "deepseek") {
		return /^deepseek/i.test(id);
	}

	if (provider === "kimi") {
		return /^(kimi|moonshot)/i.test(id);
	}

	if (provider === "ollama" || provider === "local") {
		if (matchesAnyPattern(normalized, LOCAL_EXCLUDED)) return false;
	}

	return true;
}

/** OpenRouter liefert modality-Metadaten — nur Text-Output behalten. */
export function isDiagramSuitableOpenRouterModel(entry: OpenRouterModelMeta) {
	const id = entry.id ?? entry.name ?? "";
	if (!isDiagramSuitableModelId(id, "openrouter")) return false;

	const modality = entry.architecture?.modality?.toLowerCase() ?? "";
	if (modality) {
		if (modality.includes("embed")) return false;
		if (modality.includes("->image") && !modality.includes("text"))
			return false;
		if (!modality.includes("text")) return false;
	}

	return true;
}

/** Sortiert empfohlene Modelle nach oben, Rest alphabetisch. */
export function sortDiagramModels(ids: string[]) {
	const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];

	return unique.sort((left, right) => {
		const leftNorm = normalizeModelId(left);
		const rightNorm = normalizeModelId(right);

		const leftScore = PREFERRED_MODEL_HINTS.findIndex((hint) =>
			leftNorm.includes(hint),
		);
		const rightScore = PREFERRED_MODEL_HINTS.findIndex((hint) =>
			rightNorm.includes(hint),
		);

		const leftRank = leftScore === -1 ? 999 : leftScore;
		const rightRank = rightScore === -1 ? 999 : rightScore;

		if (leftRank !== rightRank) return leftRank - rightRank;
		return left.localeCompare(right);
	});
}

export function filterDiagramSuitableModelIds(
	ids: string[],
	provider?: SkedraAiProvider,
) {
	return sortDiagramModels(
		ids.filter((id) => isDiagramSuitableModelId(id, provider)),
	);
}
