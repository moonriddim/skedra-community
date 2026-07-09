/**
 * Excalidraw+-ähnlicher Kollaborations-Link pro Board (view/edit, Gäste).
 */

import { type Database, whiteboards } from "@skedra/db";
import { eq } from "drizzle-orm";
import { createPresentationShareToken } from "./presentation";

export {
	createPresentationShareToken as createCollabShareToken,
	createPresentationShareToken as createEmbedShareToken,
};

export async function getCollabShareAccess(db: Database, shareToken: string) {
	const whiteboard = await db.query.whiteboards.findFirst({
		where: eq(whiteboards.collabShareToken, shareToken),
	});

	if (
		!whiteboard ||
		!whiteboard.collabShareEnabled ||
		!whiteboard.collabShareToken
	) {
		throw new Error("collab-share-not-found");
	}

	if (whiteboard.archivedAt) {
		throw new Error("collab-share-not-found");
	}

	const canWrite = whiteboard.collabShareAccessLevel === "edit";

	return { whiteboard, canWrite };
}

export async function getEmbedShareAccess(db: Database, shareToken: string) {
	const whiteboard = await db.query.whiteboards.findFirst({
		where: eq(whiteboards.embedShareToken, shareToken),
	});

	if (
		!whiteboard ||
		!whiteboard.embedShareEnabled ||
		!whiteboard.embedShareToken
	) {
		throw new Error("embed-share-not-found");
	}

	if (whiteboard.archivedAt) {
		throw new Error("embed-share-not-found");
	}

	return { whiteboard, canWrite: false };
}
