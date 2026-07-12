/**
 * Hono Middleware: API-Key Authentifizierung fuer /api/v1/*
 */

import { type SkedraApiKeyScope, apiKeyHasScope } from "@skedra/shared";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { type ApiKeyUser, authenticateApiKey } from "../lib/api-keys";
import { db } from "../lib/db";

export type ApiAuthVariables = {
	apiUser: ApiKeyUser;
	apiKeyId: string;
	apiKeyScopes: SkedraApiKeyScope[];
};

export const apiKeyAuth = createMiddleware<{ Variables: ApiAuthVariables }>(
	async (c, next) => {
		const authHeader = c.req.header("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return c.json(
				{ error: "Authorization header fehlt (Bearer sked_…)" },
				401,
			);
		}

		const token = authHeader.slice("Bearer ".length).trim();
		const auth = await authenticateApiKey(db, token);
		if (!auth) {
			return c.json({ error: "Ungueltiger oder abgelaufener API Key" }, 401);
		}

		c.set("apiUser", auth.user);
		c.set("apiKeyId", auth.keyId);
		c.set("apiKeyScopes", auth.scopes);
		await next();
	},
);

/** Prueft ob der API Key den erforderlichen Scope hat. */
export function requireApiScope(
	c: Context<{ Variables: ApiAuthVariables }>,
	required: SkedraApiKeyScope,
) {
	const scopes = c.get("apiKeyScopes");
	if (!apiKeyHasScope(scopes, required)) {
		return c.json({ error: `Fehlende Berechtigung: ${required}` }, 403);
	}
	return null;
}

/** Route-Handler nur ausfuehren, wenn der API-Key den Scope hat. */
export async function withApiScope(
	c: Context<{ Variables: ApiAuthVariables }>,
	scope: SkedraApiKeyScope,
	handler: () => Promise<Response>,
): Promise<Response> {
	const denied = requireApiScope(c, scope);
	if (denied) return denied;
	return handler();
}

/** Permission-Context aus authentifiziertem API-User. */
export function toPermissionCtx(user: ApiKeyUser) {
	return {
		db,
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			image: user.image,
		},
	};
}

/** Serialisiert Board fuer JSON-Responses (ohne Y.js-Binary). */
export function serializeBoard(board: {
	id: string;
	name: string;
	ownerId: string;
	createdAt: Date;
	updatedAt: Date;
	archivedAt?: Date | null;
	presentationShareEnabled?: boolean;
	encryptionMode?: "server" | "e2ee";
}) {
	return {
		id: board.id,
		name: board.name,
		ownerId: board.ownerId,
		createdAt: board.createdAt.toISOString(),
		updatedAt: board.updatedAt.toISOString(),
		archivedAt: board.archivedAt?.toISOString() ?? null,
		...(board.encryptionMode !== undefined
			? { encryptionMode: board.encryptionMode }
			: {}),
		...(board.presentationShareEnabled !== undefined
			? { presentationShareEnabled: board.presentationShareEnabled }
			: {}),
	};
}
