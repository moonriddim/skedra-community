/**
 * LLM-Aufruf: Text → Skedra-Canvas-Inhalte (alle Tools).
 */

import type { AddCanvasElementInput } from "@skedra/shared";
import {
	AI_SHOWCASE_APPENDIX,
	AI_SYSTEM_PROMPT,
	type AiGanttChartContext,
	type AiGenerationResult,
	type AiSequenceDiagramContext,
	buildIntegrationShowcaseFallback,
	detectMultiToolShowcaseIntent,
	enrichPromptWithIntent,
	parseAiCanvasPayload,
} from "@skedra/shared/ai-generation";
import {
	OLLAMA_DEFAULT_CHAT_URL,
	OLLAMA_DEFAULT_MODEL,
	type SkedraAiProvider,
	getCloudProviderChatUrl,
	getDefaultAiModel,
	isLocalAiProvider,
	normalizeOpenAiChatCompletionsUrl,
} from "@skedra/shared/ai-providers";

export type { AiGenerationResult };

type ApiConfig = {
	url: string;
	model: string;
	headers: Record<string, string>;
	supportsJsonMode: boolean;
};

function requireCloudProviderChatUrl(provider: SkedraAiProvider) {
	const url = getCloudProviderChatUrl(provider);
	if (!url) {
		throw new Error(`Keine Chat-URL fuer ${provider} konfiguriert.`);
	}
	return url;
}

function getApiConfig(input: {
	provider: SkedraAiProvider;
	apiKey: string;
	model?: string | null;
	baseUrl?: string | null;
}): ApiConfig {
	if (input.provider === "openrouter") {
		return {
			url: requireCloudProviderChatUrl("openrouter"),
			model: input.model?.trim() || getDefaultAiModel("openrouter"),
			headers: {
				Authorization: `Bearer ${input.apiKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": "https://skedra.app",
				"X-Title": "Skedra",
			},
			supportsJsonMode: true,
		};
	}

	if (input.provider === "deepseek" || input.provider === "kimi") {
		return {
			url: requireCloudProviderChatUrl(input.provider),
			model: input.model?.trim() || getDefaultAiModel(input.provider),
			headers: {
				Authorization: `Bearer ${input.apiKey}`,
				"Content-Type": "application/json",
			},
			supportsJsonMode: true,
		};
	}

	if (input.provider === "ollama") {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (input.apiKey && input.apiKey !== "local-only") {
			headers.Authorization = `Bearer ${input.apiKey}`;
		}

		return {
			url: input.baseUrl?.trim() || OLLAMA_DEFAULT_CHAT_URL,
			model: input.model?.trim() || OLLAMA_DEFAULT_MODEL,
			headers,
			supportsJsonMode: false,
		};
	}

	if (input.provider === "local") {
		if (!input.baseUrl?.trim()) {
			throw new Error("Für lokale LLMs ist eine Base-URL erforderlich.");
		}

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (input.apiKey && input.apiKey !== "local-only") {
			headers.Authorization = `Bearer ${input.apiKey}`;
		}

		return {
			url: normalizeOpenAiChatCompletionsUrl(input.baseUrl),
			model: input.model?.trim() || "local-model",
			headers,
			supportsJsonMode: false,
		};
	}

	return {
		url: requireCloudProviderChatUrl("openai"),
		model: input.model?.trim() || getDefaultAiModel("openai"),
		headers: {
			Authorization: `Bearer ${input.apiKey}`,
			"Content-Type": "application/json",
		},
		supportsJsonMode: true,
	};
}

function extractJsonObject(text: string) {
	const trimmed = text.trim();
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
	const candidate = fenced?.[1]?.trim() ?? trimmed;
	const start = candidate.indexOf("{");
	const end = candidate.lastIndexOf("}");
	if (start === -1 || end === -1) {
		throw new Error("LLM-Antwort enthielt kein JSON-Objekt");
	}
	return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

export async function generateDiagramElements(input: {
	provider: SkedraAiProvider;
	apiKey: string;
	model?: string | null;
	baseUrl?: string | null;
	prompt: string;
	history?: Array<{ role: "user" | "assistant"; content: string }>;
	sequenceDiagramContext?: AiSequenceDiagramContext;
	ganttContext?: AiGanttChartContext;
}): Promise<AiGenerationResult> {
	const config = getApiConfig(input);
	const priorTurns = (input.history ?? []).slice(-8);
	const isShowcase = detectMultiToolShowcaseIntent(input.prompt);
	const sequenceContext = input.sequenceDiagramContext;
	const ganttContext = input.ganttContext;
	const contextSections: string[] = [];
	if (sequenceContext?.diagrams.length) {
		contextSections.push(
			`[EXISTING_SEQUENCE_DIAGRAM_CONTEXT]\n${JSON.stringify(sequenceContext)}\n[/EXISTING_SEQUENCE_DIAGRAM_CONTEXT]\nWenn die Anfrage ein vorhandenes Sequenzdiagramm veraendert, antworte mit sequenceDiagramEdit und verwende ausschliesslich die IDs und eventIndex-Werte aus diesem Kontext.`,
		);
	}
	if (ganttContext?.charts.length) {
		contextSections.push(
			`[EXISTING_GANTT_CONTEXT]\n${JSON.stringify(ganttContext)}\n[/EXISTING_GANTT_CONTEXT]\nWenn die Anfrage einen vorhandenen Projektplan veraendert, antworte mit ganttEdit und verwende ausschliesslich chartId, taskId und dependencyIndex aus diesem Kontext.`,
		);
	}
	const userMessage = [
		enrichPromptWithIntent(input.prompt),
		...contextSections,
	].join("\n\n");

	const body: Record<string, unknown> = {
		model: config.model,
		temperature: isShowcase ? 0.5 : 0.2,
		messages: [
			{
				role: "system",
				content: isShowcase
					? `${AI_SYSTEM_PROMPT}\n\n${AI_SHOWCASE_APPENDIX}`
					: AI_SYSTEM_PROMPT,
			},
			...priorTurns,
			{ role: "user", content: userMessage },
		],
	};

	if (config.supportsJsonMode) {
		body.response_format = { type: "json_object" };
	}

	const response = await fetch(config.url, {
		method: "POST",
		headers: config.headers,
		body: JSON.stringify(body),
	});

	const payload = (await response.json()) as {
		error?: { message?: string };
		choices?: Array<{ message?: { content?: string } }>;
	};

	if (!response.ok) {
		const hint = isLocalAiProvider(input.provider)
			? " Prüfe, ob Ollama/LM Studio läuft und das Modell geladen ist."
			: "";
		throw new Error(
			(payload.error?.message ?? `LLM-Fehler ${response.status}`) + hint,
		);
	}

	const content = payload.choices?.[0]?.message?.content;
	if (!content) {
		throw new Error("Leere LLM-Antwort");
	}

	const parsed = extractJsonObject(content);
	let result = parseAiCanvasPayload(parsed);

	// LLM liefert oft nur Kanban — dann vollstaendige Integrations-Demo als Fallback
	if (isShowcase && result.resultKind !== "showcase") {
		result = buildIntegrationShowcaseFallback();
	}

	return result;
}

/** Rueckwaertskompatibel — liefert nur Elemente. */
async function generateCanvasElementsOnly(
	input: Parameters<typeof generateDiagramElements>[0],
): Promise<AddCanvasElementInput[]> {
	const result = await generateDiagramElements(input);
	return result.elements;
}
