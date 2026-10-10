import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import type { SkedraApiKeyScope } from "@skedra/shared/api-keys";
import { Loader2, PlugZap, Unplug } from "lucide-react";
import { useState } from "react";

/** OAuth grants of MCP clients (Claude, Cursor, …) that the user can revoke. */
export function McpConnectionsSettings({
	scopeLabels,
}: {
	scopeLabels: Record<SkedraApiKeyScope, string>;
}) {
	const { t } = useI18n();
	const utils = trpc.useUtils();
	const { data: connections, isLoading } = trpc.mcpConnection.list.useQuery();
	const [confirmingClientId, setConfirmingClientId] = useState<string | null>(
		null,
	);
	const revoke = trpc.mcpConnection.revoke.useMutation({
		onSettled: () => {
			setConfirmingClientId(null);
			void utils.mcpConnection.list.invalidate();
		},
	});

	return (
		<div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
			<div className="flex items-start gap-3">
				<div className="p-2 bg-primary/10 rounded-xl text-primary mt-0.5">
					<PlugZap className="h-5 w-5" />
				</div>
				<div>
					<h3 className="text-base font-semibold text-foreground">
						{t("settings.mcpConnections.title")}
					</h3>
					<p className="text-sm text-muted-foreground mt-0.5">
						{t("settings.mcpConnections.description")}
					</p>
				</div>
			</div>

			{isLoading ? (
				<div className="flex justify-center py-8">
					<Loader2 className="h-6 w-6 animate-spin text-primary" />
				</div>
			) : connections && connections.length > 0 ? (
				<div className="overflow-hidden rounded-xl border border-border/70 bg-background/50 divide-y divide-border/60">
					{connections.map((connection) => (
						<div
							key={connection.clientId}
							className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
						>
							<div className="min-w-0 space-y-1">
								<p className="font-semibold text-sm text-foreground truncate">
									{connection.clientName}
								</p>
								<div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
									<span className="font-mono break-all">
										{t("settings.mcpConnections.redirectsTo", {
											hosts: connection.redirectHosts.join(", "),
										})}
									</span>
									<span className="text-border/80">•</span>
									<span>
										{t("settings.mcpConnections.connectedAt", {
											date: connection.connectedAt
												? new Date(connection.connectedAt).toLocaleDateString()
												: "",
										})}
									</span>
									<span className="text-border/80">•</span>
									<span>
										{connection.lastUsedAt
											? t("settings.mcpConnections.lastUsed", {
													date: new Date(
														connection.lastUsedAt,
													).toLocaleDateString(),
												})
											: t("settings.mcpConnections.neverUsed")}
									</span>
								</div>
								<p className="text-[11px] text-muted-foreground">
									{connection.scopes
										.map((scope) => scopeLabels[scope])
										.join(" · ")}
								</p>
							</div>
							{confirmingClientId === connection.clientId ? (
								<div className="flex shrink-0 gap-2">
									<Button
										variant="ghost"
										size="sm"
										disabled={revoke.isPending}
										onClick={() => setConfirmingClientId(null)}
									>
										{t("common.cancel")}
									</Button>
									<Button
										variant="destructive"
										size="sm"
										disabled={revoke.isPending}
										onClick={() =>
											revoke.mutate({ clientId: connection.clientId })
										}
									>
										{revoke.isPending ? (
											<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
										) : null}
										{t("settings.mcpConnections.confirmDisconnect")}
									</Button>
								</div>
							) : (
								<Button
									variant="outline"
									size="sm"
									className="shrink-0"
									onClick={() => {
										revoke.reset();
										setConfirmingClientId(connection.clientId);
									}}
								>
									<Unplug className="mr-1.5 h-3.5 w-3.5" />
									{t("settings.mcpConnections.disconnect")}
								</Button>
							)}
						</div>
					))}
				</div>
			) : (
				<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-8 text-center bg-background/30">
					<PlugZap className="h-8 w-8 text-muted-foreground/60 mb-2" />
					<p className="text-sm text-muted-foreground">
						{t("settings.mcpConnections.empty")}
					</p>
				</div>
			)}

			{revoke.isError ? (
				<p className="text-sm text-destructive">
					{t("settings.mcpConnections.disconnectFailed")}
				</p>
			) : null}
		</div>
	);
}
