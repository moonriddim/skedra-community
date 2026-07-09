/**
 * Einfache DE/EN-Texte nur für den Katalog (keine Abhängigkeit zur Haupt-App).
 */

export type CatalogLocale = "de" | "en";

const messages = {
	de: {
		title: "Skedra Bibliotheken",
		subtitle: "Öffentliche Shape-Pakete für dein Whiteboard",
		intro:
			"Verzeichnis aller auf Skedra veröffentlichten Bibliotheken. „In Skedra öffnen“ installiert das Paket direkt im Canvas.",
		searchPlaceholder: "Bibliotheken durchsuchen …",
		sortLabel: "Sortierung",
		sortDefault: "Standard",
		sortName: "Name",
		sortUpdated: "Zuletzt aktualisiert",
		created: "Erstellt",
		updated: "Aktualisiert",
		itemCount: (count: number) => `${count} Symbole`,
		addToSkedra: "In Skedra öffnen",
		download: "Herunterladen",
		share: "Link kopieren",
		copied: "Kopiert",
		openSkedra: "Skedra öffnen",
		publishCta: "Bibliothek einreichen",
		empty:
			"Noch keine freigegebenen Bibliotheken. Reiche die erste zur Review ein!",
		noResults: "Keine Treffer für deine Suche.",
		loadError: "Katalog konnte nicht geladen werden.",
		footer: "Pakete von der Community · Format .skedralib",
		langToggle: "EN",
	},
	en: {
		title: "Skedra Libraries",
		subtitle: "Public shape packages for your whiteboard",
		intro:
			"Directory of libraries published on Skedra. “Open in Skedra” installs the package in your canvas.",
		searchPlaceholder: "Search libraries …",
		sortLabel: "Sort by",
		sortDefault: "Default",
		sortName: "Name",
		sortUpdated: "Recently updated",
		created: "Created",
		updated: "Updated",
		itemCount: (count: number) => `${count} shapes`,
		addToSkedra: "Open in Skedra",
		download: "Download",
		share: "Copy link",
		copied: "Copied",
		openSkedra: "Open Skedra",
		publishCta: "Submit a library",
		empty: "No approved libraries yet. Submit the first one for review!",
		noResults: "No matches for your search.",
		loadError: "Could not load the catalog.",
		footer: "Community packages · .skedralib format",
		langToggle: "DE",
	},
} as const;

export function detectLocale(): CatalogLocale {
	if (typeof navigator !== "undefined" && navigator.language.startsWith("de")) {
		return "de";
	}
	return "en";
}

export function getMessages(locale: CatalogLocale) {
	return messages[locale];
}
