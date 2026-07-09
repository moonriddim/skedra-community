/** Kandidat für @-Erwähnungen im Kommentar-Composer. */
export interface MentionCandidate {
	id: string;
	name: string;
	image?: string | null;
	roleName?: string;
	roleColor?: string;
}

/** Handle aus Anzeigenamen (z. B. „The Snake“ → „TheSnake“). */
export function memberToMentionHandle(name: string) {
	return name.replace(/\s+/g, "");
}

/**
 * Erkennt eine laufende @-Erwähnung vor dem Cursor.
 * Gibt Startindex des „@“ und den bisher getippten Suchbegriff zurück.
 */
export function getActiveMentionAtCaret(
	text: string,
	caretIndex: number,
): { mentionStart: number; query: string } | null {
	const before = text.slice(0, caretIndex);
	const match = before.match(/(?:^|[\s\n])@([\p{L}\p{N}_]*)$/u);
	if (!match) return null;

	const query = match[1] ?? "";
	const mentionStart = caretIndex - query.length - 1;
	return { mentionStart, query };
}

/** Filtert Board-Mitglieder nach Name oder Handle-Präfix. */
export function filterMentionCandidates(
	candidates: MentionCandidate[],
	query: string,
) {
	const normalized = query.trim().toLowerCase();
	if (!normalized) return candidates;

	return candidates.filter((member) => {
		const handle = memberToMentionHandle(member.name).toLowerCase();
		const name = member.name.toLowerCase();
		const role = member.roleName?.toLowerCase() ?? "";
		return (
			handle.startsWith(normalized) ||
			name.includes(normalized) ||
			role.includes(normalized)
		);
	});
}

/** Fügt eine Erwähnung an der Cursor-Position ein. */
export function insertMentionInText(
	text: string,
	caretIndex: number,
	mentionStart: number,
	member: MentionCandidate,
) {
	const handle = memberToMentionHandle(member.name);
	const insertText = `@${handle} `;
	const nextText = `${text.slice(0, mentionStart)}${insertText}${text.slice(caretIndex)}`;
	const nextCaret = mentionStart + insertText.length;
	return { nextText, nextCaret };
}
