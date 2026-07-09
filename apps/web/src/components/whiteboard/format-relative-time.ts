/** Kurze relative Zeitangabe für Kommentare (z. B. „vor 2 Std.“). */
export function formatRelativeTime(locale: string, value: Date | string) {
	const date = value instanceof Date ? value : new Date(value);
	const diffMs = Date.now() - date.getTime();
	const diffMinutes = Math.floor(diffMs / 60_000);

	if (diffMinutes < 1) {
		return locale.startsWith("de") ? "gerade eben" : "just now";
	}
	if (diffMinutes < 60) {
		return locale.startsWith("de")
			? `vor ${diffMinutes} Min.`
			: `${diffMinutes}m ago`;
	}

	const diffHours = Math.floor(diffMinutes / 60);
	if (diffHours < 24) {
		return locale.startsWith("de")
			? `vor ${diffHours} Std.`
			: `${diffHours}h ago`;
	}

	const diffDays = Math.floor(diffHours / 24);
	if (diffDays < 7) {
		return locale.startsWith("de") ? `vor ${diffDays} T.` : `${diffDays}d ago`;
	}

	return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
}
