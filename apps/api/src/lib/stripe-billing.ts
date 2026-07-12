import {
	type Database,
	stripeWebhookEvents,
	teamMembers,
	teams,
	workspaceSubscriptions,
} from "@skedra/db";
import { and, count, eq, ne } from "drizzle-orm";
import type Stripe from "stripe";
import { getStripeClient, isStripeBillingConfigured } from "./stripe";

const billableSubscriptionStatuses = new Set([
	"active",
	"trialing",
	"past_due",
	"unpaid",
	"incomplete",
]);

type BillingWorkspace = { id: string; ownerId: string };

export async function getWorkspaceSeatCount(
	db: Database,
	workspace: BillingWorkspace,
) {
	const [result] = await db
		.select({ memberCount: count() })
		.from(teamMembers)
		.where(
			and(
				eq(teamMembers.teamId, workspace.id),
				ne(teamMembers.userId, workspace.ownerId),
			),
		);
	return (result?.memberCount ?? 0) + 1;
}

/** Keep a per-editor Stripe subscription quantity in sync with workspace access. */
export async function syncWorkspaceSubscriptionSeats(
	db: Database,
	workspace: BillingWorkspace,
) {
	if (!isStripeBillingConfigured()) return;

	const stored = await db.query.workspaceSubscriptions.findFirst({
		where: eq(workspaceSubscriptions.teamId, workspace.id),
	});
	if (
		!stored?.stripeSubscriptionId ||
		!billableSubscriptionStatuses.has(stored.status)
	) {
		return;
	}

	const stripe = getStripeClient();
	const subscription = await stripe.subscriptions.retrieve(
		stored.stripeSubscriptionId,
	);
	const item = subscription.items.data[0];
	if (!item) return;

	const seatCount = await getWorkspaceSeatCount(db, workspace);
	if (item.quantity === seatCount) return;

	await stripe.subscriptions.update(subscription.id, {
		items: [{ id: item.id, quantity: seatCount }],
		proration_behavior: "create_prorations",
	});
}

function stripeObjectId(
	value: string | { id: string } | null | undefined,
): string | null {
	if (!value) return null;
	return typeof value === "string" ? value : value.id;
}

function workspaceIdFromMetadata(metadata: Stripe.Metadata) {
	const workspaceId = metadata.skedra_workspace_id;
	return workspaceId?.trim() || null;
}

async function syncCheckoutSession(
	db: Database,
	session: Stripe.Checkout.Session,
) {
	const teamId = workspaceIdFromMetadata(session.metadata ?? {});
	const stripeCustomerId = stripeObjectId(session.customer);
	const stripeSubscriptionId = stripeObjectId(session.subscription);
	if (!teamId || !stripeCustomerId) return;

	const current = await db.query.workspaceSubscriptions.findFirst({
		where: eq(workspaceSubscriptions.teamId, teamId),
	});
	if (current?.stripeSubscriptionId || !stripeSubscriptionId) return;

	await db
		.update(workspaceSubscriptions)
		.set({ stripeSubscriptionId, updatedAt: new Date() })
		.where(eq(workspaceSubscriptions.teamId, teamId));
}

async function syncSubscription(
	db: Database,
	subscription: Stripe.Subscription,
	eventCreatedAt: Date,
) {
	const stripeCustomerId = stripeObjectId(subscription.customer);
	if (!stripeCustomerId) return;

	const metadataTeamId = workspaceIdFromMetadata(subscription.metadata);
	const byCustomer = metadataTeamId
		? null
		: await db.query.workspaceSubscriptions.findFirst({
				where: eq(workspaceSubscriptions.stripeCustomerId, stripeCustomerId),
			});
	const teamId = metadataTeamId ?? byCustomer?.teamId;
	if (!teamId) return;
	const workspace = await db.query.teams.findFirst({
		where: eq(teams.id, teamId),
		columns: { id: true, ownerId: true },
	});
	if (!workspace) return;

	const current = await db.query.workspaceSubscriptions.findFirst({
		where: eq(workspaceSubscriptions.teamId, teamId),
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
		.insert(workspaceSubscriptions)
		.values({
			teamId,
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
			target: workspaceSubscriptions.teamId,
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
			// The accompanying subscription event sets the authoritative access state.
			// Recording this event still keeps the delivery observable and idempotent.
			return;
		default:
			return;
	}
}

/**
 * Stripe retries webhooks, so claim each event ID once. If processing fails,
 * release the claim and return an error so Stripe retries the delivery.
 */
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
