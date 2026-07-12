import type { Database } from "@skedra/db";
import nodemailer from "nodemailer";
import { env } from "../env";
import {
	type ResolvedMailConfig,
	getResetFallbackMode,
	resolveMailConfig,
} from "./instance-settings";

/**
 * Escaped nutzergesteuerte Werte, bevor sie in HTML-Mails interpoliert werden.
 * Verhindert HTML-/Attribut-Injection über z. B. Anzeigenamen (Fix E1).
 */
function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

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
	const subject = "Skedra – Passwort zurücksetzen";
	const text = [
		`Hallo${input.userName ? ` ${input.userName}` : ""},`,
		"",
		"du hast ein neues Passwort für dein Skedra-Konto angefordert.",
		"Öffne den folgenden Link (gültig für kurze Zeit):",
		"",
		input.url,
		"",
		"Wenn du das nicht warst, kannst du diese E-Mail ignorieren.",
	].join("\n");

	// Fix E1: nutzergesteuerte Werte (Name) und die URL werden escaped.
	const safeName = input.userName ? ` ${escapeHtml(input.userName)}` : "";
	const safeUrl = escapeHtml(input.url);
	const html = `
		<p>Hallo${safeName},</p>
		<p>du hast ein neues Passwort für dein Skedra-Konto angefordert.</p>
		<p><a href="${safeUrl}">Passwort jetzt zurücksetzen</a></p>
		<p style="color:#64748b;font-size:12px">Wenn du das nicht warst, ignoriere diese E-Mail.</p>
	`;

	try {
		await sendAppEmail(db, {
			to: input.email,
			subject,
			text,
			html,
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
	input: { email: string; url: string; userName?: string },
) {
	const subject = "Skedra – E-Mail bestätigen";
	const text = [
		`Hallo${input.userName ? ` ${input.userName}` : ""},`,
		"",
		"bitte bestätige deine E-Mail-Adresse für Skedra über den folgenden Link:",
		"",
		input.url,
		"",
		"Wenn du dich nicht bei Skedra registriert hast, ignoriere diese E-Mail.",
	].join("\n");

	// Fix E1: nutzergesteuerte Werte und URL escapen.
	const safeName = input.userName ? ` ${escapeHtml(input.userName)}` : "";
	const safeUrl = escapeHtml(input.url);
	const html = `
		<p>Hallo${safeName},</p>
		<p>bitte bestätige deine E-Mail-Adresse für Skedra:</p>
		<p><a href="${safeUrl}">E-Mail jetzt bestätigen</a></p>
		<p style="color:#64748b;font-size:12px">Wenn du dich nicht registriert hast, ignoriere diese E-Mail.</p>
	`;

	await sendAppEmail(db, { to: input.email, subject, text, html });
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
	const subject = "Skedra - Einladung";
	const text = [
		"Hallo,",
		"",
		`${input.inviterName ?? "Ein Skedra-Admin"} hat dich zu Skedra eingeladen.`,
		input.context ? `Kontext: ${input.context}` : "",
		"",
		"Registriere dich ueber diesen Link:",
		"",
		input.url,
		"",
		"Wenn du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.",
	]
		.filter(Boolean)
		.join("\n");

	// Fix E1: alle nutzergesteuerten Werte und die URL escapen.
	const safeInviter = escapeHtml(input.inviterName ?? "Ein Skedra-Admin");
	const safeContext = input.context ? escapeHtml(input.context) : "";
	const safeUrl = escapeHtml(input.url);
	const html = `
		<p>Hallo,</p>
		<p><strong>${safeInviter}</strong> hat dich zu Skedra eingeladen.</p>
		${safeContext ? `<p>Kontext: ${safeContext}</p>` : ""}
		<p><a href="${safeUrl}">Skedra-Konto erstellen</a></p>
		<p style="color:#64748b;font-size:12px">Wenn du diese Einladung nicht erwartet hast, ignoriere diese E-Mail.</p>
	`;

	try {
		await sendAppEmail(db, {
			to: input.email,
			subject,
			text,
			html,
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
	const subject = `${input.authorName} hat dich auf „${input.boardName}“ erwähnt`;
	const text = [
		`Hallo ${input.recipientName},`,
		"",
		`${input.authorName} hat dich in einem Kommentar erwähnt:`,
		`„${input.commentPreview.slice(0, 200)}“`,
		"",
		`Board öffnen: ${input.boardUrl}`,
	].join("\n");

	// Fix E1: sämtliche nutzergesteuerten Werte escapen (nicht nur den Kommentar-Auszug).
	const safeRecipient = escapeHtml(input.recipientName);
	const safeAuthor = escapeHtml(input.authorName);
	const safeBoard = escapeHtml(input.boardName);
	const safePreview = escapeHtml(input.commentPreview.slice(0, 400));
	const safeBoardUrl = escapeHtml(input.boardUrl);
	await sendAppEmail(db, {
		to: input.to,
		subject,
		text,
		html: `
			<p>Hallo ${safeRecipient},</p>
			<p><strong>${safeAuthor}</strong> hat dich auf <strong>${safeBoard}</strong> erwähnt:</p>
			<blockquote style="border-left:3px solid #14b8a6;padding-left:12px;color:#334155">
				${safePreview}
			</blockquote>
			<p><a href="${safeBoardUrl}">Zum Whiteboard</a></p>
		`,
	});
}

export function buildBoardUrl(whiteboardId: string) {
	return `${env.APP_URL}/board/${whiteboardId}`;
}
