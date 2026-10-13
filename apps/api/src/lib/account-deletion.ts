import {
	assets,
	registrationInvites,
	whiteboardE2eeUpdates,
	whiteboards,
} from "@skedra/db";
import { eq, or } from "drizzle-orm";
import { deleteAssetObjects } from "./assets";
import { db } from "./db";
import { deleteProfileImageObjectForUser } from "./profile-images";

async function deleteStoredAssetObjects(userId: string) {
	const objects = await db
		.select({ id: assets.id, bucket: assets.bucket, key: assets.key })
		.from(assets)
		.innerJoin(whiteboards, eq(whiteboards.id, assets.whiteboardId))
		.where(or(eq(assets.ownerId, userId), eq(whiteboards.ownerId, userId)));

	const result = await deleteAssetObjects({ db, objects });
	if (result.failed > 0 || result.skipped > 0) {
		throw new Error(
			"Account deletion stopped because stored asset objects could not be removed.",
		);
	}
}

/**
 * Removes external objects before the database
 * user row is deleted. Database-owned records then disappear through FK
 * cascades, including boards, workspaces, integrations, keys, sessions and 2FA.
 */
export async function prepareCompleteAccountDeletion(user: {
	id: string;
	email: string;
}) {
	await deleteStoredAssetObjects(user.id);
	await deleteProfileImageObjectForUser(db, user.id);

	// Invitations are keyed by email rather than user id and therefore are not
	// covered by the database cascades.
	await db
		.delete(registrationInvites)
		.where(eq(registrationInvites.email, user.email.toLowerCase().trim()));

	// Updates on boards owned by other users remain part of those boards, but the
	// deleted account must no longer be identifiable as their author.
	await db
		.update(whiteboardE2eeUpdates)
		.set({ userId: null })
		.where(eq(whiteboardE2eeUpdates.userId, user.id));
}
