import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";

const configuredBaseUrl = process.env.MCP_E2E_BASE_URL?.replace(/\/$/u, "");
const configuredUserId = process.env.MCP_E2E_USER_ID;
const configuredAuthSecret =
	process.env.AUTH_SECRET ?? process.env.SKEDRA_AUTH_SECRET;
const configuredDatabaseUrl = process.env.DATABASE_URL;
const enabled = Boolean(
	configuredBaseUrl &&
		configuredUserId &&
		configuredAuthSecret &&
		configuredDatabaseUrl,
);

function hashWithAuthSecret(value: string) {
	return createHmac("sha256", configuredAuthSecret as string)
		.update(value)
		.digest("hex");
}

function signedSessionCookie(token: string, secure: boolean) {
	const signature = createHmac("sha256", configuredAuthSecret as string)
		.update(token)
		.digest("base64");
	const name = secure
		? "__Secure-better-auth.session_token"
		: "better-auth.session_token";
	return `${name}=${encodeURIComponent(`${token}.${signature}`)}`;
}

test(
	"remote OAuth enforces DCR limits and completes PKCE, MCP, and refresh replay handling",
	{
		skip: enabled
			? false
			: "Set MCP_E2E_BASE_URL, MCP_E2E_USER_ID, AUTH_SECRET/SKEDRA_AUTH_SECRET, and DATABASE_URL",
	},
	async () => {
		const baseUrl = configuredBaseUrl as string;
		const requestedUserId = configuredUserId as string;
		const target = new URL(baseUrl);
		const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
			target.hostname,
		);
		if (["create", "first"].includes(requestedUserId) && !isLoopback) {
			throw new Error(
				'MCP_E2E_USER_ID="create" or "first" is allowed only for loopback',
			);
		}

		const [schema, drizzle, drizzlePostgres, postgresModule] =
			await Promise.all([
				import("@skedra/db"),
				import("drizzle-orm"),
				import("drizzle-orm/postgres-js"),
				import("postgres"),
			]);
		const sql = postgresModule.default(configuredDatabaseUrl as string, {
			max: 2,
		});
		const db = drizzlePostgres.drizzle(sql, { schema });
		const { mcpOauthClients, sessions, users } = schema;
		const { eq, inArray } = drizzle;
		const resource = `${baseUrl}/api/mcp`;
		let clientId: string | undefined;
		let sessionId: string | undefined;
		let createdUserId: string | undefined;
		const clientIds = new Set<string>();

		async function rpc(accessToken: string, body: unknown) {
			return fetch(resource, {
				method: "POST",
				headers: {
					Accept: "application/json, text/event-stream",
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
					"MCP-Protocol-Version": "2025-11-25",
				},
				body: JSON.stringify(body),
			});
		}

		try {
			let user: { id: string } | undefined;
			if (requestedUserId === "create") {
				createdUserId = `mcp-e2e-user-${randomUUID()}`;
				[user] = await db
					.insert(users)
					.values({
						id: createdUserId,
						name: "Skedra MCP CI User",
						email: `${createdUserId}@example.test`,
						emailVerified: true,
					})
					.returning({ id: users.id });
			} else {
				[user] =
					requestedUserId === "first"
						? await db.select({ id: users.id }).from(users).limit(1)
						: await db
								.select({ id: users.id })
								.from(users)
								.where(eq(users.id, requestedUserId))
								.limit(1);
			}
			assert.ok(user, "MCP_E2E_USER_ID must identify an existing user");
			const sessionToken = `mcp-e2e-${randomBytes(32).toString("base64url")}`;
			sessionId = randomUUID();
			await db.insert(sessions).values({
				id: sessionId,
				userId: user.id,
				token: sessionToken,
				expiresAt: new Date(Date.now() + 10 * 60 * 1000),
				ipAddress: "127.0.0.1",
				userAgent: "Skedra checked-in MCP E2E test",
			});
			const cookie = signedSessionCookie(
				sessionToken,
				target.protocol === "https:",
			);

			const redirectUri = "http://127.0.0.1:49157/callback";
			const registrationResponse = await fetch(
				`${baseUrl}/api/oauth/register`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Forwarded-For": "198.51.100.10, 198.51.100.11",
						"X-Real-IP": "203.0.113.42",
					},
					body: JSON.stringify({
						client_name: "Skedra checked-in E2E test",
						redirect_uris: [redirectUri],
						grant_types: ["authorization_code", "refresh_token"],
						response_types: ["code"],
						token_endpoint_auth_method: "none",
					}),
				},
			);
			assert.equal(registrationResponse.status, 201);
			const registration = (await registrationResponse.json()) as {
				client_id: string;
			};
			clientId = registration.client_id;
			assert.ok(clientId);
			clientIds.add(clientId);

			const registeredClient = await db.query.mcpOauthClients.findFirst({
				where: eq(mcpOauthClients.id, clientId),
			});
			assert.notEqual(
				registeredClient?.registrationIpHash,
				hashWithAuthSecret("198.51.100.10"),
				"the attacker-controlled first X-Forwarded-For hop must not be trusted",
			);
			if (isLoopback) {
				assert.equal(
					registeredClient?.registrationIpHash,
					hashWithAuthSecret("203.0.113.42"),
				);
			}

			const burstResponses = await Promise.all(
				Array.from({ length: 60 }, (_, index) =>
					fetch(`${baseUrl}/api/oauth/register`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Real-IP": "192.0.2.42",
						},
						body: JSON.stringify({
							client_name: `Skedra DCR concurrency test ${index}`,
							redirect_uris: ["https://probe.example.test/callback"],
							grant_types: ["authorization_code", "refresh_token"],
							response_types: ["code"],
							token_endpoint_auth_method: "none",
						}),
					}),
				),
			);
			const burstStatuses = burstResponses.map((response) => response.status);
			for (const response of burstResponses) {
				if (response.status === 201) {
					const registered = (await response.json()) as { client_id: string };
					clientIds.add(registered.client_id);
				} else {
					await response.text();
				}
			}
			assert.equal(
				burstStatuses.filter((status) => status === 201).length,
				30,
				"parallel registrations must not exceed the per-IP hourly limit",
			);
			assert.equal(
				burstStatuses.filter((status) => status === 429).length,
				30,
				"registrations over the per-IP limit must be rejected",
			);

			const codeVerifier =
				"verification-code-verifier-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ";
			const codeChallenge = createHash("sha256")
				.update(codeVerifier)
				.digest("base64url");
			const authorizeUrl = new URL(`${baseUrl}/api/oauth/authorize`);
			authorizeUrl.search = new URLSearchParams({
				client_id: clientId,
				redirect_uri: redirectUri,
				response_type: "code",
				code_challenge: codeChallenge,
				code_challenge_method: "S256",
				resource,
				state: "e2e-state",
			}).toString();
			const authorizeResponse = await fetch(authorizeUrl, {
				headers: { Cookie: cookie },
				redirect: "manual",
			});
			assert.equal(authorizeResponse.status, 200);
			const consentHtml = await authorizeResponse.text();
			assert.match(consentHtml, /Boards und Canvas-Inhalte lesen/u);
			assert.match(consentHtml, /erstellen und bearbeiten/u);
			assert.doesNotMatch(consentHtml, /endgueltig loeschen/u);
			const consentToken = consentHtml.match(
				/name="consent_token" value="([^"]+)"/u,
			)?.[1];
			assert.ok(
				consentToken,
				"authorize response must contain a consent token",
			);

			const consentResponse = await fetch(`${baseUrl}/api/oauth/authorize`, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Cookie: cookie,
				},
				body: new URLSearchParams({
					consent_token: consentToken,
					decision: "allow",
				}),
				redirect: "manual",
			});
			assert.equal(consentResponse.status, 302);
			const callback = new URL(
				consentResponse.headers.get("location") as string,
			);
			assert.equal(callback.origin + callback.pathname, redirectUri);
			assert.equal(callback.searchParams.get("state"), "e2e-state");
			const code = callback.searchParams.get("code");
			assert.ok(code, "OAuth callback must contain an authorization code");

			const tokenResponse = await fetch(`${baseUrl}/api/oauth/token`, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "authorization_code",
					client_id: clientId,
					code,
					code_verifier: codeVerifier,
					redirect_uri: redirectUri,
					resource,
				}),
			});
			assert.equal(tokenResponse.status, 200);
			const tokens = (await tokenResponse.json()) as {
				access_token: string;
				refresh_token: string;
				scope: string;
			};
			assert.equal(tokens.scope, "boards:read boards:write");

			const initializeResponse = await rpc(tokens.access_token, {
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-11-25",
					capabilities: {},
					clientInfo: { name: "e2e", version: "1.0" },
				},
			});
			assert.equal(initializeResponse.status, 200);

			const listBoardsResponse = await rpc(tokens.access_token, {
				jsonrpc: "2.0",
				id: 2,
				method: "tools/call",
				params: { name: "list_boards", arguments: {} },
			});
			assert.equal(listBoardsResponse.status, 200);
			const listBoards = (await listBoardsResponse.json()) as {
				error?: unknown;
				result?: { isError?: boolean; content?: unknown[] };
			};
			assert.equal(listBoards.error, undefined);
			assert.equal(listBoards.result?.isError, undefined);
			assert.ok(Array.isArray(listBoards.result?.content));

			const refreshBody = () =>
				new URLSearchParams({
					grant_type: "refresh_token",
					client_id: clientId as string,
					refresh_token: tokens.refresh_token,
					resource,
				});
			const refresh = () =>
				fetch(`${baseUrl}/api/oauth/token`, {
					method: "POST",
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
					body: refreshBody(),
				});
			const refreshResponses = await Promise.all([refresh(), refresh()]);
			assert.deepEqual(
				refreshResponses.map((response) => response.status).sort(),
				[200, 400],
			);
			const successfulRefresh = refreshResponses.find(
				(response) => response.status === 200,
			);
			assert.ok(successfulRefresh);
			const rotated = (await successfulRefresh.json()) as {
				access_token: string;
			};
			const replayRevokedFamily = await rpc(rotated.access_token, {
				jsonrpc: "2.0",
				id: 3,
				method: "tools/list",
				params: {},
			});
			assert.equal(replayRevokedFamily.status, 401);
		} finally {
			if (clientIds.size > 0) {
				await db
					.delete(mcpOauthClients)
					.where(inArray(mcpOauthClients.id, [...clientIds]));
			}
			if (sessionId) {
				await db.delete(sessions).where(eq(sessions.id, sessionId));
			}
			if (createdUserId) {
				await db.delete(users).where(eq(users.id, createdUserId));
			}
			await sql.end();
		}
	},
);
