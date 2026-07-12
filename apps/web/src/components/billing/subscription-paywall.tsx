import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import {
	BadgeCheck,
	Check,
	Cloud,
	ExternalLink,
	Loader2,
	LogOut,
	Server,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router";

const SELFHOST_URL = "https://github.com/moonriddim/skedra-selfhost";
const portalStatuses = new Set([
	"active",
	"trialing",
	"past_due",
	"unpaid",
	"incomplete",
]);

export type SubscriptionPlanCode = "pro_monthly" | "pro_yearly";

interface SubscriptionPaywallProps {
	initialPlan?: SubscriptionPlanCode;
	redirect?: string;
}

export function SubscriptionPaywall({
	initialPlan,
	redirect,
}: SubscriptionPaywallProps = {}) {
	const { t } = useI18n();
	const [searchParams] = useSearchParams();
	const checkoutStarted = useRef(false);
	const { data: billing } = trpc.billing.getStatus.useQuery(undefined, {
		refetchInterval: (query) =>
			query.state.data?.accessGranted ? false : 3000,
	});
	const checkout = trpc.billing.createCheckoutSession.useMutation({
		onSuccess: ({ url }) => window.location.assign(url),
	});
	const portal = trpc.billing.createPortalSession.useMutation({
		onSuccess: ({ url }) => window.location.assign(url),
	});
	const canUsePortal = Boolean(
		billing?.subscription?.stripeSubscriptionId &&
			portalStatuses.has(billing.subscription.status),
	);
	const error = checkout.error ?? portal.error;

	useEffect(() => {
		if (
			!initialPlan ||
			checkoutStarted.current ||
			!billing?.configured ||
			billing.accessGranted ||
			canUsePortal
		) {
			return;
		}
		checkoutStarted.current = true;
		checkout.mutate({ plan: initialPlan, redirect });
	}, [billing, canUsePortal, checkout, initialPlan, redirect]);

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_38%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-8 sm:py-14">
			<div className="mx-auto max-w-5xl">
				<div className="mb-9 flex items-center justify-between gap-4">
					<BrandLogo markClassName="h-10 w-10" wordmarkClassName="text-xl" />
					<Button variant="ghost" onClick={() => void authClient.signOut()}>
						<LogOut className="h-4 w-4" />
						{t("subscriptionWall.signOut")}
					</Button>
				</div>

				<header className="mx-auto max-w-3xl text-center">
					<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/20">
						<Cloud className="h-7 w-7" />
					</div>
					<h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
						{t("subscriptionWall.title")}
					</h1>
					<p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
						{t("subscriptionWall.description")}
					</p>
				</header>

				{searchParams.get("checkout") === "canceled" && (
					<div className="mx-auto mt-7 max-w-2xl rounded-xl border border-border bg-background/80 px-4 py-3 text-center text-sm text-muted-foreground">
						{t("subscriptionWall.canceled")}
					</div>
				)}
				{searchParams.get("checkout") === "success" && (
					<div className="mx-auto mt-7 flex max-w-2xl items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 text-sm text-foreground">
						<BadgeCheck className="h-4 w-4 text-emerald-600" />
						{t("subscriptionWall.activating")}
					</div>
				)}

				{!billing?.configured ? (
					<div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-amber-500/30 bg-amber-500/8 p-6 text-center">
						<h2 className="font-semibold text-foreground">
							{t("subscriptionWall.unavailableTitle")}
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							{t("subscriptionWall.unavailableDescription")}
						</p>
					</div>
				) : !canUsePortal ? (
					<SubscriptionPlanCards
						loading={checkout.isPending}
						onChoose={(plan) => checkout.mutate({ plan, redirect })}
					/>
				) : (
					<div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-amber-500/30 bg-background/85 p-6 text-center shadow-sm">
						<h2 className="font-semibold text-foreground">
							{t("subscriptionWall.paymentAttentionTitle")}
						</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							{t("subscriptionWall.paymentAttentionDescription")}
						</p>
					</div>
				)}

				{canUsePortal && (
					<div className="mt-5 text-center">
						<Button
							variant="outline"
							disabled={portal.isPending}
							onClick={() => portal.mutate()}
						>
							{portal.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<ExternalLink className="h-4 w-4" />
							)}
							{t("subscriptionWall.manage")}
						</Button>
					</div>
				)}

				{error && (
					<p className="mt-5 text-center text-sm text-destructive">
						{error.message}
					</p>
				)}

				<div className="mt-10 rounded-2xl border border-border/80 bg-background/75 p-6 shadow-sm backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-8">
					<div className="flex gap-4">
						<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
							<Server className="h-5 w-5" />
						</div>
						<div>
							<h2 className="font-semibold text-foreground">
								{t("subscriptionWall.selfhostTitle")}
							</h2>
							<p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
								{t("subscriptionWall.selfhostDescription")}
							</p>
						</div>
					</div>
					<Button asChild variant="outline" className="mt-5 shrink-0 sm:mt-0">
						<a href={SELFHOST_URL} target="_blank" rel="noreferrer">
							{t("subscriptionWall.selfhostAction")}
							<ExternalLink className="h-4 w-4" />
						</a>
					</Button>
				</div>

				<p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
					{t("subscriptionWall.guestNote")}
				</p>
				<div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
					<Link className="hover:text-foreground hover:underline" to="/pricing">
						{t("publicSite.pricing")}
					</Link>
					<Link className="hover:text-foreground hover:underline" to="/privacy">
						{t("publicSite.privacy")}
					</Link>
					<Link className="hover:text-foreground hover:underline" to="/terms">
						{t("publicSite.terms")}
					</Link>
					<Link className="hover:text-foreground hover:underline" to="/imprint">
						{t("publicSite.imprint")}
					</Link>
				</div>
			</div>
		</div>
	);
}

interface SubscriptionPlanCardsProps {
	loading: boolean;
	onChoose: (plan: SubscriptionPlanCode) => void;
}

export function SubscriptionPlanCards({
	loading,
	onChoose,
}: SubscriptionPlanCardsProps) {
	const { t } = useI18n();

	return (
		<div className="mt-10 grid gap-5 md:grid-cols-2">
			<PlanCard
				title={t("subscriptionWall.monthly")}
				price="CHF 4.90"
				period={t("subscriptionWall.perMonth")}
				description={t("subscriptionWall.monthlyDescription")}
				action={t("subscriptionWall.chooseMonthly")}
				featureOne={t("subscriptionWall.personalAccess")}
				featureTwo={t("subscriptionWall.cloudFeatures")}
				loading={loading}
				onClick={() => onChoose("pro_monthly")}
			/>
			<PlanCard
				title={t("subscriptionWall.yearly")}
				price="CHF 49"
				period={t("subscriptionWall.perYear")}
				description={t("subscriptionWall.yearlyDescription")}
				action={t("subscriptionWall.chooseYearly")}
				featureOne={t("subscriptionWall.personalAccess")}
				featureTwo={t("subscriptionWall.cloudFeatures")}
				savings={t("subscriptionWall.savings")}
				loading={loading}
				highlight
				onClick={() => onChoose("pro_yearly")}
			/>
		</div>
	);
}

interface PlanCardProps {
	title: string;
	price: string;
	period: string;
	description: string;
	action: string;
	featureOne: string;
	featureTwo: string;
	savings?: string;
	loading: boolean;
	highlight?: boolean;
	onClick: () => void;
}

function PlanCard({
	title,
	price,
	period,
	description,
	action,
	featureOne,
	featureTwo,
	savings,
	loading,
	highlight,
	onClick,
}: PlanCardProps) {
	return (
		<div
			className={`relative rounded-2xl border bg-background/85 p-6 shadow-sm backdrop-blur ${
				highlight
					? "border-primary/50 ring-1 ring-primary/20"
					: "border-border/80"
			}`}
		>
			{highlight && (
				<span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
					{savings}
				</span>
			)}
			<h2 className="text-lg font-semibold text-foreground">{title}</h2>
			<div className="mt-4 flex items-end gap-2">
				<span className="text-4xl font-semibold tracking-tight text-foreground">
					{price}
				</span>
				<span className="pb-1 text-sm text-muted-foreground">{period}</span>
			</div>
			<p className="mt-4 text-sm leading-6 text-muted-foreground">
				{description}
			</p>
			<ul className="mt-5 space-y-2 text-sm text-foreground">
				<li className="flex gap-2">
					<Check className="mt-0.5 h-4 w-4 text-primary" />
					{featureOne}
				</li>
				<li className="flex gap-2">
					<Check className="mt-0.5 h-4 w-4 text-primary" />
					{featureTwo}
				</li>
			</ul>
			<Button
				className="mt-6 w-full"
				variant={highlight ? "default" : "outline"}
				disabled={loading}
				onClick={onClick}
			>
				{loading && <Loader2 className="h-4 w-4 animate-spin" />}
				{action}
			</Button>
		</div>
	);
}
