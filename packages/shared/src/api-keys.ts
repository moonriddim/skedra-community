/** Prefix fuer alle Skedra API Keys (Bearer-Token). */
export const SKEDRA_API_KEY_PREFIX = "sked_";

/** Mindestlaenge des Secrets nach dem Prefix. */
export const SKEDRA_API_KEY_MIN_LENGTH = 40;

/** Feingranulare Berechtigungen fuer API Keys. */
export const skedraApiKeyScopes = [
	"boards:read",
	"boards:write",
	"members:write",
	"boards:delete",
] as const;

export type SkedraApiKeyScope = (typeof skedraApiKeyScopes)[number];

/** Standard: voller Zugriff (Abwaertskompatibilitaet fuer Keys ohne scopes-Feld). */
export const SKEDRA_API_KEY_DEFAULT_SCOPES: SkedraApiKeyScope[] = [
	...skedraApiKeyScopes,
];

export function isSkedraApiKey(value: string) {
	return (
		value.startsWith(SKEDRA_API_KEY_PREFIX) &&
		value.length >= SKEDRA_API_KEY_MIN_LENGTH
	);
}

export function parseApiKeyScopes(
	raw: string | null | undefined,
): SkedraApiKeyScope[] {
	if (!raw) return [...SKEDRA_API_KEY_DEFAULT_SCOPES];

	try {
		const parsed = JSON.parse(raw) as unknown;
		if (
			Array.isArray(parsed) &&
			parsed.length > 0 &&
			parsed.every((entry) =>
				skedraApiKeyScopes.includes(entry as SkedraApiKeyScope),
			)
		) {
			return parsed as SkedraApiKeyScope[];
		}
	} catch {
		// Ungueltiges JSON → voller Zugriff
	}

	return [...SKEDRA_API_KEY_DEFAULT_SCOPES];
}

export function serializeApiKeyScopes(scopes: SkedraApiKeyScope[]) {
	return JSON.stringify(scopes);
}

export function apiKeyHasScope(
	scopes: SkedraApiKeyScope[],
	required: SkedraApiKeyScope,
): boolean {
	return scopes.includes(required);
}
