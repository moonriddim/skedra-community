import assert from "node:assert/strict";
import test from "node:test";
import { subscriptionGrantsProductAccess } from "./access-policy";

test("only active and trialing user subscriptions unlock SaaS access", () => {
	assert.equal(subscriptionGrantsProductAccess("active"), true);
	assert.equal(subscriptionGrantsProductAccess("trialing"), true);
	assert.equal(subscriptionGrantsProductAccess("past_due"), false);
	assert.equal(subscriptionGrantsProductAccess("unpaid"), false);
	assert.equal(subscriptionGrantsProductAccess("canceled"), false);
	assert.equal(subscriptionGrantsProductAccess(null), false);
});
