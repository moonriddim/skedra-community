import {
	type Database,
	stripeWebhookEvents,
	userSubscriptions,
	users,
} from "@skedra/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

function stripeObjectId(
	value: string | { id: string } | null | undefined,
): string | null {
	if (!value) return null;
	return typeof value === "string" ? value : value.id;
}

function userIdFromMetadata(metadata: Stripe.Metadata) {
	return metadata.skedra_user_id?.trim() || null;
}

async function syncCheckoutSession(
	db: Database,
	session: Stripe.Checkout.Session,
) {
	const userId = userIdFromMetadata(session.metadata ?? {});
	const stripeCustomerId = stripeObjectId(session.customer);
	const stripeSubscriptionId = stripeObjectId(session.subscription);
	if (!userId || !stripeCustomerId || !stripeSubscriptionId) return;

	await db
		.update(userSubscriptions)
		.set({ stripeSubscriptionId, updatedAt: new Date() })
		.where(eq(userSubscriptions.userId, userId));
}

async function syncSubscription(
	db: Database,
	subscription: Stripe.Subscription,
	eventCreatedAt: Date,
) {
	const stripeCustomerId = stripeObjectId(subscription.customer);
	if (!stripeCustomerId) return;

	const metadataUserId = userIdFromMetadata(subscription.metadata);
	const byCustomer = metadataUserId
		? null
		: await db.query.userSubscriptions.findFirst({
				where: eq(userSubscriptions.stripeCustomerId, stripeCustomerId),
			});
	const userId = metadataUserId ?? byCustomer?.userId;
	if (!userId) return;

	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
		columns: { id: true },
	});
	if (!user) return;

	const current = await db.query.userSubscriptions.findFirst({
		where: eq(userSubscriptions.userId, userId),
	});
	if (
		current?.lastStripeEventCreatedAt &&
		current.lastStripeEventCreatedAt > eventCreatedAt
	) {
		return;
	}

	const firstItem = subscription.items.data[0];
	const currentPeriodEnd = firstItem
		? new Date(firstItem.current_period_end * 1000)
		: null;

	await db
		.insert(userSubscriptions)
		.values({
			userId,
			stripeCustomerId,
			stripeSubscriptionId: subscription.id,
			stripePriceId: firstItem?.price.id ?? null,
			status: subscription.status,
			cancelAtPeriodEnd: subscription.cancel_at_period_end,
			currentPeriodEnd,
			lastStripeEventCreatedAt: eventCreatedAt,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: userSubscriptions.userId,
			set: {
				stripeCustomerId,
				stripeSubscriptionId: subscription.id,
				stripePriceId: firstItem?.price.id ?? null,
				status: subscription.status,
				cancelAtPeriodEnd: subscription.cancel_at_period_end,
				currentPeriodEnd,
				lastStripeEventCreatedAt: eventCreatedAt,
				updatedAt: new Date(),
			},
		});
}

async function processStripeEvent(db: Database, event: Stripe.Event) {
	switch (event.type) {
		case "checkout.session.completed":
			await syncCheckoutSession(
				db,
				event.data.object as Stripe.Checkout.Session,
			);
			return;
		case "customer.subscription.created":
		case "customer.subscription.updated":
		case "customer.subscription.deleted":
			await syncSubscription(
				db,
				event.data.object as Stripe.Subscription,
				new Date(event.created * 1000),
			);
			return;
		case "invoice.paid":
		case "invoice.payment_failed":
			return;
		default:
			return;
	}
}

/** Stripe retries webhooks, so claim each event ID exactly once. */
export async function processStripeWebhookEvent(
	db: Database,
	event: Stripe.Event,
) {
	const [claimed] = await db
		.insert(stripeWebhookEvents)
		.values({ id: event.id, type: event.type, livemode: event.livemode })
		.onConflictDoNothing()
		.returning({ id: stripeWebhookEvents.id });
	if (!claimed) return;

	try {
		await processStripeEvent(db, event);
	} catch (error) {
		await db
			.delete(stripeWebhookEvents)
			.where(eq(stripeWebhookEvents.id, event.id));
		throw error;
	}
}
