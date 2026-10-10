import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { type Database, users } from "@skedra/db";
import { type SkedraApiKeyScope, skedraApiKeyScopes } from "@skedra/shared";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "../env";
import type { AuthenticatedApiKey } from "./api-keys";

const PREFIX = "ski_mcp_";
const TTL_MS = 60_000;

const internalMcpTokenSchema = z
	.object({
		type: z.literal("internal-mcp"),
		audience: z.literal("skedra-rest-api"),
		userId: z.string().min(1),
		scopes: z.array(z.enum(skedraApiKeyScopes)).min(1),
		issuedAt: z.number().int().nonnegative(),
		expiresAt: z.number().int().nonnegative(),
		nonce: z.string().min(1),
	})
	.strict();

function sign(value: string) {
	return createHmac("sha256", env.AUTH_SECRET)
		.update("skedra:internal-mcp:v1\0")
		.update(value)
		.digest("base64url");
}

export function createInternalMcpApiToken(input: {
	userId: string;
	scopes: SkedraApiKeyScope[];
}) {
	const issuedAt = Date.now();
	const payload = internalMcpTokenSchema.parse({
		type: "internal-mcp",
		audience: "skedra-rest-api",
		userId: input.userId,
		scopes: input.scopes,
		issuedAt,
		expiresAt: issuedAt + TTL_MS,
		nonce: randomBytes(12).toString("base64url"),
	});
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `${PREFIX}${encoded}.${sign(encoded)}`;
}

export async function authenticateInternalMcpApiToken(
	db: Database,
	token: string,
): Promise<AuthenticatedApiKey | null> {
	if (!token.startsWith(PREFIX)) return null;
	const parts = token.slice(PREFIX.length).split(".");
	const [encoded, suppliedSignature] = parts;
	if (parts.length !== 2 || !encoded || !suppliedSignature) return null;
	const expected = Buffer.from(sign(encoded));
	const supplied = Buffer.from(suppliedSignature);
	if (
		expected.length !== supplied.length ||
		!timingSafeEqual(expected, supplied)
	) {
		return null;
	}
	let payload: z.infer<typeof internalMcpTokenSchema>;
	try {
		payload = internalMcpTokenSchema.parse(
			JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
		);
	} catch {
		return null;
	}
	const now = Date.now();
	if (
		payload.issuedAt > now ||
		payload.expiresAt <= now ||
		payload.expiresAt <= payload.issuedAt ||
		payload.expiresAt - payload.issuedAt > TTL_MS
	)
		return null;
	const user = await db.query.users.findFirst({
		where: eq(users.id, payload.userId),
		columns: { id: true, name: true, email: true, image: true },
	});
	if (!user) return null;
	return {
		keyId: "internal-mcp",
		user,
		scopes: payload.scopes,
	};
}
