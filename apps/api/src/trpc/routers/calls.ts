import { randomUUID } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";
import { z } from "zod";
import { appErrorCodes, createAppError } from "../../lib/app-errors";
import { resolveLiveKitConfig } from "../../lib/instance-settings";
import { requireBoardMember } from "../../lib/permissions";
import { protectedProcedure, router } from "../init";

async function requireLiveKitConfig(ctx: {
	db: Parameters<typeof resolveLiveKitConfig>[0];
}) {
	const livekit = await resolveLiveKitConfig(ctx.db);
	if (!livekit) {
		throw createAppError({
			code: "BAD_REQUEST",
			appErrorCode: appErrorCodes.callsUnavailable,
			message: "Calls sind auf dieser Skedra-Instanz nicht aktiviert",
		});
	}

	return livekit;
}

function getBoardCallRoomName(boardId: string) {
	return `skedra-board-${boardId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export const callsRouter = router({
	getConfig: protectedProcedure.query(async ({ ctx }) => {
		const livekit = await resolveLiveKitConfig(ctx.db);
		return {
			enabled: !!livekit,
			provider: livekit?.provider ?? ("none" as const),
		};
	}),

	issueToken: protectedProcedure
		.input(z.object({ whiteboardId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const livekit = await requireLiveKitConfig(ctx);
			const access = await requireBoardMember(ctx, input.whiteboardId);
			const roomName = getBoardCallRoomName(access.whiteboard.id);
			const participantIdentity = `${ctx.user.id}-${randomUUID().slice(0, 8)}`;

			const token = new AccessToken(livekit.apiKey, livekit.apiSecret, {
				identity: participantIdentity,
				name: ctx.user.name,
				ttl: livekit.tokenTtlSeconds,
				metadata: JSON.stringify({
					userId: ctx.user.id,
					whiteboardId: access.whiteboard.id,
					accessLevel: access.accessLevel,
				}),
			});

			token.addGrant({
				room: roomName,
				roomJoin: true,
				canPublish: true,
				canPublishData: true,
				canSubscribe: true,
			});

			return {
				provider: "livekit" as const,
				serverUrl: livekit.serverUrl,
				roomName,
				token: await token.toJwt(),
				expiresInSeconds: livekit.tokenTtlSeconds,
			};
		}),
});
