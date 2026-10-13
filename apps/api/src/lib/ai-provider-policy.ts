import type { SkedraAiProvider } from "@skedra/shared/ai-providers";

/** Local and custom AI endpoints are available to self-hosted installations. */
export function assertAiBaseUrlAllowed(
	_provider: SkedraAiProvider,
	_baseUrl: string | null | undefined,
) {}
