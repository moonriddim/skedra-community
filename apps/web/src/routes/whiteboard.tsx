import { PublicSiteLayout } from "@/components/public/public-site-layout";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { localizePublicPath } from "@/lib/public-path";
import {
	ArrowDown,
	ArrowRight,
	Check,
	Cloud,
	Download,
	FileDown,
	GitBranch,
	LayoutTemplate,
	LockKeyhole,
	Users,
	Workflow,
} from "lucide-react";
import { Link } from "react-router";

const copy = {
	de: {
		badge: "Kostenlos und ohne Konto nutzbar",
		title: "Das freie Online-Whiteboard für Ideen, Diagramme und Teams",
		intro:
			"Skedra ist ein browserbasiertes Infinite Canvas für Skizzen, Mindmaps, Flussdiagramme, Kanban-Boards und Workshops. Das kostenlose Whiteboard funktioniert ohne Registrierung und speichert lokal auf deinem Gerät. Skedra Cloud ergänzt verschlüsselte Speicherung, Live-Zusammenarbeit, Teams, Kommentare und Präsentationen.",
		draw: "Whiteboard öffnen",
		prices: "Preise vergleichen",
		updated: "Zuletzt aktualisiert: 13. Juli 2026",
		featuresTitle: "Was kann Skedra?",
		featuresIntro:
			"Der Editor bleibt kostenlos. Cloud-Funktionen kommen nur dann hinzu, wenn du Boards dauerhaft synchronisieren oder mit anderen zusammenarbeiten möchtest.",
		features: [
			[
				"Infinite Canvas",
				"Zeichnen, schreiben und strukturieren auf einer frei navigierbaren Arbeitsfläche.",
			],
			[
				"Diagramme und Vorlagen",
				"Flowcharts, Mindmaps, Kanban-Boards, Sticky Notes und wiederverwendbare Vorlagen.",
			],
			[
				"Lokale Nutzung",
				"Ohne Konto starten; deine freien Zeichnungen bleiben zunächst im Browser gespeichert.",
			],
			[
				"Dateiexport",
				"Boards als PNG, SVG, PDF, PPTX oder portable Skedra-Datei exportieren.",
			],
			[
				"Live-Zusammenarbeit",
				"Cloud-Boards gemeinsam bearbeiten, kommentieren, präsentieren und kontrolliert freigeben.",
			],
			[
				"Verschlüsselung",
				"Zwischen Ende-zu-Ende-Verschlüsselung und serververwalteter AES-256-GCM-Verschlüsselung wählen.",
			],
		],
		privacyTitle: "Lokal beginnen, verschlüsselt zusammenarbeiten",
		privacyText:
			"Im Gastmodus wird der Canvas-Zustand lokal im Browser gespeichert. Für Cloud-Boards bietet Skedra einen Ende-zu-Ende-verschlüsselten Modus, bei dem Canvas-Inhalte und Live-Presence-Daten im Browser verschlüsselt werden, sowie einen serververwalteten Modus für kompatible Team-Workflows.",
		useCasesTitle: "Wofür eignet sich Skedra?",
		useCases: [
			[
				"Brainstorming",
				"Ideen frei sammeln, gruppieren und visuell priorisieren.",
			],
			[
				"Prozessdiagramme",
				"Abläufe und Entscheidungen als übersichtliche Flowcharts dokumentieren.",
			],
			[
				"Workshops",
				"Gemeinsam auf einem Board arbeiten, kommentieren und Ergebnisse präsentieren.",
			],
			[
				"Projektplanung",
				"Aufgaben in Kanban-Listen organisieren und Zusammenhänge sichtbar machen.",
			],
		],
		comparisonTitle: "Skedra Free oder Skedra Cloud?",
		comparisonIntro:
			"Free ist für lokale Einzelarbeit gedacht. Cloud ergänzt dauerhafte Synchronisierung und Zusammenarbeit.",
		feature: "Funktion",
		free: "Free",
		cloud: "Cloud",
		rows: [
			["Preis", "CHF 0", "CHF 4.90 monatlich oder CHF 49 jährlich pro Person"],
			["Konto erforderlich", "Nein", "Ja"],
			["Speicherung", "Lokal im Browser", "Verschlüsselte Cloud-Boards"],
			[
				"Zusammenarbeit",
				"Dateiexport",
				"Live, Kommentare, Teams und Freigaben",
			],
		],
		ctaTitle: "Direkt im Browser loslegen",
		ctaText:
			"Für das kostenlose Whiteboard brauchst du weder Download noch Registrierung.",
		machineReadable: "Produktdaten als Markdown",
	},
	en: {
		badge: "Free to use without an account",
		title: "The open online whiteboard for ideas, diagrams and teams",
		intro:
			"Skedra is a browser-based infinite canvas for sketches, mind maps, flowcharts, Kanban boards and workshops. The free whiteboard works without registration and stores locally on your device. Skedra Cloud adds encrypted storage, live collaboration, teams, comments and presentations.",
		draw: "Open the whiteboard",
		prices: "Compare pricing",
		updated: "Last updated: July 13, 2026",
		featuresTitle: "What can Skedra do?",
		featuresIntro:
			"The editor stays free. Cloud features are added only when you want to sync boards permanently or collaborate with others.",
		features: [
			[
				"Infinite canvas",
				"Draw, write and organize on a freely navigable workspace.",
			],
			[
				"Diagrams and templates",
				"Flowcharts, mind maps, Kanban boards, sticky notes and reusable templates.",
			],
			[
				"Local use",
				"Start without an account; free drawings initially remain in your browser.",
			],
			[
				"File export",
				"Export boards as PNG, SVG, PDF, PPTX or a portable Skedra file.",
			],
			[
				"Live collaboration",
				"Edit, comment on, present and securely share cloud boards together.",
			],
			[
				"Encryption",
				"Choose between end-to-end encryption and server-managed AES-256-GCM encryption.",
			],
		],
		privacyTitle: "Start locally, collaborate with encryption",
		privacyText:
			"In guest mode, canvas state is stored locally in the browser. For cloud boards, Skedra offers an end-to-end encrypted mode where canvas content and live presence data are encrypted in the browser, plus a server-managed mode for compatible team workflows.",
		useCasesTitle: "What is Skedra for?",
		useCases: [
			["Brainstorming", "Collect, group and visually prioritize ideas."],
			[
				"Process diagrams",
				"Document workflows and decisions as clear flowcharts.",
			],
			[
				"Workshops",
				"Work together on a board, comment and present the results.",
			],
			[
				"Project planning",
				"Organize tasks in Kanban lists and make relationships visible.",
			],
		],
		comparisonTitle: "Skedra Free or Skedra Cloud?",
		comparisonIntro:
			"Free is designed for local individual work. Cloud adds permanent sync and collaboration.",
		feature: "Feature",
		free: "Free",
		cloud: "Cloud",
		rows: [
			["Price", "CHF 0", "CHF 4.90 monthly or CHF 49 yearly per person"],
			["Account required", "No", "Yes"],
			["Storage", "Local browser storage", "Encrypted cloud boards"],
			[
				"Collaboration",
				"File export",
				"Live editing, comments, teams and sharing",
			],
		],
		ctaTitle: "Start directly in your browser",
		ctaText:
			"The free whiteboard requires neither a download nor registration.",
		machineReadable: "Product data as Markdown",
	},
} as const;

const icons = [GitBranch, LayoutTemplate, Cloud, FileDown, Users, LockKeyhole];

export function WhiteboardPage() {
	const { locale } = useI18n();
	const c = copy[locale];
	const publicPath = (path: string) => localizePublicPath(path, locale);

	return (
		<PublicSiteLayout>
			<article>
				<header className="studio-hero">
					<div className="studio-container">
						<p className="studio-eyebrow">
							<span />{" "}
							{locale === "de"
								? "DEIN RAUM FÜR DEN NÄCHSTEN GEDANKEN"
								: "A SPACE FOR YOUR NEXT BIG THOUGHT"}
						</p>
						<div className="studio-hero-copy">
							<h1>
								{locale === "de" ? "Kopf voll?" : "Mind full?"}
								<br />
								<span>{locale === "de" ? "Board auf." : "Board open."}</span>
							</h1>
							<div className="studio-hero-intro">
								<p>
									{locale === "de"
										? "Aus losen Gedanken wird ein klares Bild. Skizziere Ideen, verbinde Zusammenhänge und bring dein nächstes Projekt ins Rollen."
										: "Turn scattered thoughts into a clear picture. Sketch ideas, connect the dots and get your next project moving."}
								</p>
								<div className="studio-actions">
									<Button asChild size="lg">
										<Link to={publicPath("/")}>
											{c.draw}
											<ArrowRight className="h-4 w-4" />
										</Link>
									</Button>
									<a className="studio-text-link" href="#inside-skedra">
										{locale === "de" ? "Skedra entdecken" : "Explore Skedra"}
										<ArrowDown className="h-4 w-4" />
									</a>
								</div>
								<p className="studio-fine-print">
									<Check className="h-3.5 w-3.5" />
									{c.badge}
								</p>
							</div>
						</div>
						<figure className="studio-board" id="inside-skedra">
							<figcaption className="studio-board-caption">
								<span>
									<span className="studio-status-dot" />
									{locale === "de"
										? "Von der ersten Idee zum nächsten Schritt"
										: "From first thought to next step"}
								</span>
								<span className="studio-board-tag">MADE IN SKEDRA</span>
							</figcaption>
							<img
								src="/images/skedra-idea-board.png"
								alt={
									locale === "de"
										? "Echter Skedra-Editor mit einem ausgearbeiteten Projektboard: Ideen, verbundene Prozessschritte und Aufgaben"
										: "Actual Skedra editor with a project board: ideas, connected workflow steps and tasks"
								}
								width="1440"
								height="900"
								fetchPriority="high"
							/>
							<div className="studio-board-bottom">
								<span>
									{locale === "de"
										? "Ein echtes Board. Alles weiterdenkbar."
										: "A real board. Ready for your next idea."}
								</span>
								<a href="/examples/idea-to-launch.skedra" download>
									<Download className="h-4 w-4" />
									{locale === "de"
										? "Beispiel herunterladen"
										: "Download example"}
								</a>
							</div>
						</figure>
						<div className="studio-principles">
							<span>
								{locale === "de"
									? "WENIGER HÜRDEN. MEHR IDEEN."
									: "LESS FRICTION. MORE IDEAS."}
							</span>
							<span>
								<Check />
								{locale === "de"
									? "Ohne Konto starten"
									: "Start without an account"}
							</span>
							<span>
								<Check />
								{locale === "de" ? "Lokal zeichnen" : "Draw locally"}
							</span>
							<span>
								<Check />
								{locale === "de"
									? "Cloud, wenn du sie brauchst"
									: "Cloud when you need it"}
							</span>
						</div>
					</div>
				</header>

				<section className="studio-features border-y border-border bg-card/45 px-4 py-20 sm:px-6">
					<div className="mx-auto max-w-6xl">
						<h2 className="font-display text-3xl font-bold sm:text-4xl">
							{locale === "de"
								? "Gedanken brauchen Platz. Kein Korsett."
								: "Room for ideas. Space to make them yours."}
						</h2>
						<p className="mt-3 max-w-3xl text-lg leading-8 text-muted-foreground">
							{c.featuresIntro}
						</p>
						<div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
							{c.features.map(([title, text], index) => {
								const Icon = icons[index] ?? LayoutTemplate;
								return (
									<section key={title} className="studio-feature">
										<div className="studio-feature-top">
											<Icon
												className="h-6 w-6 text-primary"
												aria-hidden="true"
											/>
											<span>0{index + 1}</span>
										</div>
										<h3 className="mt-4 text-xl font-semibold">{title}</h3>
										<p className="mt-2 text-sm leading-6 text-muted-foreground">
											{text}
										</p>
									</section>
								);
							})}
						</div>
					</div>
				</section>

				<section className="px-4 py-20 sm:px-6">
					<div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-start">
						<div className="rounded-3xl border border-primary/25 bg-primary/6 p-7 sm:p-9">
							<LockKeyhole
								className="h-8 w-8 text-primary"
								aria-hidden="true"
							/>
							<h2 className="mt-5 font-display text-3xl font-bold">
								{c.privacyTitle}
							</h2>
							<p className="mt-4 leading-7 text-muted-foreground">
								{c.privacyText}
							</p>
						</div>
						<div>
							<h2 className="font-display text-3xl font-bold">
								{c.useCasesTitle}
							</h2>
							<div className="mt-6 grid gap-4 sm:grid-cols-2">
								{c.useCases.map(([title, text]) => (
									<section
										key={title}
										className="rounded-2xl border border-border p-5"
									>
										<h3 className="font-semibold">{title}</h3>
										<p className="mt-2 text-sm leading-6 text-muted-foreground">
											{text}
										</p>
									</section>
								))}
							</div>
						</div>
					</div>
				</section>

				<section className="border-y border-border bg-card/45 px-4 py-20 sm:px-6">
					<div className="mx-auto max-w-5xl">
						<h2 className="font-display text-3xl font-bold sm:text-4xl">
							{c.comparisonTitle}
						</h2>
						<p className="mt-3 text-muted-foreground">{c.comparisonIntro}</p>
						<div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-background">
							<table className="w-full min-w-[640px] border-collapse text-left text-sm">
								<thead className="bg-muted/55">
									<tr>
										<th className="px-5 py-4 font-semibold">{c.feature}</th>
										<th className="px-5 py-4 font-semibold">{c.free}</th>
										<th className="px-5 py-4 font-semibold text-primary">
											{c.cloud}
										</th>
									</tr>
								</thead>
								<tbody>
									{c.rows.map(([feature, free, cloud]) => (
										<tr key={feature} className="border-t border-border">
											<th className="px-5 py-4 font-medium">{feature}</th>
											<td className="px-5 py-4 text-muted-foreground">
												{free}
											</td>
											<td className="px-5 py-4 text-muted-foreground">
												{cloud}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</section>

				<section className="studio-agent studio-container">
					<div>
						<p className="studio-eyebrow">
							<Workflow className="h-4 w-4" /> SKEDRA + MCP
						</p>
						<h2>
							{locale === "de"
								? "Deine KI denkt mit. Auf deinem Board."
								: "Your AI thinks with you. On your board."}
						</h2>
					</div>
					<div>
						<p>
							{locale === "de"
								? "Lass deinen AI-Agenten Diagramme erstellen und Boards bearbeiten. Du siehst das Ergebnis direkt in Skedra und entwickelst es weiter."
								: "Let your AI agent create diagrams and edit boards. See the result in Skedra and take the idea further."}
						</p>
						<Link className="studio-text-link" to={publicPath("/mcp")}>
							{locale === "de" ? "MCP kennenlernen" : "Discover MCP"}
							<ArrowRight className="h-4 w-4" />
						</Link>
					</div>
				</section>

				<section className="studio-closing px-4 py-20 text-center sm:px-6">
					<h2 className="font-display text-3xl font-bold sm:text-4xl">
						{c.ctaTitle}
					</h2>
					<p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
						{c.ctaText}
					</p>
					<Button asChild size="lg" className="mt-7">
						<Link to={publicPath("/")}>{c.draw}</Link>
					</Button>
					<p className="mt-4 text-xs text-muted-foreground">
						<a
							className="hover:text-foreground hover:underline"
							href="/product.md"
						>
							{c.machineReadable}
						</a>
					</p>
				</section>
			</article>
		</PublicSiteLayout>
	);
}
