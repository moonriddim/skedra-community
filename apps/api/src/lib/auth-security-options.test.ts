import assert from "node:assert/strict";
import test from "node:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { authSecurityOptions } from "./auth-security-options";

function fixture() {
	return betterAuth({
		...authSecurityOptions,
		baseURL: "http://localhost:3001",
		secret: "offline-auth-security-test-secret-at-least-32-chars",
		database: memoryAdapter({
			user: [],
			session: [],
			account: [],
			verification: [],
		}),
		emailAndPassword: { enabled: true, sendResetPassword: async () => {} },
		logger: { disabled: true },
	});
}

function request(path: string, ip: string, forwardedIp = ip) {
	return new Request(`http://localhost:3001/api/auth/${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "http://localhost:3001",
			"x-real-ip": ip,
			"x-forwarded-for": `${forwardedIp}, 172.18.0.5`,
		},
		body: JSON.stringify({
			email: "absent@example.test",
			password: "not-a-real-password",
		}),
	});
}

test("multi-hop proxy users have separate login buckets and spoofed forwarded prefixes do not reset them", async () => {
	const auth = fixture();
	for (let i = 0; i < 5; i++) {
		const response = await auth.handler(
			request("sign-in/email", "198.51.100.11", `192.0.2.${i + 1}`),
		);
		assert.equal(response.status, 401);
	}
	assert.equal(
		(
			await auth.handler(
				request("sign-in/email", "198.51.100.11", "192.0.2.99"),
			)
		).status,
		429,
	);
	assert.equal(
		(await auth.handler(request("sign-in/email", "198.51.100.22"))).status,
		401,
	);
});

test("the actual password reset endpoint uses the five-minute limit", async (t) => {
	const auth = fixture();
	const now = Date.now();
	const clock = t.mock.method(Date, "now", () => now);
	for (let i = 0; i < 3; i++) {
		assert.equal(
			(await auth.handler(request("request-password-reset", "198.51.100.33")))
				.status,
			200,
		);
	}
	clock.mock.mockImplementation(() => now + 61_000);
	assert.equal(
		(await auth.handler(request("request-password-reset", "198.51.100.33")))
			.status,
		429,
	);
	assert.equal(
		(await auth.handler(request("request-password-reset", "198.51.100.44")))
			.status,
		200,
	);
	clock.mock.mockImplementation(() => now + 301_000);
	assert.equal(
		(await auth.handler(request("request-password-reset", "198.51.100.33")))
			.status,
		200,
	);
});
