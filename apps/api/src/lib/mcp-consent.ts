import type { SkedraApiKeyScope } from "@skedra/shared";

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

export function mcpConsentContentSecurityPolicy(redirectUri: string) {
	const redirect = new URL(redirectUri);
	const redirectSource =
		redirect.origin === "null" ? redirect.protocol : redirect.origin;
	return `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${redirectSource}; base-uri 'none'; frame-ancestors 'none'`;
}

export function mcpConsentHtml(input: {
	clientName: string;
	userName: string;
	redirectUri: string;
	scopes: SkedraApiKeyScope[];
	consentToken: string;
}) {
	const scopeLabels: Record<SkedraApiKeyScope, string> = {
		"boards:read": "Boards und Canvas-Inhalte lesen",
		"boards:write": "Boards und Canvas-Inhalte erstellen und bearbeiten",
		"members:write": "Board-Mitglieder einladen",
		"boards:delete": "Archivierte Boards endgueltig loeschen",
	};
	const redirect = new URL(input.redirectUri);
	const redirectHost = redirect.host;
	const isLocalRedirect =
		redirect.hostname === "localhost" ||
		redirect.hostname === "127.0.0.1" ||
		redirect.hostname === "[::1]";
	const scopes = input.scopes
		.map((scope) => `<li>${escapeHtml(scopeLabels[scope])}</li>`)
		.join("");
	const redirectWarning = isLocalRedirect
		? '<p class="warning">Lokale Anwendung: Erlaube den Zugriff nur, wenn du die Verbindung gerade selbst gestartet hast.</p>'
		: "";

	return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Skedra verbinden</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07100c;color:#eaf5ef;font:15px/1.5 system-ui,sans-serif;padding:24px}.card{width:min(520px,100%);background:#101b16;border:1px solid #263b31;border-radius:20px;padding:28px;box-shadow:0 24px 80px #0008}.brand{color:#2dd4bf;font-weight:800;letter-spacing:.16em;text-transform:uppercase;font-size:12px}h1{font-size:24px;margin:8px 0 8px}p{color:#a8bbb1}ul{background:#0a1410;border:1px solid #23372d;border-radius:14px;padding:16px 16px 16px 36px}.redirect{background:#0a1410;border:1px solid #23372d;border-radius:12px;padding:12px}.redirect strong{display:block;color:#eaf5ef;font-family:ui-monospace,monospace;overflow-wrap:anywhere}.warning{color:#fbbf24}.actions{display:flex;gap:12px;margin-top:22px}button{flex:1;border:0;border-radius:12px;padding:12px 16px;font-weight:700;cursor:pointer}.allow{background:#20c7b7;color:#042b27}.deny{background:#23322b;color:#d7e5dd}.account{font-size:13px;color:#789087}</style></head>
<body><main class="card"><div class="brand">Skedra MCP</div><h1>${escapeHtml(input.clientName)} verbinden?</h1><p>Diese Anwendung moechte in deinem Namen auf Skedra zugreifen.</p><div class="redirect">Weiterleitung nach der Freigabe an:<strong>${escapeHtml(redirectHost)}</strong></div>${redirectWarning}<ul>${scopes}</ul><div class="account">Angemeldet als ${escapeHtml(input.userName)}</div>
<form method="post" action="/api/oauth/authorize"><input type="hidden" name="consent_token" value="${escapeHtml(input.consentToken)}"><div class="actions"><button class="deny" name="decision" value="deny">Abbrechen</button><button class="allow" name="decision" value="allow">Zugriff erlauben</button></div></form></main></body></html>`;
}
