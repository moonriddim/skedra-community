import { getAbsoluteApiBaseUrl } from "@/lib/api-url";
import { createUuid } from "./uuid";

export type GrowthEventName =
	| "page_view"
	| "canvas_activated"
	| "export_used"
	| "cloud_intent"
	| "signup_started"
	| "signup_completed"
	| "checkout_started"
	| "checkout_completed"
	| "collaboration_started"
	| "share_viewed"
	| "share_link_copied"
	| "mcp_setup_viewed"
	| "mcp_key_created"
	| "template_used";

const VISITOR_KEY = "skedra-growth-visitor-v1";
const CONSENT_KEY = "skedra-growth-consent-v1";
const SESSION_KEY = "skedra-growth-session-v1";
const UTM_KEY = "skedra-growth-utm-v1";
const VISITOR_TTL_MS = 8 * 24 * 60 * 60 * 1000;
const sentOnce = new Set<string>();

export type GrowthAnalyticsConsent = "undecided" | "granted" | "denied";
let volatileConsent: GrowthAnalyticsConsent = "undecided";

export function getGrowthAnalyticsConsent(): GrowthAnalyticsConsent {
	if (typeof window === "undefined") return "denied";
	try {
		const stored = localStorage.getItem(CONSENT_KEY);
		if (stored === "granted" || stored === "denied") return stored;
	} catch {
		// Fall back to the in-memory decision when storage is unavailable.
	}
	return volatileConsent;
}

function clearGrowthIdentifiers() {
	try {
		localStorage.removeItem(VISITOR_KEY);
	} catch {
		// Storage may be blocked by the browser.
	}
	try {
		sessionStorage.removeItem(SESSION_KEY);
		sessionStorage.removeItem(UTM_KEY);
	} catch {
		// Storage may be blocked by the browser.
	}
}

export function setGrowthAnalyticsConsent(consent: "granted" | "denied") {
	const previous = getGrowthAnalyticsConsent();
	volatileConsent = consent;
	try {
		localStorage.setItem(CONSENT_KEY, consent);
	} catch {
		// The in-memory choice still applies for the current page.
	}

	if (consent === "denied") {
		clearGrowthIdentifiers();
	} else if (previous !== "granted" && typeof window !== "undefined") {
		// The first event is created only after permission is granted. Events that
		// happened while the choice was undecided are deliberately not replayed.
		sendGrowthEvent("page_view", { pathname: window.location.pathname });
	}

	if (typeof window !== "undefined") {
		window.dispatchEvent(new Event("skedra-growth-consent-changed"));
	}
}

function sessionValue(key: string, create: () => string) {
	try {
		const existing = sessionStorage.getItem(key);
		if (existing) return existing;
		const value = create();
		sessionStorage.setItem(key, value);
		return value;
	} catch {
		return create();
	}
}

function visitorValue() {
	const now = Date.now();
	try {
		const parsed = JSON.parse(localStorage.getItem(VISITOR_KEY) ?? "null") as {
			id?: unknown;
			expiresAt?: unknown;
		} | null;
		if (
			parsed &&
			typeof parsed.id === "string" &&
			typeof parsed.expiresAt === "number" &&
			parsed.expiresAt > now
		) {
			return parsed.id;
		}
		const record = {
			id: createUuid(),
			expiresAt: now + VISITOR_TTL_MS,
		};
		localStorage.setItem(VISITOR_KEY, JSON.stringify(record));
		return record.id;
	} catch {
		return createUuid();
	}
}

function sanitizePathname(pathname: string) {
	return pathname
		.replace(/\/(board)\/[^/]+/giu, "/$1/:id")
		.replace(/\/(present|collab|embed)\/[^/]+/giu, "/$1/:token")
		.slice(0, 160);
}

function readCampaign() {
	try {
		const query = new URLSearchParams(window.location.search);
		const current = {
			utmSource: query.get("utm_source")?.slice(0, 80) || undefined,
			utmMedium: query.get("utm_medium")?.slice(0, 80) || undefined,
			utmCampaign: query.get("utm_campaign")?.slice(0, 120) || undefined,
		};
		if (current.utmSource || current.utmMedium || current.utmCampaign) {
			sessionStorage.setItem(UTM_KEY, JSON.stringify(current));
			return current;
		}
		const saved = sessionStorage.getItem(UTM_KEY);
		return saved ? (JSON.parse(saved) as typeof current) : current;
	} catch {
		return {};
	}
}

function referrerHost() {
	try {
		return document.referrer ? new URL(document.referrer).hostname : undefined;
	} catch {
		return undefined;
	}
}

function sendGrowthEvent(
	event: GrowthEventName,
	options: { context?: string; pathname?: string } = {},
) {
	const visitorId = visitorValue();
	const campaign = readCampaign();
	const body = JSON.stringify({
		event,
		visitorId,
		sessionId: sessionValue(SESSION_KEY, createUuid),
		pathname: sanitizePathname(options.pathname ?? window.location.pathname),
		context: options.context?.slice(0, 64),
		referrerHost: referrerHost(),
		...campaign,
	});

	void fetch(`${getAbsoluteApiBaseUrl()}/api/analytics/events`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body,
		credentials: "include",
		keepalive: true,
	}).catch(() => {
		// Analytics must never interrupt drawing, signup or checkout.
	});
}

export function trackGrowthEvent(
	event: GrowthEventName,
	options: { context?: string; pathname?: string } = {},
) {
	if (typeof window === "undefined") return false;
	const consent = getGrowthAnalyticsConsent();
	if (consent !== "granted") return false;
	sendGrowthEvent(event, options);
	return true;
}

export function trackGrowthEventOnce(
	event: GrowthEventName,
	options: { context?: string; pathname?: string; key?: string } = {},
) {
	const key = options.key ?? `${event}:${options.context ?? ""}`;
	if (sentOnce.has(key)) return;
	if (trackGrowthEvent(event, options)) sentOnce.add(key);
}
