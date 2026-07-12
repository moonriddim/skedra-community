import { PublicSiteLayout } from "@/components/public/public-site-layout";
import { Button } from "@/components/ui/button";
import {
	BadgeCheck,
	Check,
	Cloud,
	HardDrive,
	LockKeyhole,
	Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

type BillingPeriod = "monthly" | "yearly";

const freeFeatures = [
	"Vollständiger Infinite-Canvas-Editor",
	"Lokale Speicherung im Browser",
	"PNG-, SVG-, PDF-, PPTX- und Skedra-Export",
	"Vorlagen und öffentliche Bibliotheken",
	"Ohne Konto nutzbar",
];

const cloudFeatures = [
	"Alles aus Free",
	"Unbegrenzte Cloud-Boards und Ordner",
	"Ende-zu-Ende- oder serverseitige Verschlüsselung",
	"Live-Zusammenarbeit, Kommentare und Präsentationen",
	"Teams, Rollen und Freigaberechte",
	"Cloud-Speicher, API Keys und MCP",
];

const comparison = [
	["Infinite Canvas und Editor", true, true],
	["Lokale Browser-Speicherung", true, true],
	["Datei- und Bildexport", true, true],
	["Cloud-Synchronisierung", false, true],
	["Unbegrenzte gespeicherte Boards", false, true],
	["Live-Zusammenarbeit und Kommentare", false, true],
	["Teams, Rollen und Zugriffsverwaltung", false, true],
	["Präsentationen und Read-only-Links", false, true],
] as const;

const faqs = [
	[
		"Brauche ich für das Free Whiteboard ein Konto?",
		"Nein. Das freie Whiteboard funktioniert direkt im Browser und speichert lokal auf deinem Gerät.",
	],
	[
		"Was passiert mit meinen lokalen Zeichnungen?",
		"Sie bleiben im Browser gespeichert. Du kannst sie zusätzlich als Skedra-Datei exportieren. Browserdaten können gelöscht werden – für dauerhafte Cloud-Speicherung brauchst du Skedra Cloud.",
	],
	[
		"Kann ich monatlich kündigen?",
		"Ja. Das Monatsabo ist monatlich kündbar. Beim Jahresabo bleibt der Zugang bis zum Ende des bezahlten Zeitraums aktiv.",
	],
	[
		"Benötigt jedes Teammitglied ein Abo?",
		"Ja. In Skedra Cloud benötigt jede registrierte Person einen eigenen aktiven Zugang. Öffentliche Ansichten bleiben für Gäste zugänglich.",
	],
	[
		"Kann ich Skedra selbst hosten?",
		"Ja. Die Community Edition kann auf eigener Infrastruktur betrieben werden und hat keine Skedra-Cloud-Paywall.",
	],
] as const;

function safeRedirect(value: string | null) {
	return value?.startsWith("/") &&
		!value.startsWith("//") &&
		!value.includes("\\")
		? value
		: "/library";
}

export function PricingPage() {
	const [period, setPeriod] = useState<BillingPeriod>("yearly");
	const [searchParams] = useSearchParams();
	const redirect = safeRedirect(searchParams.get("redirect"));
	const plan = period === "yearly" ? "pro_yearly" : "pro_monthly";
	const registerUrl = `/register?${new URLSearchParams({ plan, redirect }).toString()}`;
	const loginReturn = `/subscribe?${new URLSearchParams({ redirect }).toString()}`;

	return (
		<PublicSiteLayout>
			<section className="relative overflow-hidden px-4 pb-14 pt-16 sm:px-6 sm:pb-20 sm:pt-24">
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_0%,hsl(var(--primary)/0.16),transparent_34%),radial-gradient(circle_at_80%_20%,hsl(var(--accent)/0.7),transparent_30%)]" />
				<div className="relative mx-auto max-w-4xl text-center">
					<div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-sm font-medium text-primary">
						<Sparkles className="h-4 w-4" />
						Einfach starten. Erst für die Cloud zahlen.
					</div>
					<h1 className="font-display text-balance text-4xl font-bold tracking-tight sm:text-6xl">
						Deine Ideen sind frei.{" "}
						<span className="text-primary">Deine Cloud ist optional.</span>
					</h1>
					<p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
						Zeichne kostenlos ohne Konto. Wechsle zu Skedra Cloud, wenn du
						Boards dauerhaft speichern, im Team organisieren und sicher
						zusammenarbeiten möchtest.
					</p>
				</div>
			</section>

			<section className="px-4 pb-20 sm:px-6">
				<div className="mx-auto max-w-5xl">
					<div className="mb-8 flex justify-center">
						<div className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm">
							<button
								type="button"
								onClick={() => setPeriod("monthly")}
								className={`rounded-full px-4 py-2 text-sm font-medium transition ${period === "monthly" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
							>
								Monatlich
							</button>
							<button
								type="button"
								onClick={() => setPeriod("yearly")}
								className={`rounded-full px-4 py-2 text-sm font-medium transition ${period === "yearly" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
							>
								Jährlich <span className="ml-1 text-primary">−17%</span>
							</button>
						</div>
					</div>

					<div className="grid gap-6 md:grid-cols-2">
						<PricingCard
							icon={<HardDrive className="h-6 w-6" />}
							title="Free"
							eyebrow="Lokal und ohne Konto"
							price="CHF 0"
							period="für immer"
							description="Der komplette Editor für schnelle Ideen, Skizzen und lokale Dateien."
							features={freeFeatures}
							action={
								<Button asChild variant="outline" size="lg" className="w-full">
									<Link to="/">Jetzt zeichnen</Link>
								</Button>
							}
						/>
						<PricingCard
							highlight
							icon={<Cloud className="h-6 w-6" />}
							title="Skedra Cloud"
							eyebrow="Für dauerhafte Arbeit"
							price={period === "yearly" ? "CHF 49" : "CHF 4.90"}
							period={
								period === "yearly" ? "pro Jahr / Person" : "pro Monat / Person"
							}
							description="Verschlüsselte Cloud-Boards, Zusammenarbeit und Teamverwaltung."
							features={cloudFeatures}
							action={
								<Button asChild size="lg" className="w-full">
									<Link to={registerUrl}>Skedra Cloud abonnieren</Link>
								</Button>
							}
						/>
					</div>
					<p className="mt-7 text-center text-sm text-muted-foreground">
						Du hast bereits ein Abo?{" "}
						<Link
							className="font-medium text-primary hover:underline"
							to={`/login?redirect=${encodeURIComponent(loginReturn)}`}
						>
							Mit bestehendem Konto anmelden
						</Link>
					</p>
				</div>
			</section>

			<section className="border-y border-border bg-card/55 px-4 py-20 sm:px-6">
				<div className="mx-auto max-w-5xl">
					<div className="text-center">
						<LockKeyhole className="mx-auto h-8 w-8 text-primary" />
						<h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
							Free oder Cloud? Du entscheidest.
						</h2>
						<p className="mt-3 text-muted-foreground">
							Der Editor bleibt frei. Bezahlt werden nur Hosting,
							Synchronisierung und Zusammenarbeit.
						</p>
					</div>
					<div className="mt-10 overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
						<div className="grid grid-cols-[1fr_72px_72px] border-b border-border bg-muted/45 px-4 py-3 text-sm font-semibold sm:grid-cols-[1fr_140px_140px] sm:px-6">
							<span>Funktion</span>
							<span className="text-center">Free</span>
							<span className="text-center text-primary">Cloud</span>
						</div>
						{comparison.map(([label, free, cloud]) => (
							<div
								key={label}
								className="grid grid-cols-[1fr_72px_72px] items-center border-b border-border/70 px-4 py-3.5 text-sm last:border-0 sm:grid-cols-[1fr_140px_140px] sm:px-6"
							>
								<span>{label}</span>
								<span className="flex justify-center">
									{free ? (
										<Check className="h-5 w-5 text-primary" />
									) : (
										<span className="text-muted-foreground">–</span>
									)}
								</span>
								<span className="flex justify-center">
									{cloud ? (
										<Check className="h-5 w-5 text-primary" />
									) : (
										<span>–</span>
									)}
								</span>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="px-4 py-20 sm:px-6">
				<div className="mx-auto max-w-3xl">
					<div className="text-center">
						<BadgeCheck className="mx-auto h-8 w-8 text-primary" />
						<h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
							Häufige Fragen
						</h2>
					</div>
					<div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card px-5 sm:px-7">
						{faqs.map(([question, answer]) => (
							<details key={question} className="group py-5">
								<summary className="cursor-pointer list-none pr-8 font-semibold marker:hidden">
									{question}
									<span className="float-right text-primary transition group-open:rotate-45">
										+
									</span>
								</summary>
								<p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
									{answer}
								</p>
							</details>
						))}
					</div>
				</div>
			</section>
		</PublicSiteLayout>
	);
}

function PricingCard({
	icon,
	title,
	eyebrow,
	price,
	period,
	description,
	features,
	action,
	highlight = false,
}: {
	icon: React.ReactNode;
	title: string;
	eyebrow: string;
	price: string;
	period: string;
	description: string;
	features: readonly string[];
	action: React.ReactNode;
	highlight?: boolean;
}) {
	return (
		<article
			className={`relative flex flex-col rounded-3xl border p-6 shadow-sm sm:p-8 ${highlight ? "border-primary/50 bg-card ring-1 ring-primary/15" : "border-border bg-card/75"}`}
		>
			{highlight && (
				<span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
					Empfohlen
				</span>
			)}
			<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
				{icon}
			</div>
			<p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
				{eyebrow}
			</p>
			<h2 className="mt-2 font-display text-2xl font-bold">{title}</h2>
			<div className="mt-5 flex flex-wrap items-baseline gap-2">
				<span className="text-4xl font-bold tracking-tight">{price}</span>
				<span className="text-sm text-muted-foreground">{period}</span>
			</div>
			<p className="mt-4 min-h-12 text-sm leading-6 text-muted-foreground">
				{description}
			</p>
			<div className="mt-6">{action}</div>
			<ul className="mt-7 space-y-3 text-sm">
				{features.map((feature) => (
					<li key={feature} className="flex gap-3">
						<Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
						<span>{feature}</span>
					</li>
				))}
			</ul>
		</article>
	);
}
