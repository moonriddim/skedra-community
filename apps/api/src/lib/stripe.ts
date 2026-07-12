import Stripe from "stripe";
import { env } from "../env";

export const stripePlanCodes = ["pro_monthly", "pro_yearly"] as const;
export type StripePlanCode = (typeof stripePlanCodes)[number];

type StripePlan = {
	code: StripePlanCode;
	priceId: string;
};

let stripeClient: Stripe | undefined;

export function getStripeClient() {
	if (!env.STRIPE_SECRET_KEY) {
		throw new Error("Stripe ist noch nicht konfiguriert.");
	}

	stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY, {
		appInfo: { name: "Skedra", version: "0.1.0" },
	});
	return stripeClient;
}

export function getStripePlan(code: StripePlanCode): StripePlan {
	const priceId =
		code === "pro_monthly"
			? env.STRIPE_PRICE_PRO_MONTHLY
			: env.STRIPE_PRICE_PRO_YEARLY;

	if (!priceId) {
		throw new Error(`Der Stripe-Preis fuer ${code} ist nicht konfiguriert.`);
	}

	return { code, priceId };
}

export function isStripeBillingConfigured() {
	return Boolean(
		env.STRIPE_SECRET_KEY &&
			env.STRIPE_WEBHOOK_SECRET &&
			env.STRIPE_PRICE_PRO_MONTHLY &&
			env.STRIPE_PRICE_PRO_YEARLY,
	);
}

export function getBillingSettingsUrl(
	checkout?: "success" | "canceled",
	redirect?: string,
) {
	const safeRedirect =
		redirect?.startsWith("/") &&
		!redirect.startsWith("//") &&
		!redirect.includes("\\")
			? redirect
			: undefined;
	const url = new URL(safeRedirect ? "/subscribe" : "/settings", env.APP_URL);
	if (safeRedirect) url.searchParams.set("redirect", safeRedirect);
	else url.searchParams.set("tab", "billing");
	if (checkout) url.searchParams.set("checkout", checkout);
	return url.toString();
}
