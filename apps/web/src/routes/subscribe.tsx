import {
	SubscriptionPaywall,
	type SubscriptionPlanCode,
} from "@/components/billing/subscription-paywall";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { Navigate, useSearchParams } from "react-router";

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

	return (
		<Navigate
			to={`/pricing?redirect=${encodeURIComponent(redirect)}`}
			replace
		/>
	);
}
