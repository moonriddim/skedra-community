import { PublicSiteLayout } from "@/components/public/public-site-layout";
import { Button } from "@/components/ui/button";
import { formatFoundingTrialLabel } from "@/lib/billing-flow";
import { trackGrowthEventOnce } from "@/lib/growth-analytics";
import { useI18n } from "@/lib/i18n";
import { localizePublicPath } from "@/lib/public-path";
import { trpc } from "@/lib/trpc";
import {
	ArrowRight,
	Bot,
	Check,
	Github,
	KanbanSquare,
	LockKeyhole,
	Network,
	Server,
	Sparkles,
	Terminal,
} from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";

const GITHUB_URL = "https://github.com/moonriddim/skedra-community";

const copy = {
	de: {
		eyebrow: "Model Context Protocol für visuelle Arbeit",
		title: "Das Whiteboard, das dein AI-Agent wirklich bearbeiten kann.",
		lead: "Skedra verbindet Menschen und AI-Agenten auf einem gemeinsamen Infinite Canvas. Lass deinen Agenten Boards lesen, Kanban-Pläne, Gantt-Zeitachsen und Sequenzdiagramme erstellen – live und vollständig editierbar.",
		cta: "Kostenlos mit MCP starten",
		paidCta: "MCP-Pläne ansehen",
		github: "Community Edition",
		prompt: "Plane unseren Beta-Launch als Kanban und Gantt-Zeitachse.",
		answer: "Board aktualisiert · 18 Elemente · live synchronisiert",
		works: "Ein Server, deine bevorzugten Clients",
		worksLead:
			"Der Remote-MCP-Server funktioniert mit Codex, Claude, Cursor, OpenCode und jedem Client mit Streamable HTTP.",
		stepsTitle: "In drei Schritten vom Prompt zum gemeinsamen Board",
		step1: "Cloud-Konto erstellen",
		step1Body:
			"Founding-User-Trial starten – ohne Kreditkarte – und in den Einstellungen einen API-Key erzeugen.",
		step2: "MCP verbinden",
		step2Body:
			"Client auswählen, Konfiguration kopieren und Skedra als Tool-Server aktivieren.",
		step3: "Agent arbeiten lassen",
		step3Body:
			"Ein Board anlegen oder öffnen, Struktur erzeugen und anschließend gemeinsam visuell verfeinern.",
		toolsTitle: "23 fokussierte Tools statt Screenshot-Automation",
		toolsLead:
			"Der Agent arbeitet mit der strukturierten Canvas-API. Ergebnisse bleiben echte Skedra-Elemente, keine flachen Bilder.",
		securityTitle: "Cloud oder selbst gehostet",
		securityBody:
			"Nutze den OAuth-fähigen Remote-Server auf skedra.xyz oder betreibe Web-App, API, Datenbank und MCP-Server auf deiner Infrastruktur. Für agentische Workflows steht serververwaltete Verschlüsselung zur Verfügung; rein menschliche Boards können Ende-zu-Ende verschlüsselt bleiben.",
		finalTitle: "Gib deinem Agenten endlich eine visuelle Arbeitsfläche.",
		finalBody:
			"Der Editor bleibt für Menschen vollständig nutzbar. MCP ergänzt ihn um strukturierte, nachvollziehbare Agentenarbeit.",
	},
	en: {
		eyebrow: "Model Context Protocol for visual work",
		title: "The whiteboard your AI agent can actually edit.",
		lead: "Skedra brings people and AI agents together on one infinite canvas. Let your agent read boards and create Kanban plans, Gantt timelines, and sequence diagrams—live and fully editable.",
		cta: "Start with MCP for free",
		paidCta: "View MCP plans",
		github: "Community Edition",
		prompt: "Plan our beta launch as a Kanban board and Gantt timeline.",
		answer: "Board updated · 18 elements · synced live",
		works: "One server, your preferred clients",
		worksLead:
			"The remote MCP server works with Codex, Claude, Cursor, OpenCode, and any Streamable HTTP client.",
		stepsTitle: "From prompt to shared board in three steps",
		step1: "Create a Cloud account",
		step1Body:
			"Start the no-card Founding User trial and create an API key in settings.",
		step2: "Connect MCP",
		step2Body:
			"Choose your client, copy its configuration, and enable Skedra as a tool server.",
		step3: "Let the agent work",
		step3Body:
			"Create or open a board, generate structure, then refine it visually together.",
		toolsTitle: "23 focused tools, not screenshot automation",
		toolsLead:
			"The agent uses the structured canvas API. Results stay as real Skedra elements rather than flat images.",
		securityTitle: "Cloud or self-hosted",
		securityBody:
			"Use the OAuth-capable remote server at skedra.xyz or run the web app, API, database, and MCP server on your infrastructure. Server-managed encryption supports agent workflows while human-only boards can remain end-to-end encrypted.",
		finalTitle: "Give your agent a visual workspace.",
		finalBody:
			"The editor remains a complete human workspace. MCP adds structured, inspectable agent work.",
	},
} as const;

const toolGroups = [
	["Boards", "create_board · list_boards · get_board"],
	["Canvas", "get_canvas_state · edit_canvas · reorder_elements"],
	["Planning", "create_kanban · create_gantt · create_sequence_diagram"],
	["Teams", "list_members · invite_member · get_activity"],
] as const;

export function McpPage() {
	const { locale } = useI18n();
	const text = copy[locale];
	const publicPath = (path: string) => localizePublicPath(path, locale);
	const { data: publicConfig } = trpc.billing.getPublicConfig.useQuery();
	const trialLabel = formatFoundingTrialLabel(
		publicConfig?.foundingTrialDays,
		locale,
	);
	const registerUrl = `/register?${new URLSearchParams({
		redirect: "/settings?tab=api-keys",
	}).toString()}`;
	const primaryUrl = trialLabel ? registerUrl : publicPath("/pricing");
	const primaryLabel = trialLabel ? text.cta : text.paidCta;

	useEffect(() => {
		trackGrowthEventOnce("mcp_setup_viewed", { context: "landing_page" });
	}, []);

	return (
		<PublicSiteLayout>
			<section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,hsl(var(--primary)/0.18),transparent_32%),radial-gradient(circle_at_85%_15%,hsl(var(--accent)/0.8),transparent_30%)]" />
				<div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.02fr_.98fr]">
					<div>
						<div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-sm font-medium text-primary">
							<Sparkles className="h-4 w-4" />
							{text.eyebrow}
						</div>
						<h1 className="mt-6 font-display text-balance text-4xl font-bold tracking-tight sm:text-6xl">
							{text.title}
						</h1>
						<p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
							{text.lead}
						</p>
						{trialLabel ? (
							<div className="mt-5 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
								<Check className="h-4 w-4" />
								{trialLabel} ·{" "}
								{locale === "en" ? "no credit card" : "ohne Kreditkarte"}
							</div>
						) : null}
						<div className="mt-8 flex flex-wrap gap-3">
							<Button asChild size="lg">
								<Link to={primaryUrl}>
									{primaryLabel}
									<ArrowRight className="h-4 w-4" />
								</Link>
							</Button>
							<Button asChild size="lg" variant="outline">
								<a href={GITHUB_URL} target="_blank" rel="noreferrer">
									<Github className="h-4 w-4" />
									{text.github}
								</a>
							</Button>
						</div>
					</div>

					<div className="rounded-3xl border border-border bg-card/90 p-4 shadow-2xl shadow-primary/10 backdrop-blur sm:p-6">
						<div className="flex items-center gap-2 border-b border-border pb-4 text-sm font-semibold">
							<Bot className="h-5 w-5 text-primary" /> Skedra MCP
							<span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-600">
								connected
							</span>
						</div>
						<div className="mt-4 rounded-2xl bg-muted/55 p-4 text-sm leading-6">
							<span className="font-semibold">You</span>
							<p className="text-muted-foreground">{text.prompt}</p>
						</div>
						<div className="mt-4 grid gap-3 sm:grid-cols-3">
							<DemoColumn title="Backlog" cards={["Landing page", "Docs"]} />
							<DemoColumn title="Doing" cards={["MCP demo"]} accent />
							<DemoColumn title="Done" cards={["Trial"]} />
						</div>
						<div className="mt-4 rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
							{text.answer}
						</div>
					</div>
				</div>
			</section>

			<section className="border-y border-border bg-muted/25 px-4 py-16 sm:px-6">
				<div className="mx-auto max-w-6xl text-center">
					<h2 className="text-3xl font-semibold tracking-tight">
						{text.works}
					</h2>
					<p className="mx-auto mt-3 max-w-3xl text-muted-foreground">
						{text.worksLead}
					</p>
					<div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
						{["Codex", "Claude", "Cursor", "OpenCode"].map((client) => (
							<div
								key={client}
								className="rounded-2xl border border-border bg-card px-5 py-4 font-semibold shadow-sm"
							>
								{client}
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="px-4 py-20 sm:px-6">
				<div className="mx-auto max-w-6xl">
					<h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
						{text.stepsTitle}
					</h2>
					<div className="mt-10 grid gap-5 md:grid-cols-3">
						<Step
							number="01"
							icon={<Terminal />}
							title={text.step1}
							body={text.step1Body}
						/>
						<Step
							number="02"
							icon={<Network />}
							title={text.step2}
							body={text.step2Body}
						/>
						<Step
							number="03"
							icon={<KanbanSquare />}
							title={text.step3}
							body={text.step3Body}
						/>
					</div>
				</div>
			</section>

			<section className="bg-foreground px-4 py-20 text-background sm:px-6">
				<div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[.85fr_1.15fr]">
					<div>
						<h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
							{text.toolsTitle}
						</h2>
						<p className="mt-4 leading-7 text-background/70">
							{text.toolsLead}
						</p>
					</div>
					<div className="grid gap-3 sm:grid-cols-2">
						{toolGroups.map(([title, tools]) => (
							<div
								key={title}
								className="rounded-2xl border border-background/15 bg-background/5 p-5"
							>
								<h3 className="font-semibold">{title}</h3>
								<p className="mt-2 break-words font-mono text-xs leading-6 text-background/65">
									{tools}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="px-4 py-20 sm:px-6">
				<div className="mx-auto grid max-w-6xl gap-8 rounded-3xl border border-border bg-card p-7 shadow-sm md:grid-cols-[auto_1fr] md:p-10">
					<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
						<LockKeyhole className="h-7 w-7" />
					</div>
					<div>
						<h2 className="text-2xl font-semibold">{text.securityTitle}</h2>
						<p className="mt-3 max-w-4xl leading-7 text-muted-foreground">
							{text.securityBody}
						</p>
						<div className="mt-5 flex flex-wrap gap-4 text-sm font-medium">
							<span className="inline-flex items-center gap-2">
								<Server className="h-4 w-4 text-primary" /> Remote MCP + OAuth
							</span>
							<span className="inline-flex items-center gap-2">
								<Github className="h-4 w-4 text-primary" /> Source-available
								Community Edition
							</span>
						</div>
					</div>
				</div>
			</section>

			<section className="px-4 pb-24 sm:px-6">
				<div className="mx-auto max-w-5xl rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
					<h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
						{text.finalTitle}
					</h2>
					<p className="mx-auto mt-4 max-w-2xl text-primary-foreground/80">
						{text.finalBody}
					</p>
					<div className="mt-7 flex flex-wrap justify-center gap-3">
						<Button asChild size="lg" variant="secondary">
							<Link to={primaryUrl}>{primaryLabel}</Link>
						</Button>
						<Button
							asChild
							size="lg"
							variant="outline"
							className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
						>
							<Link to={publicPath("/pricing")}>
								{locale === "en" ? "View pricing" : "Preise ansehen"}
							</Link>
						</Button>
					</div>
				</div>
			</section>
		</PublicSiteLayout>
	);
}

function DemoColumn({
	title,
	cards,
	accent = false,
}: { title: string; cards: string[]; accent?: boolean }) {
	return (
		<div
			className={`rounded-xl border p-3 ${accent ? "border-primary/30 bg-primary/5" : "border-border bg-background"}`}
		>
			<p className="text-xs font-semibold text-muted-foreground">{title}</p>
			<div className="mt-2 space-y-2">
				{cards.map((card) => (
					<div
						key={card}
						className="rounded-lg border border-border bg-card px-2 py-2 text-xs shadow-sm"
					>
						{card}
					</div>
				))}
			</div>
		</div>
	);
}

function Step({
	number,
	icon,
	title,
	body,
}: { number: string; icon: React.ReactNode; title: string; body: string }) {
	return (
		<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
			<div className="flex items-center justify-between">
				<span className="text-sm font-semibold text-primary">{number}</span>
				<span className="text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
			</div>
			<h3 className="mt-5 text-lg font-semibold">{title}</h3>
			<p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
		</div>
	);
}
