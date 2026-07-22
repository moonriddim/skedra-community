import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { type Database, users } from "@skedra/db";
import {
	type SkedraApiKeyScope,
	parseApiKeyScopes,
	serializeApiKeyScopes,
} from "@skedra/shared";
import { eq } from "drizzle-orm";
import { env } from "../env";
import type { AuthenticatedApiKey } from "./api-keys";

const PREFIX = "ski_mcp_";
const TTL_MS = 60_000;

type InternalMcpTokenPayload = {
	userId: string;
	scopes: string;
	expiresAt: number;
	nonce: string;
};

function sign(value: string) {
	return createHmac("sha256", env.AUTH_SECRET)
		.update(value)
		.digest("base64url");
}

export function createInternalMcpApiToken(input: {
	userId: string;
	scopes: SkedraApiKeyScope[];
}) {
	const payload: InternalMcpTokenPayload = {
		userId: input.userId,
		scopes: serializeApiKeyScopes(input.scopes),
		expiresAt: Date.now() + TTL_MS,
		nonce: randomBytes(12).toString("base64url"),
	};
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `${PREFIX}${encoded}.${sign(encoded)}`;
}

export async function authenticateInternalMcpApiToken(
	db: Database,
	token: string,
): Promise<AuthenticatedApiKey | null> {
	if (!token.startsWith(PREFIX)) return null;
	const [encoded, suppliedSignature] = token.slice(PREFIX.length).split(".");
	if (!encoded || !suppliedSignature) return null;
	const expected = Buffer.from(sign(encoded));
	const supplied = Buffer.from(suppliedSignature);
	if (
		expected.length !== supplied.length ||
		!timingSafeEqual(expected, supplied)
	) {
		return null;
	}
	let payload: InternalMcpTokenPayload;
	try {
		payload = JSON.parse(
			Buffer.from(encoded, "base64url").toString("utf8"),
		) as InternalMcpTokenPayload;
	} catch {
		return null;
	}
	if (payload.expiresAt < Date.now()) return null;
	const user = await db.query.users.findFirst({
		where: eq(users.id, payload.userId),
		columns: { id: true, name: true, email: true, image: true },
	});
	if (!user) return null;
	return {
		keyId: "internal-mcp",
		user,
		scopes: parseApiKeyScopes(payload.scopes),
	};
}
