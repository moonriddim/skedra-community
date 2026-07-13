import {
	type Database,
	whiteboardPresentationAudience,
	whiteboards,
} from "@skedra/db";
import {
	getWhiteboardPresentationShareSettings,
	isPresentationCurrentlyActive,
} from "@skedra/shared";
import { and, count, eq, gt, lt } from "drizzle-orm";

export function createPresentationShareToken() {
	return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

export {
	getWhiteboardPresentationShareSettings,
	isPresentationCurrentlyActive,
};

export function isAuthorizedPresentationSession(
	presentation: {
		presentationSessionId: string | null;
		presentationPresenterId: string | null;
		presentationActiveUntil: Date | null;
	},
	input: { sessionId: string; presenterId: string },
	now = new Date(),
) {
	return (
		presentation.presentationSessionId === input.sessionId &&
		presentation.presentationPresenterId === input.presenterId &&
		!!presentation.presentationActiveUntil &&
		presentation.presentationActiveUntil.getTime() > now.getTime()
	);
}

export function presentationFrameAllowsAsset(
	presentation: {
		id: string;
		presentationSessionId: string | null;
		presentationActiveUntil: Date | null;
		presentationFrameAssetIds: string | null;
	},
	input: { whiteboardId: string; assetId: string },
	now = new Date(),
) {
	if (
		presentation.id !== input.whiteboardId ||
		!presentation.presentationSessionId ||
		!presentation.presentationActiveUntil ||
		presentation.presentationActiveUntil.getTime() <= now.getTime() ||
		!presentation.presentationFrameAssetIds
	) {
		return false;
	}
	try {
		const assetIds = JSON.parse(
			presentation.presentationFrameAssetIds,
		) as unknown;
		return (
			Array.isArray(assetIds) &&
			assetIds.length <= 10_000 &&
			assetIds.includes(input.assetId)
		);
	} catch {
		return false;
	}
}

export async function getPresentationShareAccess(
	db: Database,
	shareToken: string,
) {
	const whiteboard = await db.query.whiteboards.findFirst({
		where: eq(whiteboards.presentationShareToken, shareToken),
	});

	if (
		!whiteboard ||
		!whiteboard.presentationShareEnabled ||
		!whiteboard.presentationShareToken
	) {
		throw new Error("presentation-share-not-found");
	}

	if (whiteboard.archivedAt) {
		throw new Error("presentation-share-not-found");
	}

	const shareSettings = getWhiteboardPresentationShareSettings(whiteboard);
	if (
		shareSettings.accessMode === "presentation-only" &&
		!isPresentationCurrentlyActive(whiteboard.presentationActiveUntil)
	) {
		throw new Error("presentation-share-inactive");
	}

	return { whiteboard, shareSettings };
}

export async function countPresentationAudience(
	db: Database,
	whiteboardId: string,
	sessionId: string,
) {
	await db
		.delete(whiteboardPresentationAudience)
		.where(lt(whiteboardPresentationAudience.expiresAt, new Date()));
	const [result] = await db
		.select({ value: count() })
		.from(whiteboardPresentationAudience)
		.where(
			and(
				eq(whiteboardPresentationAudience.whiteboardId, whiteboardId),
				eq(whiteboardPresentationAudience.sessionId, sessionId),
				gt(whiteboardPresentationAudience.expiresAt, new Date()),
			),
		);
	return result?.value ?? 0;
}

export async function refreshPresentationAudienceConnection(
	db: Database,
	input: {
		connectionId: string;
		whiteboardId: string;
		sessionId: string;
	},
) {
	await db
		.insert(whiteboardPresentationAudience)
		.values({
			...input,
			expiresAt: new Date(Date.now() + 45_000),
		})
		.onConflictDoUpdate({
			target: whiteboardPresentationAudience.connectionId,
			set: {
				whiteboardId: input.whiteboardId,
				sessionId: input.sessionId,
				expiresAt: new Date(Date.now() + 45_000),
			},
		});
}

export async function removePresentationAudienceConnection(
	db: Database,
	connectionId: string,
) {
	await db
		.delete(whiteboardPresentationAudience)
		.where(eq(whiteboardPresentationAudience.connectionId, connectionId));
}

/**
 * End exactly one presenter-owned session and remove every audience lease that
 * belongs to it. The session predicate makes duplicate lifecycle signals safe.
 */
export async function endPresentationSession(
	db: Database,
	input: {
		whiteboardId: string;
		sessionId: string;
		presenterId: string;
	},
) {
	const [updated] = await db
		.update(whiteboards)
		.set({
			presentationActiveUntil: null,
			presentationSessionId: null,
			presentationPresenterId: null,
			presentationFrameSequence: null,
			presentationFramePayload: null,
			presentationFrameAssetIds: null,
			presentationFrameUpdatedAt: null,
		})
		.where(
			and(
				eq(whiteboards.id, input.whiteboardId),
				eq(whiteboards.presentationSessionId, input.sessionId),
				eq(whiteboards.presentationPresenterId, input.presenterId),
			),
		)
		.returning({ id: whiteboards.id });

	if (!updated) return false;

	await db
		.delete(whiteboardPresentationAudience)
		.where(
			and(
				eq(whiteboardPresentationAudience.whiteboardId, input.whiteboardId),
				eq(whiteboardPresentationAudience.sessionId, input.sessionId),
			),
		);
	return true;
}
