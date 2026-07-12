import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
	BadgeCheck,
	CreditCard,
	ExternalLink,
	Loader2,
	ShieldCheck,
} from "lucide-react";
import { useSearchParams } from "react-router";

const statusLabels: Record<string, string> = {
	active: "Aktiv",
	trialing: "Testphase",
	past_due: "Zahlung ausstehend",
	unpaid: "Nicht bezahlt",
	incomplete: "Zahlung unvollständig",
	incomplete_expired: "Checkout abgelaufen",
	canceled: "Gekündigt",
	paused: "Pausiert",
	inactive: "Noch kein Abo",
};

const portalStatuses = new Set([
	"active",
	"trialing",
	"past_due",
	"unpaid",
	"incomplete",
]);

export function BillingSettings() {
	const [searchParams] = useSearchParams();
	const { data: billing, isLoading } = trpc.billing.getStatus.useQuery();
	const checkout = trpc.billing.createCheckoutSession.useMutation({
		onSuccess: ({ url }) => window.location.assign(url),
	});
	const portal = trpc.billing.createPortalSession.useMutation({
		onSuccess: ({ url }) => window.location.assign(url),
	});

	const subscription = billing?.subscription;
	const canUsePortal = Boolean(
		subscription?.stripeSubscriptionId &&
			portalStatuses.has(subscription.status),
	);
	const actionError = checkout.error ?? portal.error;

	if (isLoading) {
		return (
			<div className="flex justify-center py-12">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	return (
		<div className="space-y-6 animate-in fade-in-50 duration-200">
			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
				<div className="flex items-center gap-3">
					<div className="rounded-xl bg-primary/10 p-2 text-primary">
						<CreditCard className="h-5 w-5" />
					</div>
					<div>
						<h2 className="text-lg font-semibold text-foreground">
							Abrechnung
						</h2>
						<p className="text-sm text-muted-foreground">
							Abos und Zahlungsmethoden für deinen Workspace verwalten.
						</p>
					</div>
				</div>
			</div>

			{searchParams.get("checkout") === "success" && (
				<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-foreground">
					<div className="flex gap-2">
						<BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
						<span>
							Checkout abgeschlossen. Der Workspace wird aktiviert, sobald die
							Zahlung von Stripe per Webhook bestätigt wurde.
						</span>
					</div>
				</div>
			)}

			{searchParams.get("checkout") === "canceled" && (
				<div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
					Checkout abgebrochen – es wurde nichts belastet.
				</div>
			)}

			{!billing?.canManageWorkspace ? (
				<div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
					Nur Workspace-Admins können die Abrechnung verwalten.
				</div>
			) : !billing.configured ? (
				<div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 shadow-sm">
					<div className="flex gap-3">
						<ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
						<div>
							<h3 className="font-semibold text-foreground">
								Abrechnung wird eingerichtet
							</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								Hinterlege den Stripe-Secret-Key, das Webhook-Secret sowie die
								monatliche und jährliche Price-ID in der Server-Umgebung.
							</p>
						</div>
					</div>
				</div>
			) : (
				<>
					<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									{billing.workspaceName}
								</p>
								<h3 className="mt-1 text-xl font-semibold text-foreground">
									{statusLabels[subscription?.status ?? "inactive"] ??
										subscription?.status ??
										"Noch kein Abo"}
								</h3>
								{subscription?.cancelAtPeriodEnd &&
									subscription.currentPeriodEnd && (
										<p className="mt-1 text-sm text-muted-foreground">
											Läuft bis{" "}
											{new Date(
												subscription.currentPeriodEnd,
											).toLocaleDateString("de-CH")}
											.
										</p>
									)}
							</div>
							{canUsePortal && (
								<Button
									variant="outline"
									disabled={portal.isPending}
									onClick={() => portal.mutate()}
								>
									{portal.isPending ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<ExternalLink className="mr-2 h-4 w-4" />
									)}
									Abo verwalten
								</Button>
							)}
						</div>
					</div>

					{!canUsePortal && (
						<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
							<h3 className="text-base font-semibold text-foreground">
								Skedra Cloud starten
							</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								Wähle einen Abrechnungszeitraum. Steuern werden in Stripe
								Checkout berechnet.
							</p>
							<div className="mt-4 flex flex-wrap gap-3">
								<Button
									disabled={checkout.isPending}
									onClick={() => checkout.mutate({ plan: "pro_monthly" })}
								>
									{checkout.isPending && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									Monatliches Abo
								</Button>
								<Button
									variant="outline"
									disabled={checkout.isPending}
									onClick={() => checkout.mutate({ plan: "pro_yearly" })}
								>
									Jährliches Abo
								</Button>
							</div>
						</div>
					)}

					{actionError && (
						<p className="text-sm text-destructive">{actionError.message}</p>
					)}
				</>
			)}
		</div>
	);
}
