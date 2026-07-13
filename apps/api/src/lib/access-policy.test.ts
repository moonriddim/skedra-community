import assert from "node:assert/strict";
import test from "node:test";
import {
	complimentaryGrantIsActive,
	subscriptionGrantsProductAccess,
} from "./access-policy";

test("only active and trialing subscriptions grant product access", () => {
	assert.equal(subscriptionGrantsProductAccess("active"), true);
	assert.equal(subscriptionGrantsProductAccess("trialing"), true);
	assert.equal(subscriptionGrantsProductAccess("past_due"), false);
	assert.equal(subscriptionGrantsProductAccess(null), false);
});

test("complimentary access can be permanent or time limited", () => {
	const now = new Date("2026-07-13T12:00:00.000Z");
	assert.equal(complimentaryGrantIsActive({ now }), true);
	assert.equal(
		complimentaryGrantIsActive({
			now,
			expiresAt: new Date("2026-07-14T12:00:00.000Z"),
		}),
		true,
	);
	assert.equal(
		complimentaryGrantIsActive({
			now,
			expiresAt: new Date("2026-07-12T12:00:00.000Z"),
		}),
		false,
	);
	assert.equal(
		complimentaryGrantIsActive({
			now,
			revokedAt: new Date("2026-07-13T11:00:00.000Z"),
		}),
		false,
	);
});
