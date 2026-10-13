import {
	accounts,
	sessions,
	twoFactors,
	users,
	verifications,
} from "@skedra/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { env } from "../env";
import { prepareCompleteAccountDeletion } from "./account-deletion";
import { getVerificationEmailPurpose } from "./auth-email-context";
import { authSecurityOptions } from "./auth-security-options";
import { db } from "./db";
import { sendPasswordResetEmail, sendVerificationEmail } from "./mail";
import { assignFirstUserAsInstanceAdmin } from "./registration-invites";

// Operators can require email verification when SMTP is configured.
const requireEmailVerification = env.SKEDRA_REQUIRE_EMAIL_VERIFICATION;

const socialProviders = {
	...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
		? {
				google: {
					clientId: env.GOOGLE_CLIENT_ID,
					clientSecret: env.GOOGLE_CLIENT_SECRET,
					disableImplicitSignUp: true,
				},
			}
		: {}),
	...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
		? {
				github: {
					clientId: env.GITHUB_CLIENT_ID,
					clientSecret: env.GITHUB_CLIENT_SECRET,
					disableImplicitSignUp: true,
				},
			}
		: {}),
};

export const auth = betterAuth({
	...authSecurityOptions,
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user: users,
			session: sessions,
			account: accounts,
			verification: verifications,
			twoFactor: twoFactors,
		},
	}),
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					await assignFirstUserAsInstanceAdmin(db, user.id);
				},
			},
		},
	},
	secret: env.AUTH_SECRET,
	baseURL: env.API_URL,
	basePath: "/api/auth",
	trustedOrigins: [env.APP_URL],
	socialProviders,
	account: {
		encryptOAuthTokens: true,
		accountLinking: {
			enabled: true,
		},
	},
	user: {
		changeEmail: {
			enabled: true,
			// Self-hosted password accounts commonly run without SMTP and start
			// unverified. Managed/verified accounts still confirm the new address.
			updateEmailWithoutVerification: !requireEmailVerification,
		},
		deleteUser: {
			enabled: true,
			beforeDelete: prepareCompleteAccountDeletion,
		},
	},
	emailAndPassword: {
		enabled: true,
		revokeSessionsOnPasswordReset: true,
		requireEmailVerification,
		sendResetPassword: async ({ user, url }) => {
			void sendPasswordResetEmail(db, {
				email: user.email,
				url,
				userName: user.name,
			});
		},
	},
	emailVerification: {
		// Verifizierungs-Mail direkt nach der Registrierung senden.
		sendOnSignUp: requireEmailVerification,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user, url, token }, request) => {
			void sendVerificationEmail(db, {
				email: user.email,
				url,
				userName: user.name,
				purpose: getVerificationEmailPurpose(token, request?.url),
			});
		},
	},
	plugins: [
		twoFactor({
			issuer: "Skedra",
		}),
	],
});
