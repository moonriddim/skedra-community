type RuntimeConfig = {
	API_URL?: string;
	APP_URL?: string;
	LIBRARIES_URL?: string;
};

declare global {
	interface Window {
		__SKEDRA_CONFIG__?: RuntimeConfig;
	}
}

export function getRuntimeConfigValue(key: keyof RuntimeConfig) {
	if (typeof window === "undefined") return undefined;
	const value = window.__SKEDRA_CONFIG__?.[key]?.trim();
	return value || undefined;
}
