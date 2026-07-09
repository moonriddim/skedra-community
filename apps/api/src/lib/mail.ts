import type { Database } from "@skedra/db";
import nodemailer from "nodemailer";
import { env } from "../env";
import {
	type ResolvedMailConfig,
	getResetFallbackMode,
	resolveMailConfig,
} from "./instance-settings";

/** Kurzlebige Reset-Links wenn SMTP fehlschlägt und Fallback „link“ aktiv ist. */
const pendingResetLinks = new Map<string, { url: string; expiresAt: number }>();

function stashPasswordResetLink(email: string, url: string) {
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

	const html = `
		<p>Hallo${input.userName ? ` ${input.userName}` : ""},</p>
		<p>du hast ein neues Passwort für dein Skedra-Konto angefordert.</p>
		<p><a href="${input.url}">Passwort jetzt zurücksetzen</a></p>
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

		console.info("[skedra] Passwort-Reset (SMTP fehlgeschlagen):", input.url);
		console.warn("[skedra] SMTP-Fehler:", message);
		return { delivered: false as const, fallback: "log" as const };
	}
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

	const html = `
		<p>Hallo,</p>
		<p><strong>${input.inviterName ?? "Ein Skedra-Admin"}</strong> hat dich zu Skedra eingeladen.</p>
		${input.context ? `<p>Kontext: ${input.context}</p>` : ""}
		<p><a href="${input.url}">Skedra-Konto erstellen</a></p>
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
		console.info(
			"[skedra] Registrierungs-Einladung (SMTP fehlgeschlagen):",
			input.url,
		);
		console.warn("[skedra] SMTP-Fehler:", message);
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

	await sendAppEmail(db, {
		to: input.to,
		subject,
		text,
		html: `
			<p>Hallo ${input.recipientName},</p>
			<p><strong>${input.authorName}</strong> hat dich auf <strong>${input.boardName}</strong> erwähnt:</p>
			<blockquote style="border-left:3px solid #14b8a6;padding-left:12px;color:#334155">
				${input.commentPreview.slice(0, 400).replace(/</g, "&lt;")}
			</blockquote>
			<p><a href="${input.boardUrl}">Zum Whiteboard</a></p>
		`,
	});
}

export function buildBoardUrl(whiteboardId: string) {
	return `${env.APP_URL}/board/${whiteboardId}`;
}
