import { workspaceSubscriptions } from "@skedra/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
	getBillingSettingsUrl,
	getStripeClient,
	getStripePlan,
	isStripeBillingConfigured,
	stripePlanCodes,
} from "../../lib/stripe";
import { getWorkspaceSeatCount } from "../../lib/stripe-billing";
import {
	getManagedWorkspace,
	requireManagedWorkspace,
} from "../../lib/workspace";
import { protectedProcedure, router } from "../init";

const activeSubscriptionStatuses = new Set([
	"active",
	"trialing",
	"past_due",
	"unpaid",
	"incomplete",
]);

function assertStripeBillingConfigured() {
	if (!isStripeBillingConfigured()) {
		throw new Error("Stripe Billing ist für diese Instanz nicht aktiviert.");
	}
}

async function getOrCreateStripeCustomer(input: {
	db: Parameters<typeof getManagedWorkspace>[0];
	team: { id: string; name: string };
	user: { id: string; name: string; email: string };
}) {
	const existing = await input.db.query.workspaceSubscriptions.findFirst({
		where: eq(workspaceSubscriptions.teamId, input.team.id),
	});
	if (existing) return existing;

	const stripe = getStripeClient();
	const customer = await stripe.customers.create(
		{
			name: input.team.name,
			email: input.user.email,
			metadata: {
				skedra_workspace_id: input.team.id,
				skedra_owner_id: input.user.id,
			},
		},
		{ idempotencyKey: `skedra-customer-${input.team.id}` },
	);

	await input.db
		.insert(workspaceSubscriptions)
		.values({ teamId: input.team.id, stripeCustomerId: customer.id })
		.onConflictDoNothing();

	const saved = await input.db.query.workspaceSubscriptions.findFirst({
		where: eq(workspaceSubscriptions.teamId, input.team.id),
	});
	if (!saved) throw new Error("Stripe-Kunde konnte nicht gespeichert werden.");
	return saved;
}

export const billingRouter = router({
	getStatus: protectedProcedure.query(async ({ ctx }) => {
		if (!isStripeBillingConfigured()) {
			return {
				available: false,
				configured: false,
				canManageWorkspace: false,
				workspaceName: null,
				subscription: null,
			};
		}

		const workspace = await getManagedWorkspace(ctx.db, ctx.user.id);
		if (!workspace) {
			return {
				available: true,
				configured: isStripeBillingConfigured(),
				canManageWorkspace: false,
				workspaceName: null,
				subscription: null,
			};
		}

		const subscription = await ctx.db.query.workspaceSubscriptions.findFirst({
			where: eq(workspaceSubscriptions.teamId, workspace.team.id),
		});
		return {
			available: true,
			configured: isStripeBillingConfigured(),
			canManageWorkspace: workspace.canManageWorkspace,
			workspaceName: workspace.team.name,
			subscription,
		};
	}),

	createCheckoutSession: protectedProcedure
		.input(z.object({ plan: z.enum(stripePlanCodes) }))
		.mutation(async ({ ctx, input }) => {
			assertStripeBillingConfigured();

			const workspace = await requireManagedWorkspace(ctx.db, ctx.user.id);
			const subscription = await getOrCreateStripeCustomer({
				db: ctx.db,
				team: workspace.team,
				user: ctx.user,
			});
			if (
				subscription.stripeSubscriptionId &&
				activeSubscriptionStatuses.has(subscription.status)
			) {
				throw new Error(
					"Dieses Workspace-Abo wird bereits verwaltet. Öffne stattdessen das Kundenportal.",
				);
			}

			const stripe = getStripeClient();
			const plan = getStripePlan(input.plan);
			const seatCount = await getWorkspaceSeatCount(ctx.db, workspace.team);
			const session = await stripe.checkout.sessions.create(
				{
					mode: "subscription",
					customer: subscription.stripeCustomerId,
					line_items: [{ price: plan.priceId, quantity: seatCount }],
					automatic_tax: { enabled: true },
					tax_id_collection: { enabled: true },
					billing_address_collection: "auto",
					customer_update: { address: "auto", name: "auto" },
					metadata: {
						skedra_workspace_id: workspace.team.id,
						skedra_owner_id: ctx.user.id,
						skedra_plan: plan.code,
					},
					subscription_data: {
						metadata: {
							skedra_workspace_id: workspace.team.id,
							skedra_owner_id: ctx.user.id,
							skedra_plan: plan.code,
						},
					},
					success_url: `${getBillingSettingsUrl("success")}&session_id={CHECKOUT_SESSION_ID}`,
					cancel_url: getBillingSettingsUrl("canceled"),
				},
				{
					idempotencyKey: `skedra-checkout-${workspace.team.id}-${plan.priceId}-${subscription.stripeSubscriptionId ?? "new"}`,
				},
			);
			if (!session.url)
				throw new Error("Stripe hat keine Checkout-URL zurückgegeben.");
			return { url: session.url };
		}),

	createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
		assertStripeBillingConfigured();

		const workspace = await requireManagedWorkspace(ctx.db, ctx.user.id);
		const subscription = await ctx.db.query.workspaceSubscriptions.findFirst({
			where: eq(workspaceSubscriptions.teamId, workspace.team.id),
		});
		if (!subscription) {
			throw new Error(
				"Für diesen Workspace gibt es noch kein Stripe-Kundenkonto.",
			);
		}

		const session = await getStripeClient().billingPortal.sessions.create({
			customer: subscription.stripeCustomerId,
			return_url: getBillingSettingsUrl(),
			locale: "de",
		});
		return { url: session.url };
	}),
});
