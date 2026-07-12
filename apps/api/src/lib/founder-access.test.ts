import assert from "node:assert/strict";
import test from "node:test";
import { hasFounderAccess } from "./founder-access";

test("allows only the configured founder account in managed mode", () => {
	assert.equal(
		hasFounderAccess({
			deploymentMode: "managed",
			founderEmail: "founder@skedra.xyz",
			accountEmail: "FOUNDER@skedra.xyz",
		}),
		true,
	);
	assert.equal(
		hasFounderAccess({
			deploymentMode: "managed",
			founderEmail: "founder@skedra.xyz",
			accountEmail: "admin@example.com",
		}),
		false,
	);
});

test("denies founder review access in selfhost and without configuration", () => {
	assert.equal(
		hasFounderAccess({
			deploymentMode: "selfhost",
			founderEmail: "founder@skedra.xyz",
			accountEmail: "founder@skedra.xyz",
		}),
		false,
	);
	assert.equal(
		hasFounderAccess({
			deploymentMode: "managed",
			accountEmail: "founder@skedra.xyz",
		}),
		false,
	);
});
