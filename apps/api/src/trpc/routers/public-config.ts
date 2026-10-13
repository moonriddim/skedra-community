import { env } from "../../env";
import { publicProcedure, router } from "../init";

export const publicConfigRouter = router({
	get: publicProcedure.query(() => ({
		socialProviders: {
			google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
			github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
		},
		socialSignUpEnabled: env.SKEDRA_REGISTRATION_MODE === "open",
	})),
});
