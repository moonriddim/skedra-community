/** Initialen aus einem Anzeigenamen (max. zwei Buchstaben). */
export function getUserInitials(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) return "?";
	return trimmed
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}
