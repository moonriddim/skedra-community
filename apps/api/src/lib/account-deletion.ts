import {
	assets,
	registrationInvites,
	userSubscriptions,
	whiteboards,
} from "@skedra/db";
import { eq, or } from "drizzle-orm";
import { env } from "../env";
import { deleteAssetObjects } from "./assets";
import { db } from "./db";
import { getStripeClient } from "./stripe";

function isMissingStripeResource(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "resource_missing"
	);
}

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

async function deleteStripeCustomer(userId: string) {
	if (env.SKEDRA_DEPLOYMENT_MODE !== "managed") return;

	const subscription = await db.query.userSubscriptions.findFirst({
		where: eq(userSubscriptions.userId, userId),
		columns: { stripeCustomerId: true },
	});
	if (!subscription) return;

	try {
		// Deleting the Stripe customer also terminates active subscriptions. Stripe
		// may retain legally required transaction records independently of Skedra.
		await getStripeClient().customers.del(subscription.stripeCustomerId);
	} catch (error) {
		if (!isMissingStripeResource(error)) throw error;
	}
}

/**
 * Removes external objects and provider-side customer data before the database
 * user row is deleted. Database-owned records then disappear through FK
 * cascades, including boards, workspaces, integrations, keys, sessions and 2FA.
 */
export async function prepareCompleteAccountDeletion(user: {
	id: string;
	email: string;
}) {
	await deleteStoredAssetObjects(user.id);
	await deleteStripeCustomer(user.id);

	// Invitations are keyed by email rather than user id and therefore are not
	// covered by the database cascades.
	await db
		.delete(registrationInvites)
		.where(eq(registrationInvites.email, user.email.toLowerCase().trim()));
}
