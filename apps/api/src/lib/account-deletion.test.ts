import assert from "node:assert/strict";
import test from "node:test";
import { deleteStripeCustomerAndCancelSubscriptions } from "./account-deletion";

test("account deletion requires Stripe to confirm customer and subscription deletion", async () => {
	let deletedCustomerId = "";
	await deleteStripeCustomerAndCancelSubscriptions(
		{
			customers: {
				del: async (customerId) => {
					deletedCustomerId = customerId;
					return { deleted: true };
				},
			},
		},
		"cus_active_subscription",
	);

	assert.equal(deletedCustomerId, "cus_active_subscription");
});

test("account deletion stops when Stripe does not confirm cancellation", async () => {
	await assert.rejects(
		deleteStripeCustomerAndCancelSubscriptions(
			{
				customers: {
					del: async () => ({ deleted: false }),
				},
			},
			"cus_unconfirmed",
		),
		/Stripe did not confirm customer deletion/,
	);
});

test("account deletion stops when Stripe cancellation fails", async () => {
	await assert.rejects(
		deleteStripeCustomerAndCancelSubscriptions(
			{
				customers: {
					del: async () => {
						throw new Error("Stripe unavailable");
					},
				},
			},
			"cus_failed",
		),
		/Stripe unavailable/,
	);
});

test("account deletion remains retry-safe when the Stripe customer is already gone", async () => {
	await assert.doesNotReject(
		deleteStripeCustomerAndCancelSubscriptions(
			{
				customers: {
					del: async () => {
						throw { code: "resource_missing" };
					},
				},
			},
			"cus_already_deleted",
		),
	);
});
