/**
 * HTTP-Client fuer die Skedra Public REST API v1.
 */

async function request<T>(
	baseUrl: string,
	apiKey: string,
	method: string,
	path: string,
	body?: unknown,
): Promise<T> {
	const response = await fetch(`${baseUrl}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});

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
	createBoard: (name: string) => Promise<{ board: unknown }>;
	getBoard: (id: string) => Promise<{ board: unknown }>;
	updateBoard: (id: string, name: string) => Promise<{ board: unknown }>;
	archiveBoard: (id: string) => Promise<{ success: boolean }>;
	restoreBoard: (id: string) => Promise<{ success: boolean }>;
	permanentDeleteBoard: (id: string) => Promise<{ success: boolean }>;
	getBoardElements: (
		id: string,
	) => Promise<{ elements: unknown[]; count: number }>;
	addBoardElements: (
		id: string,
		elements: unknown[],
	) => Promise<{ elements: unknown[]; count: number }>;
	updateBoardElement: (
		id: string,
		elementId: string,
		updates: Record<string, unknown>,
	) => Promise<{ element: unknown }>;
	deleteBoardElement: (
		id: string,
		elementId: string,
	) => Promise<{ success: boolean }>;
	listBoardMembers: (id: string) => Promise<{ members: unknown[] }>;
	inviteMember: (id: string, email: string) => Promise<{ success: boolean }>;
	listBoardActivity: (
		id: string,
		limit?: number,
	) => Promise<{ activities: unknown[] }>;
	listActivity: (limit?: number) => Promise<{ activities: unknown[] }>;
};

const MISSING_KEY_MESSAGE =
	"SKEDRA_API_KEY fehlt. Erstelle einen Key unter /settings/api-keys und setze ihn in der MCP-Konfiguration (env.SKEDRA_API_KEY) oder in der .env.";

export function createSkedraClientFromEnv(): SkedraApiClient {
	const apiUrl = process.env.SKEDRA_API_URL ?? "http://localhost:3001/api/v1";
	const apiKey = process.env.SKEDRA_API_KEY?.trim();
	if (!apiKey) {
		throw new Error(MISSING_KEY_MESSAGE);
	}

	const baseUrl = apiUrl.replace(/\/$/, "");
	const call = <T>(method: string, path: string, body?: unknown) =>
		request<T>(baseUrl, apiKey, method, path, body);

	return {
		getMe: () => call("GET", "/me"),
		listBoards: () => call("GET", "/boards"),
		listArchivedBoards: () => call("GET", "/boards/archived"),
		createBoard: (name) => call("POST", "/boards", { name }),
		getBoard: (id) => call("GET", `/boards/${id}`),
		updateBoard: (id, name) => call("PATCH", `/boards/${id}`, { name }),
		archiveBoard: (id) => call("POST", `/boards/${id}/archive`),
		restoreBoard: (id) => call("POST", `/boards/${id}/restore`),
		permanentDeleteBoard: (id) => call("DELETE", `/boards/${id}`),
		getBoardElements: (id) => call("GET", `/boards/${id}/elements`),
		addBoardElements: (id, elements) =>
			call("POST", `/boards/${id}/elements`, { elements }),
		updateBoardElement: (id, elementId, updates) =>
			call("PATCH", `/boards/${id}/elements/${elementId}`, updates),
		deleteBoardElement: (id, elementId) =>
			call("DELETE", `/boards/${id}/elements/${elementId}`),
		listBoardMembers: (id) => call("GET", `/boards/${id}/members`),
		inviteMember: (id, email) =>
			call("POST", `/boards/${id}/members`, { email }),
		listBoardActivity: (id, limit = 50) =>
			call("GET", `/boards/${id}/activity?limit=${limit}`),
		listActivity: (limit = 30) => call("GET", `/activity?limit=${limit}`),
	};
}
