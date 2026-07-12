import { userSubscriptions } from "@skedra/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "../../env";
import { getUserSubscriptionEntitlement } from "../../lib/billing-entitlement";
import {
	getBillingSettingsUrl,
	getStripeClient,
	getStripePlan,
	isStripeBillingConfigured,
	stripePlanCodes,
} from "../../lib/stripe";
import { protectedProcedure, publicProcedure, router } from "../init";

const existingSubscriptionStatuses = new Set([
	"active",
	"trialing",
	"past_due",
	"unpaid",
	"incomplete",
]);

function assertStripeBillingConfigured() {
	if (
		env.SKEDRA_DEPLOYMENT_MODE !== "managed" ||
		!isStripeBillingConfigured()
	) {
		throw new Error("Stripe Billing ist fuer diese Instanz nicht aktiviert.");
	}
}

async function getOrCreateStripeCustomer(input: {
	db: Parameters<typeof getUserSubscriptionEntitlement>[0];
	user: { id: string; name: string; email: string };
}) {
	const existing = await input.db.query.userSubscriptions.findFirst({
		where: eq(userSubscriptions.userId, input.user.id),
	});
	if (existing) return existing;

	const customer = await getStripeClient().customers.create(
		{
			name: input.user.name,
			email: input.user.email,
			metadata: { skedra_user_id: input.user.id },
		},
		{ idempotencyKey: `skedra-customer-user-${input.user.id}` },
	);

	await input.db
		.insert(userSubscriptions)
		.values({ userId: input.user.id, stripeCustomerId: customer.id })
		.onConflictDoNothing();

	const saved = await input.db.query.userSubscriptions.findFirst({
		where: eq(userSubscriptions.userId, input.user.id),
	});
	if (!saved) throw new Error("Stripe-Kunde konnte nicht gespeichert werden.");
	return saved;
}

export const billingRouter = router({
	getPublicConfig: publicProcedure.query(() => ({
		managed: env.SKEDRA_DEPLOYMENT_MODE === "managed",
		configured: isStripeBillingConfigured(),
	})),

	getStatus: protectedProcedure.query(async ({ ctx }) => {
		if (env.SKEDRA_DEPLOYMENT_MODE !== "managed") {
			return {
				available: false,
				configured: true,
				accessGranted: true,
				canManageWorkspace: true,
				workspaceName: null,
				subscription: null,
			};
		}

		const entitlement = await getUserSubscriptionEntitlement(
			ctx.db,
			ctx.user.id,
		);
		return {
			available: true,
			configured: isStripeBillingConfigured(),
			accessGranted: entitlement.accessGranted,
			canManageWorkspace: true,
			workspaceName: ctx.user.name,
			subscription: entitlement.subscription,
		};
	}),

	createCheckoutSession: protectedProcedure
		.input(
			z.object({
				plan: z.enum(stripePlanCodes),
				redirect: z.string().max(2048).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			assertStripeBillingConfigured();
			const stored = await getOrCreateStripeCustomer({
				db: ctx.db,
				user: ctx.user,
			});
			if (
				stored.stripeSubscriptionId &&
				existingSubscriptionStatuses.has(stored.status)
			) {
				throw new Error(
					"Dieses Abo wird bereits verwaltet. Oeffne stattdessen das Kundenportal.",
				);
			}

			const plan = getStripePlan(input.plan);
			const session = await getStripeClient().checkout.sessions.create({
				mode: "subscription",
				customer: stored.stripeCustomerId,
				line_items: [{ price: plan.priceId, quantity: 1 }],
				automatic_tax: { enabled: true },
				tax_id_collection: { enabled: true },
				billing_address_collection: "auto",
				customer_update: { address: "auto", name: "auto" },
				metadata: {
					skedra_user_id: ctx.user.id,
					skedra_plan: plan.code,
				},
				subscription_data: {
					metadata: {
						skedra_user_id: ctx.user.id,
						skedra_plan: plan.code,
					},
				},
				success_url: `${getBillingSettingsUrl("success", input.redirect)}&session_id={CHECKOUT_SESSION_ID}`,
				cancel_url: getBillingSettingsUrl("canceled", input.redirect),
			});
			if (!session.url)
				throw new Error("Stripe hat keine Checkout-URL zurueckgegeben.");
			return { url: session.url };
		}),

	createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
		assertStripeBillingConfigured();
		const stored = await ctx.db.query.userSubscriptions.findFirst({
			where: eq(userSubscriptions.userId, ctx.user.id),
		});
		if (!stored) {
			throw new Error(
				"Fuer dieses Konto gibt es noch kein Stripe-Kundenkonto.",
			);
		}

		const session = await getStripeClient().billingPortal.sessions.create({
			customer: stored.stripeCustomerId,
			return_url: getBillingSettingsUrl(),
			locale: "de",
		});
		return { url: session.url };
	}),
});
