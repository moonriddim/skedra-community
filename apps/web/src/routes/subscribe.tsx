import {
	SubscriptionPaywall,
	SubscriptionPlanCards,
	type SubscriptionPlanCode,
} from "@/components/billing/subscription-paywall";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Cloud, Loader2, LogIn } from "lucide-react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

function safeLocalPath(value: string | null, fallback = "/") {
	return value?.startsWith("/") &&
		!value.startsWith("//") &&
		!value.includes("\\")
		? value
		: fallback;
}

function selectedPlan(value: string | null): SubscriptionPlanCode | undefined {
	return value === "pro_monthly" || value === "pro_yearly" ? value : undefined;
}

function PageLoader() {
	return (
		<div className="flex h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}

export function SubscribePage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { data: session, isPending: sessionPending } = authClient.useSession();
	const config = trpc.billing.getPublicConfig.useQuery();
	const billing = trpc.billing.getStatus.useQuery(undefined, {
		enabled: Boolean(session?.user && config.data?.managed),
		retry: false,
		refetchInterval: (query) =>
			query.state.data?.accessGranted ? false : 3000,
	});
	const redirect = safeLocalPath(searchParams.get("redirect"));
	const plan = selectedPlan(searchParams.get("plan"));
	const startCheckout = searchParams.get("checkout") === "start";

	if (sessionPending || config.isPending) return <PageLoader />;

	if (!config.data?.managed) {
		if (session?.user) return <Navigate to={redirect} replace />;
		return (
			<Navigate
				to={`/login?redirect=${encodeURIComponent(redirect)}`}
				replace
			/>
		);
	}

	if (session?.user) {
		if (billing.isPending) return <PageLoader />;
		if (billing.data?.accessGranted) return <Navigate to={redirect} replace />;
		return (
			<SubscriptionPaywall
				initialPlan={startCheckout ? plan : undefined}
				redirect={redirect}
			/>
		);
	}

	const handleChoose = (chosenPlan: SubscriptionPlanCode) => {
		const params = new URLSearchParams({
			plan: chosenPlan,
			redirect,
		});
		navigate(`/register?${params.toString()}`);
	};
	const loginReturn = `/subscribe?${new URLSearchParams({ redirect }).toString()}`;

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_38%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-8 sm:py-14">
			<div className="mx-auto max-w-5xl">
				<div className="mb-9 flex items-center justify-between gap-4">
					<BrandLogo markClassName="h-10 w-10" wordmarkClassName="text-xl" />
					<Button asChild variant="ghost">
						<Link to="/">
							<ArrowLeft className="h-4 w-4" />
							{t("subscriptionWall.freeWhiteboard")}
						</Link>
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

				{config.data.configured ? (
					<SubscriptionPlanCards loading={false} onChoose={handleChoose} />
				) : (
					<div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-amber-500/30 bg-amber-500/8 p-6 text-center">
						<h2 className="font-semibold text-foreground">
							{t("subscriptionWall.unavailableTitle")}
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							{t("subscriptionWall.unavailableDescription")}
						</p>
					</div>
				)}

				<div className="mt-7 flex flex-col items-center gap-2 text-center">
					<p className="text-sm text-muted-foreground">
						{t("subscriptionWall.existingAccount")}
					</p>
					<Button asChild variant="outline">
						<Link to={`/login?redirect=${encodeURIComponent(loginReturn)}`}>
							<LogIn className="h-4 w-4" />
							{t("subscriptionWall.existingAccountAction")}
						</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
