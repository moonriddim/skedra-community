/** Escape every dynamic value before it is inserted into email HTML. */
function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

interface EmailContent {
	appUrl: string;
	preview: string;
	eyebrow: string;
	title: string;
	greeting: string;
	bodyHtml: string;
	actionLabel?: string;
	actionUrl?: string;
	notice: string;
}

/** Table layout and inline styles also work when an email client strips CSS. */
function renderEmail(content: EmailContent) {
	const safeUrl = escapeHtml(content.actionUrl ?? "");
	const hasAction = !!(content.actionUrl && content.actionLabel);
	const logoUrl = escapeHtml(
		`${content.appUrl.replace(/\/$/, "")}/logo-mark-transparent.png`,
	);
	return `<!DOCTYPE html>
<html lang="de" dir="ltr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(content.title)}</title>
  <style>
    body { margin: 0; padding: 0; }
    table { border-collapse: collapse; }
    a { color: #126b5f; }
    @media only screen and (max-width: 600px) {
      .email-shell { padding: 20px 12px !important; }
      .email-content { padding: 28px 24px !important; }
      .email-heading { font-size: 28px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f8f7f2;color:#193c39;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div lang="de" dir="ltr" style="display:none;font-size:1px;line-height:1px;color:#f8f7f2;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(content.preview)}</div>
  <table lang="de" dir="ltr" role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f8f7f2" style="width:100%;background-color:#f8f7f2;">
    <tr><td class="email-shell" align="center" style="padding:40px 20px;">
      <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">
        <tr><td style="padding:0 8px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td width="44" style="width:44px;padding-right:12px;"><img src="${logoUrl}" width="44" height="44" alt="" style="display:block;border:0;width:44px;height:44px;"></td>
              <td style="color:#193c39;font-size:26px;font-weight:700;letter-spacing:-1px;">Skedra</td>
            </tr>
          </table>
        </td></tr>
        <tr><td bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #d8dfd7;border-top:4px solid #126b5f;border-radius:12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">
            <tr><td class="email-content" style="padding:36px 40px;">
              <p style="margin:0 0 14px;color:#126b5f;font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">${escapeHtml(content.eyebrow)}</p>
              <h1 class="email-heading" style="margin:0 0 28px;color:#193c39;font-size:32px;font-weight:700;line-height:1.2;letter-spacing:-0.8px;">${escapeHtml(content.title)}</h1>
              <p style="margin:0 0 16px;color:#193c39;font-size:16px;line-height:1.65;">${escapeHtml(content.greeting)}</p>
              ${content.bodyHtml}
              ${
								hasAction
									? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr><td align="center" bgcolor="#126b5f" style="background-color:#126b5f;border-radius:8px;">
                  <a href="${safeUrl}" style="display:inline-block;border:1px solid #126b5f;border-radius:8px;padding:15px 24px;color:#ffffff;font-size:15px;font-weight:700;line-height:20px;text-align:center;text-decoration:none;mso-padding-alt:0;">
                    <!--[if mso]><i style="mso-font-width:150%;mso-text-raise:22pt;" hidden>&emsp;</i><span style="mso-text-raise:11pt;"><![endif]-->${escapeHtml(content.actionLabel ?? "")}<!--[if mso]></span><i style="mso-font-width:150%;" hidden>&emsp;&#8203;</i><![endif]-->
                  </a>
                </td></tr>
              </table>`
									: ""
							}
              <p style="margin:0 0 24px;color:#576b66;font-size:14px;line-height:1.6;">Viele Grüße<br><strong style="color:#193c39;">Dein Skedra-Team</strong></p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e8ece5;">
                <tr><td style="padding-top:22px;">
                  <p style="margin:0 0 12px;color:#576b66;font-size:12px;line-height:1.7;">${escapeHtml(content.notice)}</p>
                  ${
										hasAction
											? `<p style="margin:0 0 6px;color:#576b66;font-size:12px;line-height:1.7;">Der Button funktioniert nicht? Kopiere diesen Link in deinen Browser:</p>
                  <p style="margin:0;font-size:12px;line-height:1.7;word-break:break-all;overflow-wrap:anywhere;"><a href="${safeUrl}" style="color:#126b5f;text-decoration:underline;word-break:break-all;">${safeUrl}</a></p>`
											: ""
									}
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:22px 16px 0;color:#576b66;font-size:11px;line-height:1.7;">
          Skedra · Raum für gemeinsame Ideen.<br>Diese E-Mail wurde automatisch versendet.
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}

function paragraph(text: string) {
	return `<p style="margin:0 0 16px;color:#576b66;font-size:16px;line-height:1.65;">${escapeHtml(text)}</p>`;
}

interface AccountEmailInput {
	appUrl: string;
	url: string;
	userName?: string;
}

function greeting(userName?: string) {
	return `Hallo${userName ? ` ${userName}` : ""},`;
}

export function buildVerificationEmail(
	input: AccountEmailInput & { purpose?: "registration" | "email-change" },
) {
	const isEmailChange = input.purpose === "email-change";
	const intro = isEmailChange
		? "Du hast eine neue E-Mail-Adresse für dein Skedra-Konto angegeben. Bestätige diese Adresse über den Button, um sie zu verifizieren."
		: "Willkommen bei Skedra! Bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren und mit deinen Ideen loszulegen.";
	const notice = isEmailChange
		? "Wenn du diese Änderung nicht angefordert hast, melde dich bei Skedra an und prüfe deine Kontoeinstellungen."
		: "Wenn du dich nicht bei Skedra registriert hast, kannst du diese E-Mail ignorieren.";
	const actionLabel = isEmailChange
		? "Neue E-Mail-Adresse bestätigen"
		: "E-Mail-Adresse bestätigen";
	return {
		subject: isEmailChange
			? "Skedra – Neue E-Mail-Adresse bestätigen"
			: "Skedra – E-Mail bestätigen",
		text: [
			greeting(input.userName),
			"",
			intro,
			"",
			`${actionLabel}: ${input.url}`,
			"",
			notice,
			"",
			"Viele Grüße",
			"Dein Skedra-Team",
		].join("\n"),
		html: renderEmail({
			appUrl: input.appUrl,
			preview: isEmailChange
				? "Bestätige die neue E-Mail-Adresse für dein Skedra-Konto."
				: "Nur noch ein Schritt: Bestätige deine E-Mail-Adresse für Skedra.",
			eyebrow: isEmailChange ? "Dein Skedra-Konto" : "Willkommen bei Skedra",
			title: isEmailChange
				? "Bestätige deine neue E-Mail-Adresse."
				: "Bestätige deine E-Mail-Adresse.",
			greeting: greeting(input.userName),
			bodyHtml: paragraph(intro),
			actionLabel,
			actionUrl: input.url,
			notice,
		}),
	};
}

export function buildSmtpTestEmail(input: {
	appUrl: string;
	email: string;
	userName?: string;
}) {
	const intro =
		"Diese Test-E-Mail bestätigt, dass der E-Mail-Versand deiner Skedra-Instanz korrekt konfiguriert ist.";
	const recipient = `Gesendet an: ${input.email}`;
	const notice =
		"Du erhältst diese Nachricht, weil du in den Systemeinstellungen einen Testversand angefordert hast. Es ist keine weitere Aktion nötig.";
	return {
		subject: "Skedra – SMTP-Test erfolgreich",
		text: [
			greeting(input.userName),
			"",
			intro,
			"",
			recipient,
			"",
			notice,
			"",
			"Viele Grüße",
			"Dein Skedra-Team",
		].join("\n"),
		html: renderEmail({
			appUrl: input.appUrl,
			preview: "Der E-Mail-Versand deiner Skedra-Instanz funktioniert.",
			eyebrow: "Deine Skedra-Instanz",
			title: "Der Testversand war erfolgreich.",
			greeting: greeting(input.userName),
			bodyHtml: paragraph(intro) + paragraph(recipient),
			notice,
		}),
	};
}

export function buildPasswordResetEmail(input: AccountEmailInput) {
	const intro =
		"Du hast ein neues Passwort für dein Skedra-Konto angefordert. Über den Button kannst du ein neues Passwort festlegen.";
	const expiry =
		"Der Link ist nur für kurze Zeit gültig. Falls er bereits abgelaufen ist, fordere bitte einen neuen an.";
	const notice =
		"Wenn du kein neues Passwort angefordert hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.";
	return {
		subject: "Skedra – Passwort zurücksetzen",
		text: [
			greeting(input.userName),
			"",
			intro,
			"",
			expiry,
			"",
			`Passwort zurücksetzen: ${input.url}`,
			"",
			notice,
			"",
			"Viele Grüße",
			"Dein Skedra-Team",
		].join("\n"),
		html: renderEmail({
			appUrl: input.appUrl,
			preview: "Lege ein neues Passwort für dein Skedra-Konto fest.",
			eyebrow: "Dein Skedra-Konto",
			title: "Passwort zurücksetzen.",
			greeting: greeting(input.userName),
			bodyHtml: paragraph(intro) + paragraph(expiry),
			actionLabel: "Passwort zurücksetzen",
			actionUrl: input.url,
			notice,
		}),
	};
}

export function buildRegistrationInviteEmail(input: {
	appUrl: string;
	url: string;
	inviterName?: string;
	context?: string;
}) {
	const intro = `${input.inviterName ?? "Ein Skedra-Admin"} hat dich zu Skedra eingeladen. Erstelle dein Konto und bringe deine Ideen auf ein gemeinsames Whiteboard.`;
	const notice =
		"Wenn du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.";
	return {
		subject: "Skedra – Du bist eingeladen",
		text: [
			"Hallo,",
			"",
			intro,
			...(input.context ? ["", `Zur Einladung: ${input.context}`] : []),
			"",
			`Skedra-Konto erstellen: ${input.url}`,
			"",
			notice,
			"",
			"Viele Grüße",
			"Dein Skedra-Team",
		].join("\n"),
		html: renderEmail({
			appUrl: input.appUrl,
			preview: `${input.inviterName ?? "Ein Skedra-Admin"} lädt dich zu Skedra ein.`,
			eyebrow: "Zusammen mehr bewegen",
			title: "Du bist eingeladen.",
			greeting: "Hallo,",
			bodyHtml:
				paragraph(intro) +
				(input.context ? paragraph(`Zur Einladung: ${input.context}`) : ""),
			actionLabel: "Skedra-Konto erstellen",
			actionUrl: input.url,
			notice,
		}),
	};
}

export function buildMentionNotificationEmail(input: {
	appUrl: string;
	recipientName: string;
	authorName: string;
	boardName: string;
	commentPreview: string;
	boardUrl: string;
}) {
	const intro = `${input.authorName} hat dich auf dem Whiteboard „${input.boardName}“ in einem Kommentar erwähnt.`;
	const preview = input.commentPreview.slice(0, 400);
	return {
		subject: `${input.authorName} hat dich auf „${input.boardName}“ erwähnt`,
		text: [
			greeting(input.recipientName),
			"",
			intro,
			"",
			`„${preview}“`,
			"",
			`Whiteboard öffnen: ${input.boardUrl}`,
			"",
			"Viele Grüße",
			"Dein Skedra-Team",
		].join("\n"),
		html: renderEmail({
			appUrl: input.appUrl,
			preview: `${input.authorName} hat dich auf „${input.boardName}“ erwähnt.`,
			eyebrow: "Auf deinem Whiteboard",
			title: "Du wurdest erwähnt.",
			greeting: greeting(input.recipientName),
			bodyHtml: `${paragraph(intro)}<blockquote style="margin:20px 0 0;padding:18px 20px;border-left:3px solid #126b5f;background-color:#f1f5ef;color:#193c39;font-size:15px;line-height:1.7;white-space:pre-wrap;word-break:break-word;">${escapeHtml(preview)}</blockquote>`,
			actionLabel: "Whiteboard öffnen",
			actionUrl: input.boardUrl,
			notice:
				"Du erhältst diese Nachricht, weil du in einem Kommentar auf Skedra erwähnt wurdest.",
		}),
	};
}
