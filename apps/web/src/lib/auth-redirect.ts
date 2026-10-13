import { getAbsoluteApiBaseUrl } from "@/lib/api-url";

const DEFAULT_AUTH_REDIRECT = "/library";

/**
 * Where to continue after sign-in. App routes render client-side; API pages
 * such as the MCP consent screen need a full page load, because the app's
 * catch-all route would otherwise swallow them.
 */
export type AuthRedirect =
	| { kind: "app"; path: string }
	| { kind: "server"; url: string };

type AuthRedirectOrigins = { app: string; api: string };

export function currentAuthRedirectOrigins(): AuthRedirectOrigins {
	return {
		app: window.location.origin,
		api: new URL(getAbsoluteApiBaseUrl()).origin,
	};
}

/**
 * Validates an untrusted `redirect` parameter. Only http(s) targets on the app
 * or API origin pass; everything else, including paths that a browser would
 * re-read as protocol-relative URLs ("//host"), falls back to the library.
 */
export function resolveAuthRedirect(
	value: string | null | undefined,
	origins: AuthRedirectOrigins,
): AuthRedirect {
	const fallback: AuthRedirect = { kind: "app", path: DEFAULT_AUTH_REDIRECT };
	if (!value) return fallback;
	let target: URL;
	try {
		target = new URL(value, origins.app);
	} catch {
		return fallback;
	}
	if (
		(target.protocol !== "https:" && target.protocol !== "http:") ||
		(target.origin !== origins.app && target.origin !== origins.api) ||
		target.pathname.startsWith("//")
	) {
		return fallback;
	}
	const path = `${target.pathname}${target.search}${target.hash}`;
	const isApiPath =
		target.pathname === "/api" || target.pathname.startsWith("/api/");
	return target.origin === origins.app && !isApiPath
		? { kind: "app", path }
		: { kind: "server", url: `${target.origin}${path}` };
}

/** Sign-in to 2FA handoff that keeps the requested redirect and the E2EE key fragment. */
export function twoFactorHandoffPath(signInHref: string) {
	const signIn = new URL(signInHref);
	const redirect = signIn.searchParams.get("redirect") || DEFAULT_AUTH_REDIRECT;
	return `/two-factor?${new URLSearchParams({ redirect })}${signIn.hash}`;
}
