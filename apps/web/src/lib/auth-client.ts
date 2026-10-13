import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { getAbsoluteApiBaseUrl } from "./api-url";
import { twoFactorHandoffPath } from "./auth-redirect";

export const authClient = createAuthClient({
	baseURL: getAbsoluteApiBaseUrl(),
	fetchOptions: {
		credentials: "include",
	},
	plugins: [
		twoFactorClient({
			onTwoFactorRedirect: () => {
				window.location.assign(twoFactorHandoffPath(window.location.href));
			},
		}),
	],
});
