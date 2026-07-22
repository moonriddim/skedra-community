import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createSkedraMcpServer } from "@skedra/mcp";
import { createSkedraClient } from "@skedra/mcp/client";
import { type Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { env } from "./env";
import { auth } from "./lib/auth";
import { userHasProductAccess } from "./lib/billing-entitlement";
import { db } from "./lib/db";
import { mcpConsentHtml } from "./lib/mcp-consent";
import { createInternalMcpApiToken } from "./lib/mcp-internal-auth";
import {
	MCP_ALLOWED_RESOURCES,
	MCP_DEFAULT_RESOURCE,
	MCP_OAUTH_ISSUER,
	MCP_OAUTH_SCOPES,
	McpOAuthError,
	createMcpConsentToken,
	exchangeMcpAuthorizationCode,
	exchangeMcpRefreshToken,
	getMcpOauthClient,
	hashMcpRegistrationIp,
	issueMcpAuthorizationCode,
	parseMcpAuthorizationRequest,
	registerMcpOauthClient,
	revokeMcpOauthToken,
	verifyMcpAccessToken,
	verifyMcpConsentToken,
} from "./lib/mcp-oauth";

export const mcpApp = new Hono();

const issuerBase = new URL(`${MCP_OAUTH_ISSUER}/`);
const authorizationEndpoint = new URL(
	"/api/oauth/authorize",
	issuerBase,
).toString();
const tokenEndpoint = new URL("/api/oauth/token", issuerBase).toString();
const registrationEndpoint = new URL(
	"/api/oauth/register",
	issuerBase,
).toString();
const revocationEndpoint = new URL("/api/oauth/revoke", issuerBase).toString();

function publicMcpResource(request: Request) {
	const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0];
	const forwardedProto = request.headers
		.get("x-forwarded-proto")
		?.split(",")[0];
	const requestUrl = new URL(request.url);
	const host = forwardedHost?.trim() || request.headers.get("host");
	const protocol =
		forwardedProto?.trim() || requestUrl.protocol.replace(":", "");
	const candidate = host
		? `${protocol}://${host.trim()}/api/mcp`
		: MCP_DEFAULT_RESOURCE;
	return MCP_ALLOWED_RESOURCES.has(candidate)
		? candidate
		: MCP_DEFAULT_RESOURCE;
}

function protectedResourceMetadataUrl(request: Request) {
	const resource = new URL(publicMcpResource(request));
	return new URL(
		`/.well-known/oauth-protected-resource${resource.pathname}`,
		resource,
	).toString();
}

function oauthErrorResponse(c: Context, error: unknown) {
	if (error instanceof McpOAuthError) {
		return c.json(
			{ error: error.code, error_description: error.message },
			error.status as ContentfulStatusCode,
		);
	}
	console.error("[skedra-mcp-oauth]", error);
	return c.json(
		{ error: "server_error", error_description: "Interner OAuth-Fehler" },
		500,
	);
}

function noStore(response: Response) {
	response.headers.set("Cache-Control", "no-store");
	response.headers.set("Pragma", "no-cache");
	return response;
}

const clientRegistrationSchema = z.object({
	client_name: z.string().min(1).max(120).optional(),
	client_uri: z.string().url().max(500).optional(),
	redirect_uris: z.array(z.string().url().max(1000)).min(1).max(10),
	grant_types: z.array(z.string()).optional(),
	response_types: z.array(z.string()).optional(),
	token_endpoint_auth_method: z.string().optional(),
});

mcpApp.get("/.well-known/oauth-protected-resource", (c) =>
	c.json({
		resource: publicMcpResource(c.req.raw),
		authorization_servers: [MCP_OAUTH_ISSUER],
		bearer_methods_supported: ["header"],
		scopes_supported: MCP_OAUTH_SCOPES,
		resource_name: "Skedra Whiteboard MCP",
		resource_documentation: new URL(
			"/settings?tab=api-keys",
			env.APP_URL,
		).toString(),
	}),
);

mcpApp.get("/.well-known/oauth-protected-resource/api/mcp", (c) =>
	c.json({
		resource: publicMcpResource(c.req.raw),
		authorization_servers: [MCP_OAUTH_ISSUER],
		bearer_methods_supported: ["header"],
		scopes_supported: MCP_OAUTH_SCOPES,
		resource_name: "Skedra Whiteboard MCP",
		resource_documentation: new URL(
			"/settings?tab=api-keys",
			env.APP_URL,
		).toString(),
	}),
);

mcpApp.get("/.well-known/oauth-authorization-server", (c) =>
	c.json({
		issuer: MCP_OAUTH_ISSUER,
		authorization_endpoint: authorizationEndpoint,
		token_endpoint: tokenEndpoint,
		registration_endpoint: registrationEndpoint,
		revocation_endpoint: revocationEndpoint,
		response_types_supported: ["code"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		code_challenge_methods_supported: ["S256"],
		token_endpoint_auth_methods_supported: ["none"],
		revocation_endpoint_auth_methods_supported: ["none"],
		scopes_supported: MCP_OAUTH_SCOPES,
		service_documentation: new URL(
			"/settings?tab=api-keys",
			env.APP_URL,
		).toString(),
	}),
);

mcpApp.post("/api/oauth/register", async (c) => {
	try {
		const parsed = clientRegistrationSchema.parse(await c.req.json());
		if (
			parsed.grant_types?.some(
				(type) => type !== "authorization_code" && type !== "refresh_token",
			) ||
			parsed.response_types?.some((type) => type !== "code")
		) {
			throw new McpOAuthError(
				"invalid_client_metadata",
				"Nur Authorization Code und Refresh Token werden unterstuetzt",
			);
		}
		// nginx overwrites X-Real-IP with the trusted peer address. X-Forwarded-For
		// may start with an attacker-controlled value, so only use its final hop as
		// a direct-development fallback when X-Real-IP is absent.
		const realIp = c.req.header("x-real-ip")?.trim();
		const forwardedFor = c.req
			.header("x-forwarded-for")
			?.split(",")
			.at(-1)
			?.trim();
		const registrationIp = realIp || forwardedFor || "unknown";
		const client = await registerMcpOauthClient(db, {
			clientName: parsed.client_name,
			clientUri: parsed.client_uri,
			redirectUris: parsed.redirect_uris,
			tokenEndpointAuthMethod: parsed.token_endpoint_auth_method,
			registrationIpHash: hashMcpRegistrationIp(registrationIp),
		});
		return c.json(
			{
				client_id: client.clientId,
				client_id_issued_at: Math.floor(Date.now() / 1000),
				client_name: client.clientName,
				client_uri: client.clientUri ?? undefined,
				redirect_uris: client.redirectUris,
				grant_types: ["authorization_code", "refresh_token"],
				response_types: ["code"],
				token_endpoint_auth_method: "none",
			},
			201,
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json(
				{
					error: "invalid_client_metadata",
					error_description: "Client-Metadaten sind ungueltig",
				},
				400,
			);
		}
		return oauthErrorResponse(c, error);
	}
});

function authorizeQuery(c: {
	req: { query: (name: string) => string | undefined };
}) {
	return parseMcpAuthorizationRequest({
		clientId: c.req.query("client_id"),
		redirectUri: c.req.query("redirect_uri"),
		responseType: c.req.query("response_type"),
		codeChallenge: c.req.query("code_challenge"),
		codeChallengeMethod: c.req.query("code_challenge_method"),
		resource: c.req.query("resource"),
		scope: c.req.query("scope"),
		state: c.req.query("state"),
	});
}

mcpApp.get("/api/oauth/authorize", async (c) => {
	try {
		const request = authorizeQuery(c);
		const client = await getMcpOauthClient(db, request.clientId);
		if (!client || !client.redirectUris.includes(request.redirectUri)) {
			throw new McpOAuthError("invalid_client", "OAuth-Client ist ungueltig");
		}
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		if (!session?.user) {
			const loginUrl = new URL("/login", env.APP_URL);
			loginUrl.searchParams.set("redirect", c.req.url);
			return c.redirect(loginUrl.toString());
		}
		if (!(await userHasProductAccess(db, session.user.id))) {
			return c.html(
				"<h1>Ein aktiver Skedra-Zugang ist erforderlich.</h1>",
				403,
			);
		}
		const consentToken = createMcpConsentToken(request, session.user.id);
		c.header(
			"Content-Security-Policy",
			"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
		);
		c.header("Referrer-Policy", "no-referrer");
		c.header("X-Frame-Options", "DENY");
		return c.html(
			mcpConsentHtml({
				clientName: client.clientName,
				userName: session.user.name,
				redirectUri: request.redirectUri,
				scopes: request.scopes,
				consentToken,
			}),
		);
	} catch (error) {
		return oauthErrorResponse(c, error);
	}
});

mcpApp.post("/api/oauth/authorize", async (c) => {
	try {
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		if (!session?.user) {
			throw new McpOAuthError("access_denied", "Anmeldung ist abgelaufen", 401);
		}
		const form = await c.req.parseBody();
		const consentToken =
			typeof form.consent_token === "string" ? form.consent_token : "";
		const request = verifyMcpConsentToken(consentToken, session.user.id);
		const target = new URL(request.redirectUri);
		if (request.state) target.searchParams.set("state", request.state);
		if (form.decision !== "allow") {
			target.searchParams.set("error", "access_denied");
			return c.redirect(target.toString());
		}
		const code = await issueMcpAuthorizationCode(db, request);
		target.searchParams.set("code", code);
		return c.redirect(target.toString());
	} catch (error) {
		return oauthErrorResponse(c, error);
	}
});

async function tokenForm(request: Request) {
	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.includes("application/x-www-form-urlencoded")) {
		throw new McpOAuthError(
			"invalid_request",
			"application/x-www-form-urlencoded erwartet",
		);
	}
	return new URLSearchParams(await request.text());
}

mcpApp.post("/api/oauth/token", async (c) => {
	try {
		const form = await tokenForm(c.req.raw);
		const clientId = form.get("client_id") ?? "";
		const client = await getMcpOauthClient(db, clientId);
		if (!client)
			throw new McpOAuthError("invalid_client", "Client unbekannt", 401);
		const grantType = form.get("grant_type");
		const tokens =
			grantType === "authorization_code"
				? await exchangeMcpAuthorizationCode(db, {
						clientId,
						code: form.get("code") ?? "",
						codeVerifier: form.get("code_verifier") ?? "",
						redirectUri: form.get("redirect_uri") ?? "",
						resource: form.get("resource") ?? undefined,
					})
				: grantType === "refresh_token"
					? await exchangeMcpRefreshToken(db, {
							clientId,
							refreshToken: form.get("refresh_token") ?? "",
							resource: form.get("resource") ?? undefined,
							scope: form.get("scope") ?? undefined,
						})
					: (() => {
							throw new McpOAuthError(
								"unsupported_grant_type",
								"Grant-Typ wird nicht unterstuetzt",
							);
						})();
		return noStore(c.json(tokens));
	} catch (error) {
		return noStore(oauthErrorResponse(c, error));
	}
});

mcpApp.post("/api/oauth/revoke", async (c) => {
	try {
		const form = await tokenForm(c.req.raw);
		const clientId = form.get("client_id") ?? "";
		if (!(await getMcpOauthClient(db, clientId))) {
			throw new McpOAuthError("invalid_client", "Client unbekannt", 401);
		}
		await revokeMcpOauthToken(db, {
			clientId,
			token: form.get("token") ?? "",
		});
		return noStore(new Response(null, { status: 200 }));
	} catch (error) {
		return noStore(oauthErrorResponse(c, error));
	}
});

function mcpUnauthorized(request: Request, description = "OAuth erforderlich") {
	return new Response(
		JSON.stringify({
			jsonrpc: "2.0",
			error: { code: -32001, message: description },
			id: null,
		}),
		{
			status: 401,
			headers: {
				"Content-Type": "application/json",
				"WWW-Authenticate": `Bearer resource_metadata="${protectedResourceMetadataUrl(request)}", scope="${MCP_OAUTH_SCOPES.join(" ")}"`,
			},
		},
	);
}

mcpApp.all("/api/mcp", async (c) => {
	const origin = c.req.header("origin");
	if (origin) {
		const normalizedOrigin = origin.replace(/\/$/u, "");
		const allowedOrigins = [env.APP_URL, env.API_URL].map(
			(url) => new URL(url).origin,
		);
		if (!allowedOrigins.includes(normalizedOrigin)) {
			return c.json(
				{
					jsonrpc: "2.0",
					error: { code: -32000, message: "Origin nicht erlaubt" },
					id: null,
				},
				403,
			);
		}
	}

	const authHeader = c.req.header("authorization");
	if (!authHeader?.startsWith("Bearer ")) return mcpUnauthorized(c.req.raw);
	try {
		const access = await verifyMcpAccessToken(
			db,
			authHeader.slice("Bearer ".length).trim(),
		);
		if (access.resource.toString() !== publicMcpResource(c.req.raw)) {
			return mcpUnauthorized(
				c.req.raw,
				"Token wurde fuer eine andere Ressource ausgestellt",
			);
		}
		if (!(await userHasProductAccess(db, access.user.id))) {
			return mcpUnauthorized(c.req.raw, "Skedra-Zugang ist nicht aktiv");
		}

		const internalToken = createInternalMcpApiToken({
			userId: access.user.id,
			scopes: access.scopes,
		});
		const apiUrl =
			env.MCP_INTERNAL_API_URL?.replace(/\/$/u, "") ??
			"http://127.0.0.1:3001/api/v1";
		const server = createSkedraMcpServer(() =>
			createSkedraClient({ apiUrl, apiKey: internalToken }),
		);
		const transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});
		await server.connect(transport);
		try {
			return await transport.handleRequest(c.req.raw, {
				authInfo: {
					token: access.token,
					clientId: access.clientId,
					scopes: access.scopes,
					expiresAt: access.expiresAt,
					resource: access.resource,
					extra: { userId: access.user.id },
				},
			});
		} finally {
			await server.close().catch((closeError) => {
				console.error("[skedra-remote-mcp-close]", closeError);
			});
		}
	} catch (error) {
		if (!(error instanceof McpOAuthError)) {
			console.error("[skedra-remote-mcp]", error);
		}
		return mcpUnauthorized(
			c.req.raw,
			"Access-Token ist ungueltig oder abgelaufen",
		);
	}
});
