import { accounts, sessions, users, verifications } from "@skedra/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "../env";
import { db } from "./db";
import { sendPasswordResetEmail } from "./mail";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user: users,
			session: sessions,
			account: accounts,
			verification: verifications,
		},
	}),
	secret: env.AUTH_SECRET,
	baseURL: env.API_URL,
	basePath: "/api/auth",
	trustedOrigins: [env.APP_URL],
	emailAndPassword: {
		enabled: true,
		revokeSessionsOnPasswordReset: true,
		sendResetPassword: async ({ user, url }) => {
			void sendPasswordResetEmail(db, {
				email: user.email,
				url,
				userName: user.name,
			});
		},
	},
});
