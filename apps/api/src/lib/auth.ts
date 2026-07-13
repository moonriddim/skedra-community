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
import { db } from "./db";
import { sendPasswordResetEmail, sendVerificationEmail } from "./mail";

// Fix A4: Im Managed/SaaS-Modus wird die E-Mail-Verifizierung erzwungen, damit
// sich niemand mit fremden/gefälschten Adressen registriert. Im Selfhost-Modus
// bleibt sie optional (dort läuft oft kein Mailserver).
const requireEmailVerification = env.SKEDRA_DEPLOYMENT_MODE === "managed";

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
	// Fix A5: Rate-Limiting gegen Brute-Force und Reset-/Mail-Bombing. Sensible
	// Pfade sind zusätzlich strenger begrenzt. HINWEIS: Der Standard-Store ist
	// In-Memory und greift NICHT über mehrere Instanzen — im Managed-Betrieb mit
	// mehreren Nodes sollte ein geteilter Store (DB/Redis) konfiguriert werden.
	rateLimit: {
		enabled: true,
		window: 60,
		max: 100,
		customRules: {
			"/sign-in/email": { window: 60, max: 5 },
			"/sign-up/email": { window: 3600, max: 10 },
			"/forget-password": { window: 300, max: 3 },
			"/reset-password": { window: 300, max: 5 },
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
		sendVerificationEmail: async ({ user, url }) => {
			void sendVerificationEmail(db, {
				email: user.email,
				url,
				userName: user.name,
			});
		},
	},
	plugins: [
		twoFactor({
			issuer: "Skedra",
		}),
	],
});
