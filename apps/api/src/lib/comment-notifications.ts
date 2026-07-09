import type { Database } from "@skedra/db";
import { userPreferences, users } from "@skedra/db";
import { eq, inArray } from "drizzle-orm";
import { buildBoardUrl, sendMentionNotificationEmail } from "./mail";
import { getBoardCollaborators } from "./permissions";

/** Handle aus Anzeigenamen (wie im Frontend). */
function mentionHandle(name: string) {
	return name.replace(/\s+/g, "");
}

/** Parst @Handles aus Kommentartext. */
function parseMentionHandles(body: string) {
	const matches = body.match(/@([\p{L}\p{N}_]+)/gu) ?? [];
	return [...new Set(matches.map((token) => token.slice(1).toLowerCase()))];
}

/**
 * Sendet E-Mail-Benachrichtigungen an erwähnte Board-Mitglieder (fire-and-forget).
 */
export async function notifyMentionedUsers(
	db: Database,
	input: {
		whiteboardId: string;
		boardName: string;
		authorId: string;
		authorName: string;
		body: string;
	},
) {
	const handles = parseMentionHandles(input.body);
	if (handles.length === 0) return;

	const { members } = await getBoardCollaborators(db, input.whiteboardId);
	const boardUrl = buildBoardUrl(input.whiteboardId);

	const mentionedUserIds = members
		.filter((member) => member.id !== input.authorId)
		.filter((member) =>
			handles.includes(mentionHandle(member.name).toLowerCase()),
		)
		.map((member) => member.id);

	if (mentionedUserIds.length === 0) return;

	const prefs = await db.query.userPreferences.findMany({
		where: inArray(userPreferences.userId, mentionedUserIds),
	});

	const prefsByUser = new Map(prefs.map((entry) => [entry.userId, entry]));

	const recipients = await db.query.users.findMany({
		where: inArray(users.id, mentionedUserIds),
		columns: { id: true, email: true, name: true },
	});

	for (const recipient of recipients) {
		const pref = prefsByUser.get(recipient.id);
		if (pref && !pref.emailOnMention) continue;

		try {
			await sendMentionNotificationEmail(db, {
				to: recipient.email,
				recipientName: recipient.name,
				authorName: input.authorName,
				boardName: input.boardName,
				commentPreview: input.body,
				boardUrl,
			});
		} catch (error) {
			console.warn(
				"[skedra] Erwähnungs-Mail fehlgeschlagen:",
				recipient.email,
				error,
			);
		}
	}
}
