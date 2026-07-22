/**
 * HTTP-Client fuer die Skedra Public REST API v1.
 */

import { createHash, randomBytes } from "node:crypto";

const E2EE_KEY_HASH_PREFIX = "skedra-e2ee-key-v1:";

function createE2eeKeyMaterial() {
	const keyBytes = randomBytes(32);
	return {
		key: keyBytes.toString("base64url"),
		keyHash: createHash("sha256")
			.update(E2EE_KEY_HASH_PREFIX)
			.update(keyBytes)
			.digest("hex"),
	};
}

// Fix M4: Timeout, damit ein haengender API-Server das MCP-Tool nicht endlos blockiert.
const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(
	baseUrl: string,
	apiKey: string,
	method: string,
	path: string,
	body?: unknown,
): Promise<T> {
	let response: Response;
	try {
		response = await fetch(`${baseUrl}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: body !== undefined ? JSON.stringify(body) : undefined,
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
	} catch (error) {
		if (error instanceof Error && error.name === "TimeoutError") {
			throw new Error(
				`Zeitueberschreitung nach ${REQUEST_TIMEOUT_MS / 1000}s bei ${method} ${path}`,
			);
		}
		throw error;
	}

	const payload = (await response.json().catch(() => ({}))) as T & {
		error?: string;
	};
	if (!response.ok) {
		throw new Error(payload.error ?? `API Fehler ${response.status}`);
	}
	return payload;
}

export type SkedraApiClient = {
	getMe: () => Promise<{ id: string; name: string; email: string }>;
	listBoards: () => Promise<{ boards: unknown[] }>;
	listArchivedBoards: () => Promise<{ boards: unknown[] }>;
	createBoard: (
		name: string,
		encryptionMode: "server" | "e2ee",
	) => Promise<{ board: BoardMetadata; e2eeKey?: string }>;
	getBoard: (id: string) => Promise<{ board: BoardMetadata }>;
	updateBoard: (id: string, name: string) => Promise<{ board: unknown }>;
	archiveBoard: (id: string) => Promise<{ success: boolean }>;
	restoreBoard: (id: string) => Promise<{ success: boolean }>;
	permanentDeleteBoard: (id: string) => Promise<{ success: boolean }>;
	// Fix M1: alte Element-Methoden entfernt. Neu: verschlüsseltes Update anhängen
	// (Client baut/verschlüsselt lokal, siehe canvas-e2ee.ts), erscheint sofort live.
	appendBoardUpdate: (
		id: string,
		body: { clientId: string; keyHash?: string; update: string },
	) => Promise<{ id: string; createdAt: string }>;
	listBoardUpdates: (
		id: string,
		options?: { afterId?: string; afterCreatedAt?: string; limit?: number },
	) => Promise<{
		updates: Array<{
			id: string;
			clientId: string;
			update: string;
			createdAt: string;
		}>;
	}>;
	listBoardMembers: (id: string) => Promise<{ members: unknown[] }>;
	listBoardTeamRoles: (id: string) => Promise<{ roles: unknown[] }>;
	inviteMember: (
		id: string,
		email: string,
		roleId: string,
	) => Promise<{ success: boolean }>;
	listBoardActivity: (
		id: string,
		limit?: number,
	) => Promise<{ activities: unknown[] }>;
	listActivity: (limit?: number) => Promise<{ activities: unknown[] }>;
};

export interface BoardMetadata {
	id: string;
	name: string;
	encryptionMode: "server" | "e2ee";
	[key: string]: unknown;
}

const MISSING_KEY_MESSAGE =
	"SKEDRA_API_KEY fehlt. Erstelle einen Key unter /settings/api-keys und setze ihn in der MCP-Konfiguration (env.SKEDRA_API_KEY) oder in der .env.";

export function createSkedraClientFromEnv(): SkedraApiClient {
	const apiUrl = process.env.SKEDRA_API_URL ?? "http://localhost:3001/api/v1";
	const apiKey = process.env.SKEDRA_API_KEY?.trim();
	if (!apiKey) {
		throw new Error(MISSING_KEY_MESSAGE);
	}
	return createSkedraClient({ apiUrl, apiKey });
}

export function createSkedraClient(input: {
	apiUrl: string;
	apiKey: string;
}): SkedraApiClient {
	const { apiUrl, apiKey } = input;
	const baseUrl = apiUrl.replace(/\/$/, "");
	const call = <T>(method: string, path: string, body?: unknown) =>
		request<T>(baseUrl, apiKey, method, path, body);

	return {
		getMe: () => call("GET", "/me"),
		listBoards: () => call("GET", "/boards"),
		listArchivedBoards: () => call("GET", "/boards/archived"),
		createBoard: async (name, encryptionMode) => {
			if (encryptionMode === "server") {
				return call<{ board: BoardMetadata }>("POST", "/boards", {
					name,
					encryptionMode,
				});
			}
			const e2ee = createE2eeKeyMaterial();
			const result = await call<{ board: BoardMetadata }>("POST", "/boards", {
				name,
				encryptionMode,
				e2eeKeyHash: e2ee.keyHash,
			});
			return { ...result, e2eeKey: e2ee.key };
		},
		getBoard: (id) => call("GET", `/boards/${id}`),
		updateBoard: (id, name) => call("PATCH", `/boards/${id}`, { name }),
		archiveBoard: (id) => call("POST", `/boards/${id}/archive`),
		restoreBoard: (id) => call("POST", `/boards/${id}/restore`),
		permanentDeleteBoard: (id) => call("DELETE", `/boards/${id}`),
		appendBoardUpdate: (id, body) =>
			call("POST", `/boards/${id}/updates`, body),
		listBoardUpdates: (id, options = {}) => {
			const params = new URLSearchParams();
			if (options.afterId) params.set("afterId", options.afterId);
			if (options.afterCreatedAt) {
				params.set("afterCreatedAt", options.afterCreatedAt);
			}
			if (options.limit) params.set("limit", String(options.limit));
			const query = params.toString();
			return call("GET", `/boards/${id}/updates${query ? `?${query}` : ""}`);
		},
		listBoardMembers: (id) => call("GET", `/boards/${id}/members`),
		listBoardTeamRoles: (id) => call("GET", `/boards/${id}/team-roles`),
		inviteMember: (id, email, roleId) =>
			call("POST", `/boards/${id}/members`, { email, roleId }),
		listBoardActivity: (id, limit = 50) =>
			call("GET", `/boards/${id}/activity?limit=${limit}`),
		listActivity: (limit = 30) => call("GET", `/activity?limit=${limit}`),
	};
}
