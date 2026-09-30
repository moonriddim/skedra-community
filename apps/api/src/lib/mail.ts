import type { Database } from "@skedra/db";
import nodemailer from "nodemailer";
import { env } from "../env";
import {
	type ResolvedMailConfig,
	getResetFallbackMode,
	resolveMailConfig,
} from "./instance-settings";
import {
	buildMentionNotificationEmail,
	buildPasswordResetEmail,
	buildRegistrationInviteEmail,
	buildVerificationEmail,
} from "./mail-templates";

/** Kurzlebige Reset-Links wenn SMTP fehlschlägt und Fallback „link“ aktiv ist. */
const pendingResetLinks = new Map<string, { url: string; expiresAt: number }>();

/** Entfernt abgelaufene Einträge (Fix A7 — sonst wächst die Map unbegrenzt). */
function sweepExpiredResetLinks() {
	const now = Date.now();
	for (const [key, entry] of pendingResetLinks) {
		if (entry.expiresAt < now) pendingResetLinks.delete(key);
	}
}

function stashPasswordResetLink(email: string, url: string) {
	sweepExpiredResetLinks();
	pendingResetLinks.set(email.toLowerCase().trim(), {
		url,
		expiresAt: Date.now() + 15 * 60 * 1000,
	});
}

export function consumePasswordResetLink(email: string) {
	const key = email.toLowerCase().trim();
	const entry = pendingResetLinks.get(key);
	if (!entry) return null;
	pendingResetLinks.delete(key);
	if (entry.expiresAt < Date.now()) return null;
	return entry.url;
}

export async function getMailDeliveryStatus(db: Database) {
	const config = await resolveMailConfig(db);
	return {
		configured: !!config,
		source: config?.source ?? ("none" as const),
		from: config?.from ?? null,
		host: config?.host ?? null,
	};
}

async function sendWithConfig(
	config: ResolvedMailConfig,
	input: { to: string; subject: string; text: string; html?: string },
) {
	const transport = nodemailer.createTransport({
		host: config.host,
		port: config.port,
		secure: config.secure,
		// Fix E3: Bei nicht-implizitem TLS (Port 587) STARTTLS erzwingen, damit
		// Zugangsdaten niemals im Klartext übertragen werden.
		requireTLS: !config.secure,
		auth: config.user
			? {
					user: config.user,
					pass: config.password,
				}
			: undefined,
	});

	await transport.sendMail({
		from: config.from,
		to: input.to,
		subject: input.subject,
		text: input.text,
		html: input.html ?? input.text.replace(/\n/g, "<br>"),
	});
}

export async function sendAppEmail(
	db: Database,
	input: { to: string; subject: string; text: string; html?: string },
) {
	const config = await resolveMailConfig(db);
	if (!config) {
		throw new Error("SMTP ist nicht konfiguriert");
	}

	await sendWithConfig(config, input);
}

export async function sendPasswordResetEmail(
	db: Database,
	input: { email: string; url: string; userName?: string },
) {
	const content = buildPasswordResetEmail({ ...input, appUrl: env.APP_URL });

	try {
		await sendAppEmail(db, {
			to: input.email,
			...content,
		});
		return { delivered: true as const };
	} catch (error) {
		const fallback = await getResetFallbackMode(db);
		const message =
			error instanceof Error ? error.message : "Mailversand fehlgeschlagen";

		if (fallback === "link") {
			stashPasswordResetLink(input.email, input.url);
			return { delivered: false as const, fallback: "link" as const };
		}

		// Fix E2: Den vollständigen Reset-Link (inkl. Token) NICHT ins Log schreiben —
		// wer Log-Zugriff hat, könnte sonst Konten übernehmen. Nur ein Ereignis loggen.
		console.warn(
			"[skedra] Passwort-Reset konnte nicht per SMTP zugestellt werden:",
			message,
		);
		return { delivered: false as const, fallback: "log" as const };
	}
}

/**
 * Fix A4: Bestätigungs-Mail für die E-Mail-Verifizierung.
 * Wird von better-auth aufgerufen, wenn `requireEmailVerification` aktiv ist.
 */
export async function sendVerificationEmail(
	db: Database,
	input: {
		email: string;
		url: string;
		userName?: string;
		purpose?: "registration" | "email-change";
	},
) {
	const content = buildVerificationEmail({ ...input, appUrl: env.APP_URL });
	await sendAppEmail(db, { to: input.email, ...content });
	return { delivered: true as const };
}

export async function sendRegistrationInviteEmail(
	db: Database,
	input: {
		email: string;
		url: string;
		inviterName?: string;
		context?: string;
	},
) {
	const content = buildRegistrationInviteEmail({
		...input,
		appUrl: env.APP_URL,
	});

	try {
		await sendAppEmail(db, {
			to: input.email,
			...content,
		});
		return { delivered: true as const };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Mailversand fehlgeschlagen";
		// Fix E2: Einladungs-Link (enthält Token) nicht ins Log schreiben.
		console.warn(
			"[skedra] Registrierungs-Einladung konnte nicht zugestellt werden:",
			message,
		);
		return { delivered: false as const, fallback: "link" as const };
	}
}

export async function sendMentionNotificationEmail(
	db: Database,
	input: {
		to: string;
		recipientName: string;
		authorName: string;
		boardName: string;
		commentPreview: string;
		boardUrl: string;
	},
) {
	const content = buildMentionNotificationEmail({
		...input,
		appUrl: env.APP_URL,
	});
	await sendAppEmail(db, {
		to: input.to,
		...content,
	});
}

export function buildBoardUrl(whiteboardId: string) {
	return `${env.APP_URL}/board/${whiteboardId}`;
}
