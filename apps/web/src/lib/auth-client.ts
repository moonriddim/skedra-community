import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { getAbsoluteApiBaseUrl } from "./api-url";

export const authClient = createAuthClient({
	baseURL: getAbsoluteApiBaseUrl(),
	fetchOptions: {
		credentials: "include",
	},
	plugins: [
		twoFactorClient({
			onTwoFactorRedirect: () => {
				const current = new URL(window.location.href);
				const redirect = current.searchParams.get("redirect") || "/library";
				window.location.assign(
					`/two-factor?redirect=${encodeURIComponent(redirect)}`,
				);
			},
		}),
	],
});
