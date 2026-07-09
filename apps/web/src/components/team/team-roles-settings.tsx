/**
 * Workspace-Team (ohne Board-Rechte — die liegen pro Canvas im Teilen-Dialog).
 */

import { RoleBadge } from "@/components/team/role-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { getUserInitials } from "@/lib/user-initials";
import { Check, Copy, Loader2, Mail, Plus, UserMinus } from "lucide-react";
import { useState } from "react";

interface TeamRolesSettingsProps {
	sessionUser: {
		id: string;
		name: string;
		email: string;
		image?: string | null;
	};
}

export function TeamRolesSettings({ sessionUser }: TeamRolesSettingsProps) {
	const { t } = useI18n();
	const utils = trpc.useUtils();
	const { data: team, isLoading: teamLoading } = trpc.team.get.useQuery();

	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteWorkspaceRole, setInviteWorkspaceRole] = useState<
		"member" | "admin"
	>("member");
	const [inviteError, setInviteError] = useState("");
	const [inviteLink, setInviteLink] = useState("");
	const [inviteCopied, setInviteCopied] = useState(false);

	const members = team?.members ?? [];
	const owner = team?.owner ?? sessionUser;
	const ownerIsCurrentUser = owner.id === sessionUser.id;

	const invalidateTeam = () => void utils.team.get.invalidate();

	const inviteMember = trpc.team.inviteMember.useMutation({
		onSuccess: (result) => {
			setInviteEmail("");
			setInviteError("");
			setInviteLink("inviteUrl" in result ? result.inviteUrl : "");
			invalidateTeam();
		},
		onError: (error) => setInviteError(error.message),
	});

	const updateMemberRole = trpc.team.updateMemberRole.useMutation({
		onSuccess: () => invalidateTeam(),
	});

	const removeMember = trpc.team.removeMember.useMutation({
		onSuccess: () => invalidateTeam(),
	});

	if (teamLoading) {
		return (
			<div className="flex justify-center py-12">
				<Loader2 className="h-6 w-6 animate-spin text-primary" />
			</div>
		);
	}

	if (team && !team.canManageWorkspace) {
		return (
			<p className="text-sm text-muted-foreground">
				{t("workspaceSettings.workspaceInviteHint")}
			</p>
		);
	}

	return (
		<div className="space-y-6">
			<p className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
				{t("workspaceSettings.workspaceInviteHint")}
			</p>

			<div
				className="rounded-2xl border border-border bg-card p-6 shadow-sm"
				id="workspace-roles"
			>
				<h3 className="text-base font-semibold text-foreground">
					{t("workspaceSettings.boardRolesInfoTitle")}
				</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					{t("workspaceSettings.boardRolesInfoBody")}
				</p>
			</div>

			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
				<h3 className="text-base font-semibold text-foreground">
					{t("workspaceSettings.teamInviteTitle")}
				</h3>
				<p className="mt-0.5 text-sm text-muted-foreground">
					{t("workspaceSettings.teamInviteHint")}
				</p>
				<div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
					<div className="relative min-w-0 flex-1">
						<Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							type="email"
							className="w-full pl-9"
							placeholder="email@beispiel.de"
							value={inviteEmail}
							onChange={(event) => {
								setInviteEmail(event.target.value);
								setInviteError("");
								setInviteLink("");
							}}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									const email = inviteEmail.trim();
									if (!email) return;
									inviteMember.mutate({
										email,
										workspaceRole: inviteWorkspaceRole,
									});
								}
							}}
						/>
					</div>
					<div className="space-y-1.5 lg:w-52">
						<label
							className="text-xs font-medium text-muted-foreground"
							htmlFor="workspace-invite-role"
						>
							{t("workspaceSettings.workspaceRoleLabel")}
						</label>
						<select
							id="workspace-invite-role"
							className="flex h-10 w-full min-w-[12rem] rounded-md border border-border bg-background px-3 text-sm"
							value={inviteWorkspaceRole}
							onChange={(event) =>
								setInviteWorkspaceRole(event.target.value as "member" | "admin")
							}
						>
							<option value="member">
								{t("workspaceSettings.workspaceRoleMember")}
							</option>
							<option value="admin">
								{t("workspaceSettings.workspaceRoleAdmin")}
							</option>
						</select>
					</div>
					<Button
						className="lg:w-auto"
						disabled={!inviteEmail.trim() || inviteMember.isPending}
						onClick={() => {
							const email = inviteEmail.trim();
							if (!email) return;
							inviteMember.mutate({
								email,
								workspaceRole: inviteWorkspaceRole,
							});
						}}
					>
						{inviteMember.isPending ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Plus className="mr-2 h-4 w-4" />
						)}
						{t("workspaceSettings.teamInviteAction")}
					</Button>
				</div>
				{inviteError ? (
					<p className="mt-2 text-xs text-destructive">{inviteError}</p>
				) : null}
				{inviteLink ? (
					<div className="mt-3 flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/20 p-3 sm:flex-row">
						<Input readOnly value={inviteLink} className="text-xs" />
						<Button
							variant="outline"
							type="button"
							onClick={async () => {
								await navigator.clipboard.writeText(inviteLink);
								setInviteCopied(true);
								setTimeout(() => setInviteCopied(false), 2000);
							}}
						>
							{inviteCopied ? (
								<Check className="mr-2 h-4 w-4" />
							) : (
								<Copy className="mr-2 h-4 w-4" />
							)}
							{inviteCopied ? t("common.copied") : t("common.copy")}
						</Button>
					</div>
				) : null}
			</div>

			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
				<h3 className="mb-4 text-base font-semibold text-foreground">
					{t("workspaceSettings.teamMembersListTitle")}
				</h3>
				<div className="overflow-hidden rounded-xl border border-border/70 bg-background/50 divide-y divide-border/60">
					<div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 bg-muted/20">
						<div className="flex min-w-0 items-center gap-3">
							<Avatar className="h-8 w-8 ring-2 ring-[#14b8a6]">
								{owner.image ? (
									<AvatarImage src={owner.image} alt={owner.name} />
								) : null}
								<AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
									{getUserInitials(owner.name)}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0">
								<p className="truncate text-sm font-semibold text-foreground">
									{owner.name}
									{ownerIsCurrentUser ? " (Du)" : ""}
								</p>
								<p className="text-xs text-muted-foreground">{owner.email}</p>
							</div>
						</div>
						<RoleBadge name="Besitzer" color="#14b8a6" />
					</div>

					{members.length > 0 ? (
						members.map((member) => (
							<div
								key={member.user.id}
								className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/10"
							>
								<div className="flex min-w-0 items-center gap-3">
									<Avatar className="h-8 w-8">
										{member.user.image ? (
											<AvatarImage
												src={member.user.image}
												alt={member.user.name ?? ""}
											/>
										) : null}
										<AvatarFallback className="bg-muted-foreground text-xs font-bold text-white">
											{getUserInitials(member.user.name ?? "")}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0">
										<p className="truncate text-sm font-semibold text-foreground">
											{member.user.name}
											{member.user.id === sessionUser.id ? " (Du)" : ""}
										</p>
										<p className="truncate text-xs text-muted-foreground">
											{member.user.email}
										</p>
									</div>
								</div>
								<div className="flex shrink-0 items-center gap-2">
									<select
										className="h-9 min-w-[10rem] rounded-md border border-border bg-background px-2 text-sm"
										value={member.workspaceRole ?? "member"}
										disabled={
											updateMemberRole.isPending ||
											member.user.id === sessionUser.id
										}
										onChange={(event) =>
											updateMemberRole.mutate({
												userId: member.user.id,
												workspaceRole: event.target.value as "member" | "admin",
											})
										}
									>
										<option value="member">
											{t("workspaceSettings.workspaceRoleMember")}
										</option>
										<option value="admin">
											{t("workspaceSettings.workspaceRoleAdmin")}
										</option>
									</select>
									<Button
										variant="ghost"
										size="icon"
										className="text-muted-foreground hover:text-destructive"
										disabled={
											removeMember.isPending ||
											member.user.id === sessionUser.id
										}
										onClick={() =>
											removeMember.mutate({ userId: member.user.id })
										}
									>
										<UserMinus className="h-4 w-4" />
									</Button>
								</div>
							</div>
						))
					) : (
						<div className="px-4 py-6 text-center text-sm text-muted-foreground bg-background/20">
							{t("workspaceSettings.teamMembersEmpty")}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
