import { type Database, whiteboards } from "@skedra/db";
import {
	getWhiteboardPresentationShareSettings,
	isPresentationCurrentlyActive,
} from "@skedra/shared";
import { eq } from "drizzle-orm";

export function createPresentationShareToken() {
	return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

export {
	getWhiteboardPresentationShareSettings,
	isPresentationCurrentlyActive,
};

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
