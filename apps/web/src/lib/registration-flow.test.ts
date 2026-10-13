import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildEmailSignupPayload,
	safeSignupRedirect,
} from "./registration-flow";

test("email signup preserves the instance redirect through email verification", () => {
	const callbackURL = "/library";
	assert.equal(
		buildEmailSignupPayload({
			name: "Paid User",
			email: "paid@example.test",
			password: "secret-password",
			callbackURL,
		}).callbackURL,
		callbackURL,
	);
});

test("signup redirects reject external and protocol-relative targets", () => {
	assert.equal(safeSignupRedirect("https://attacker.example"), "/library");
	assert.equal(safeSignupRedirect("//attacker.example"), "/library");
	assert.equal(safeSignupRedirect("/library"), "/library");
});
