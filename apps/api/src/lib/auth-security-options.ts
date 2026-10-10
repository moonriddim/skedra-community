import type { BetterAuthOptions } from "better-auth";

export const authSecurityOptions = {
	advanced: {
		// The supplied nginx configurations overwrite this header. The API must
		// remain private behind that proxy; never trust a public caller's header.
		ipAddress: { ipAddressHeaders: ["x-real-ip"] },
	},
	rateLimit: {
		enabled: true,
		window: 60,
		max: 100,
		// Memory storage is per process. Multi-instance deployments need a
		// shared atomic rate-limit store as well.
		customRules: {
			"/sign-in/email": { window: 60, max: 5 },
			"/sign-up/email": { window: 3600, max: 10 },
			"/request-password-reset": { window: 300, max: 3 },
			"/forget-password": { window: 300, max: 3 },
			"/reset-password": { window: 300, max: 5 },
		},
	},
} satisfies Pick<BetterAuthOptions, "advanced" | "rateLimit">;
