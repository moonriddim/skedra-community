import { PublicSiteLayout } from "@/components/public/public-site-layout";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
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
	"pricingPage.freeFeatures.one",
	"pricingPage.freeFeatures.two",
	"pricingPage.freeFeatures.three",
	"pricingPage.freeFeatures.four",
	"pricingPage.freeFeatures.five",
];

const cloudFeatures = [
	"pricingPage.cloudFeatures.one",
	"pricingPage.cloudFeatures.two",
	"pricingPage.cloudFeatures.three",
	"pricingPage.cloudFeatures.four",
	"pricingPage.cloudFeatures.five",
	"pricingPage.cloudFeatures.six",
];

const comparison = [
	["pricingPage.comparison.one", true, true],
	["pricingPage.comparison.two", true, true],
	["pricingPage.comparison.three", true, true],
	["pricingPage.comparison.four", false, true],
	["pricingPage.comparison.five", false, true],
	["pricingPage.comparison.six", false, true],
	["pricingPage.comparison.seven", false, true],
	["pricingPage.comparison.eight", false, true],
] as const;

const faqs = [
	["pricingPage.faq.oneQuestion", "pricingPage.faq.oneAnswer"],
	["pricingPage.faq.twoQuestion", "pricingPage.faq.twoAnswer"],
	["pricingPage.faq.threeQuestion", "pricingPage.faq.threeAnswer"],
	["pricingPage.faq.fourQuestion", "pricingPage.faq.fourAnswer"],
	["pricingPage.faq.fiveQuestion", "pricingPage.faq.fiveAnswer"],
] as const;

function safeRedirect(value: string | null) {
	return value?.startsWith("/") &&
		!value.startsWith("//") &&
		!value.includes("\\")
		? value
		: "/library";
}

export function PricingPage() {
	const { t } = useI18n();
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
						{t("pricingPage.badge")}
					</div>
					<h1 className="font-display text-balance text-4xl font-bold tracking-tight sm:text-6xl">
						{t("pricingPage.title")}{" "}
						<span className="text-primary">{t("pricingPage.titleAccent")}</span>
					</h1>
					<p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
						{t("pricingPage.description")}
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
								{t("pricingPage.monthly")}
							</button>
							<button
								type="button"
								onClick={() => setPeriod("yearly")}
								className={`rounded-full px-4 py-2 text-sm font-medium transition ${period === "yearly" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
							>
								{t("pricingPage.yearly")}{" "}
								<span className="ml-1 text-primary">
									{t("pricingPage.savingsShort")}
								</span>
							</button>
						</div>
					</div>

					<div className="grid gap-6 md:grid-cols-2">
						<PricingCard
							icon={<HardDrive className="h-6 w-6" />}
							title="Free"
							eyebrow={t("pricingPage.freeEyebrow")}
							price="CHF 0"
							period={t("pricingPage.freePeriod")}
							description={t("pricingPage.freeDescription")}
							features={freeFeatures.map((key) => t(key))}
							action={
								<Button asChild variant="outline" size="lg" className="w-full">
									<Link to="/">{t("pricingPage.drawNow")}</Link>
								</Button>
							}
						/>
						<PricingCard
							highlight
							icon={<Cloud className="h-6 w-6" />}
							title="Skedra Cloud"
							eyebrow={t("pricingPage.cloudEyebrow")}
							price={period === "yearly" ? "CHF 49" : "CHF 4.90"}
							period={
								period === "yearly"
									? t("pricingPage.cloudYearlyPeriod")
									: t("pricingPage.cloudMonthlyPeriod")
							}
							description={t("pricingPage.cloudDescription")}
							features={cloudFeatures.map((key) => t(key))}
							recommendedLabel={t("pricingPage.recommended")}
							action={
								<Button asChild size="lg" className="w-full">
									<Link to={registerUrl}>{t("pricingPage.subscribe")}</Link>
								</Button>
							}
						/>
					</div>
					<p className="mt-7 text-center text-sm text-muted-foreground">
						{t("pricingPage.existingSubscription")}{" "}
						<Link
							className="font-medium text-primary hover:underline"
							to={`/login?redirect=${encodeURIComponent(loginReturn)}`}
						>
							{t("pricingPage.existingSubscriptionAction")}
						</Link>
					</p>
					<p className="mt-3 text-center text-xs text-muted-foreground">
						<a
							className="hover:text-foreground hover:underline"
							href="/pricing.md"
						>
							{t("pricingPage.machineReadable")}
						</a>
					</p>
				</div>
			</section>

			<section className="border-y border-border bg-card/55 px-4 py-20 sm:px-6">
				<div className="mx-auto max-w-5xl">
					<div className="text-center">
						<LockKeyhole className="mx-auto h-8 w-8 text-primary" />
						<h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
							{t("pricingPage.comparisonTitle")}
						</h2>
						<p className="mt-3 text-muted-foreground">
							{t("pricingPage.comparisonDescription")}
						</p>
					</div>
					<div className="mt-10 overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
						<div className="grid grid-cols-[1fr_72px_72px] border-b border-border bg-muted/45 px-4 py-3 text-sm font-semibold sm:grid-cols-[1fr_140px_140px] sm:px-6">
							<span>{t("pricingPage.feature")}</span>
							<span className="text-center">Free</span>
							<span className="text-center text-primary">Cloud</span>
						</div>
						{comparison.map(([label, free, cloud]) => (
							<div
								key={label}
								className="grid grid-cols-[1fr_72px_72px] items-center border-b border-border/70 px-4 py-3.5 text-sm last:border-0 sm:grid-cols-[1fr_140px_140px] sm:px-6"
							>
								<span>{t(label)}</span>
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
							{t("pricingPage.faqTitle")}
						</h2>
					</div>
					<div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card px-5 sm:px-7">
						{faqs.map(([question, answer]) => (
							<details key={question} className="group py-5">
								<summary className="cursor-pointer list-none pr-8 font-semibold marker:hidden">
									{t(question)}
									<span className="float-right text-primary transition group-open:rotate-45">
										+
									</span>
								</summary>
								<p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
									{t(answer)}
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
	recommendedLabel,
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
	recommendedLabel?: string;
	highlight?: boolean;
}) {
	return (
		<article
			className={`relative flex flex-col rounded-3xl border p-6 shadow-sm sm:p-8 ${highlight ? "border-primary/50 bg-card ring-1 ring-primary/15" : "border-border bg-card/75"}`}
		>
			{highlight && (
				<span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
					{recommendedLabel}
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
