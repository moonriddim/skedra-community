import {
	assets,
	registrationInvites,
	userSubscriptions,
	whiteboardE2eeUpdates,
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

interface StripeCustomerDeletionClient {
	customers: {
		del: (customerId: string) => Promise<{ deleted?: boolean }>;
	};
}

/**
 * Stripe guarantees that deleting a customer immediately cancels every active
 * subscription attached to that customer. Account deletion must stop unless
 * Stripe confirms that deletion, so a paid subscription cannot be orphaned.
 */
export async function deleteStripeCustomerAndCancelSubscriptions(
	stripe: StripeCustomerDeletionClient,
	stripeCustomerId: string,
) {
	try {
		const deletedCustomer = await stripe.customers.del(stripeCustomerId);
		if (deletedCustomer.deleted !== true) {
			throw new Error(
				"Stripe did not confirm customer deletion and subscription cancellation.",
			);
		}
	} catch (error) {
		// A missing customer cannot still hold an active Stripe subscription. This
		// also keeps retries idempotent after Stripe succeeded but the local delete
		// was interrupted later in the workflow.
		if (!isMissingStripeResource(error)) throw error;
	}
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

	// Deleting the Stripe customer also terminates active subscriptions. Stripe
	// may retain legally required transaction records independently of Skedra.
	await deleteStripeCustomerAndCancelSubscriptions(
		getStripeClient(),
		subscription.stripeCustomerId,
	);
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

	// Updates on boards owned by other users remain part of those boards, but the
	// deleted account must no longer be identifiable as their author.
	await db
		.update(whiteboardE2eeUpdates)
		.set({ userId: null })
		.where(eq(whiteboardE2eeUpdates.userId, user.id));
}
