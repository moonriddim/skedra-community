import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { RealtimeRole } from "./types";

const realtimeRoleSchema = z.enum([
	"owner",
	"editor",
	"viewer",
]) satisfies z.ZodType<RealtimeRole>;

const realtimeTokenPayloadSchema = z.object({
	v: z.literal(1),
	userId: z.string().min(1),
	whiteboardId: z.string().uuid(),
	accessType: z
		.enum(["member", "presentation", "collabLink", "embed"])
		.default("member"),
	presentationShareToken: z.string().min(1).optional(),
	collabShareToken: z.string().min(1).optional(),
	embedShareToken: z.string().min(1).optional(),
	role: realtimeRoleSchema,
	name: z.string().min(1),
	image: z.string().nullable().optional(),
	exp: z.number().int().positive(),
});

export type RealtimeAuthTokenPayload = z.infer<
	typeof realtimeTokenPayloadSchema
>;

function base64UrlEncode(value: string) {
	return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
	return Buffer.from(value, "base64url").toString("utf8");
}

function createSignature(encodedPayload: string, secret: string) {
	return createHmac("sha256", secret)
		.update(encodedPayload)
		.digest("base64url");
}

export function createRealtimeAuthToken(
	payload: RealtimeAuthTokenPayload,
	secret: string,
) {
	const encodedPayload = base64UrlEncode(JSON.stringify(payload));
	const signature = createSignature(encodedPayload, secret);
	return `${encodedPayload}.${signature}`;
}

export function verifyRealtimeAuthToken(token: string, secret: string) {
	const [encodedPayload, signature] = token.split(".");

	if (!encodedPayload || !signature) {
		throw new Error("ungueltiges-token-format");
	}

	const expectedSignature = createSignature(encodedPayload, secret);
	const receivedBuffer = Buffer.from(signature, "utf8");
	const expectedBuffer = Buffer.from(expectedSignature, "utf8");

	if (
		receivedBuffer.length !== expectedBuffer.length ||
		!timingSafeEqual(receivedBuffer, expectedBuffer)
	) {
		throw new Error("ungueltige-token-signatur");
	}

	const payload = realtimeTokenPayloadSchema.parse(
		JSON.parse(base64UrlDecode(encodedPayload)),
	);

	if (payload.exp <= Math.floor(Date.now() / 1000)) {
		throw new Error("token-abgelaufen");
	}

	return payload;
}
