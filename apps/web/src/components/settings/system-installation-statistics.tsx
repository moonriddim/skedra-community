import { InstallationStatisticsForm } from "@/components/settings/installation-statistics-form";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

function useInstallationStatistics() {
	const utils = trpc.useUtils();
	const status = trpc.instance.getInstallationStatistics.useQuery(undefined, {
		retry: false,
	});
	const { data: session } = authClient.useSession();
	const save = trpc.instance.setInstallationStatistics.useMutation({
		onSuccess: (result) => {
			utils.instance.getInstallationStatistics.setData(undefined, result);
		},
	});
	const current =
		status.data?.viewerId === session?.user.id ? status.data : undefined;
	return { status, save, current };
}

/** Appears once per installation, after the instance administrator signs in. */
export function InstallationStatisticsSetup({
	children,
}: { children: ReactNode }) {
	const { status, save, current } = useInstallationStatistics();
	if (status.isPending)
		return (
			<div className="flex h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	// A statistics service failure must never make the whiteboard unusable.
	if (!current?.available || !current.isAdmin || current.choice !== null)
		return children;
	return (
		<div className="flex min-h-dvh items-center justify-center bg-background p-4 text-foreground sm:p-8">
			<section className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
				<InstallationStatisticsForm
					initialChoice={null}
					setup
					pending={save.isPending}
					error={save.isError}
					onSave={(enabled) => save.mutate({ enabled, initialSetup: true })}
				/>
			</section>
		</div>
	);
}

export function SystemInstallationStatistics() {
	const { t } = useI18n();
	const { status, save, current } = useInstallationStatistics();
	if (status.isPending)
		return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
	if (status.isError)
		return (
			<div role="alert" className="rounded-2xl border border-border p-6">
				<p>{t("installationStatistics.loadError")}</p>
				<Button variant="outline" onClick={() => void status.refetch()}>
					{t("installationStatistics.retry")}
				</Button>
			</div>
		);
	if (!current?.available || !current.isAdmin) return null;
	return (
		<section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
			<InstallationStatisticsForm
				key={String(current.choice)}
				initialChoice={current.choice}
				pending={save.isPending}
				error={save.isError}
				saved={save.isSuccess}
				onSave={(enabled) => save.mutate({ enabled, initialSetup: false })}
			/>
		</section>
	);
}
