/**
 * Workspace-Team mit zentralen Rollen. Diese Rollen tragen die Canvas-Rechte
 * und werden pro Board freigeschaltet.
 */

import { RoleBadge } from "@/components/team/role-badge";
import {
	RolePermissionsEditor,
	RolePermissionsSummary,
} from "@/components/team/role-permissions-editor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NEW_ROLE_PERMISSIONS_DEFAULT } from "@/lib/default-role-permissions";
import { useI18n } from "@/lib/i18n";
import { PRESET_TEAM_ROLE_COLORS } from "@/lib/team-role-colors";
import { trpc } from "@/lib/trpc";
import { getUserInitials } from "@/lib/user-initials";
import { cn } from "@/lib/utils";
import type { TeamRolePermissions } from "@skedra/shared";
import {
	Check,
	Copy,
	Loader2,
	Mail,
	Pencil,
	Plus,
	Trash2,
	UserMinus,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";

interface TeamRolesSettingsProps {
	sessionUser: {
		id: string;
		name: string;
		email: string;
		image?: string | null;
	};
}

type ListedTeamRole = {
	id: string;
	name: string;
	color: string;
	permissions: TeamRolePermissions;
};

export function TeamRolesSettings({ sessionUser }: TeamRolesSettingsProps) {
	const { t } = useI18n();
	const utils = trpc.useUtils();
	const { data: team, isLoading: teamLoading } = trpc.team.get.useQuery();

	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRoleId, setInviteRoleId] = useState("");
	const [inviteWorkspaceAdmin, setInviteWorkspaceAdmin] = useState(false);
	const [inviteError, setInviteError] = useState("");
	const [inviteLink, setInviteLink] = useState("");
	const [inviteCopied, setInviteCopied] = useState(false);

	const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
	const [roleNameDraft, setRoleNameDraft] = useState("");
	const [roleColorDraft, setRoleColorDraft] = useState<string>(
		PRESET_TEAM_ROLE_COLORS[1],
	);
	const [rolePermissionsDraft, setRolePermissionsDraft] =
		useState<TeamRolePermissions>(NEW_ROLE_PERMISSIONS_DEFAULT);
	const [roleError, setRoleError] = useState("");

	const members = team?.members ?? [];
	const roles = (team?.roles ?? []) as ListedTeamRole[];
	const owner = team?.owner ?? sessionUser;
	const ownerIsCurrentUser = owner.id === sessionUser.id;
	const canManageWorkspaceAdmins =
		team?.canManageWorkspaceAdmins ?? ownerIsCurrentUser;
	const selectedInviteRole = roles.find((role) => role.id === inviteRoleId);
	const isEditingRole = editingRoleId !== null;

	useEffect(() => {
		if (!roles.length) {
			setInviteRoleId("");
			return;
		}
		if (!inviteRoleId || !roles.some((role) => role.id === inviteRoleId)) {
			setInviteRoleId(roles[0].id);
		}
	}, [inviteRoleId, roles]);

	const invalidateTeam = () => void utils.team.get.invalidate();

	const resetRoleForm = () => {
		setEditingRoleId(null);
		setRoleNameDraft("");
		setRoleColorDraft(PRESET_TEAM_ROLE_COLORS[1]);
		setRolePermissionsDraft(NEW_ROLE_PERMISSIONS_DEFAULT);
		setRoleError("");
	};

	const startEditRole = (role: ListedTeamRole) => {
		setEditingRoleId(role.id);
		setRoleNameDraft(role.name);
		setRoleColorDraft(role.color);
		setRolePermissionsDraft({ ...role.permissions });
		setRoleError("");
	};

	const createRole = trpc.team.createRole.useMutation({
		onSuccess: () => {
			resetRoleForm();
			invalidateTeam();
		},
		onError: (error) => setRoleError(error.message),
	});

	const updateRole = trpc.team.updateRole.useMutation({
		onSuccess: () => {
			resetRoleForm();
			invalidateTeam();
			void utils.whiteboard.list.invalidate();
		},
		onError: (error) => setRoleError(error.message),
	});

	const deleteRole = trpc.team.deleteRole.useMutation({
		onSuccess: (_result, variables) => {
			if (editingRoleId === variables.roleId) resetRoleForm();
			invalidateTeam();
			void utils.whiteboard.list.invalidate();
		},
		onError: (error) => setRoleError(error.message),
	});

	const inviteMember = trpc.team.inviteMember.useMutation({
		onSuccess: (result) => {
			setInviteEmail("");
			setInviteWorkspaceAdmin(false);
			setInviteError("");
			setInviteLink("inviteUrl" in result ? result.inviteUrl : "");
			invalidateTeam();
		},
		onError: (error) => setInviteError(error.message),
	});

	const updateMemberRole = trpc.team.updateMemberRole.useMutation({
		onSuccess: () => {
			invalidateTeam();
			void utils.whiteboard.list.invalidate();
		},
	});

	const removeMember = trpc.team.removeMember.useMutation({
		onSuccess: () => invalidateTeam(),
	});

	const saveRole = () => {
		const name = roleNameDraft.trim();
		if (!name) return;
		if (isEditingRole && editingRoleId) {
			updateRole.mutate({
				roleId: editingRoleId,
				name,
				color: roleColorDraft,
				permissions: rolePermissionsDraft,
			});
			return;
		}
		createRole.mutate({
			name,
			color: roleColorDraft,
			permissions: rolePermissionsDraft,
		});
	};

	const sendInvite = () => {
		const email = inviteEmail.trim();
		if (!email || !inviteRoleId) return;
		inviteMember.mutate({
			email,
			roleId: inviteRoleId,
			workspaceRole:
				inviteWorkspaceAdmin && canManageWorkspaceAdmins ? "admin" : "member",
		});
	};

	const roleSaving = createRole.isPending || updateRole.isPending;

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
				{t("workspaceSettings.teamTabIntro")}
			</p>

			<div
				className="rounded-2xl border border-border bg-card p-6 shadow-sm"
				id="workspace-roles"
			>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h3 className="text-base font-semibold text-foreground">
							{t("workspaceSettings.rolesSectionTitle")}
						</h3>
						<p className="mt-1 text-sm text-muted-foreground">
							{t("workspaceSettings.rolesCardHint")}
						</p>
					</div>
				</div>

				{roles.length > 0 ? (
					<ul className="mt-4 grid gap-3">
						{roles.map((role) => (
							<li
								key={role.id}
								className={cn(
									"rounded-xl border p-4",
									editingRoleId === role.id
										? "border-primary/50 bg-primary/5"
										: "border-border/70 bg-background/40",
								)}
							>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="min-w-0 space-y-2">
										<RoleBadge name={role.name} color={role.color} />
										<RolePermissionsSummary permissions={role.permissions} />
									</div>
									<div className="flex shrink-0 items-center gap-1">
										<Button
											type="button"
											variant="ghost"
											size="icon"
											disabled={roleSaving}
											aria-label={t("workspaceSettings.editTeamRole")}
											onClick={() => startEditRole(role)}
										>
											<Pencil className="h-4 w-4" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="text-muted-foreground hover:text-destructive"
											disabled={deleteRole.isPending}
											aria-label={t("workspaceSettings.deleteTeamRole")}
											onClick={() => deleteRole.mutate({ roleId: role.id })}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</li>
						))}
					</ul>
				) : (
					<p className="mt-4 text-sm text-muted-foreground">
						{t("workspaceSettings.teamRolesEmpty")}
					</p>
				)}

				<div className="mt-4 space-y-4 rounded-xl border border-border/70 bg-muted/10 p-4">
					<p className="text-sm font-medium text-foreground">
						{isEditingRole
							? t("workspaceSettings.editTeamRoleTitle")
							: t("workspaceSettings.newTeamRoleTitle")}
					</p>
					<div className="grid gap-4">
						<div className="space-y-1.5">
							<label
								htmlFor="team-role-name"
								className="text-xs font-medium text-muted-foreground"
							>
								{t("workspaceSettings.teamRoleNameLabel")}
							</label>
							<Input
								id="team-role-name"
								placeholder={t("workspaceSettings.teamRoleNamePlaceholder")}
								value={roleNameDraft}
								onChange={(event) => {
									setRoleNameDraft(event.target.value);
									setRoleError("");
								}}
							/>
						</div>
						<div className="space-y-1.5">
							<span className="text-xs font-medium text-muted-foreground">
								{t("workspaceSettings.teamRoleColorLabel")}
							</span>
							<div className="flex flex-wrap gap-1.5">
								{PRESET_TEAM_ROLE_COLORS.map((color) => (
									<button
										key={color}
										type="button"
										className={cn(
											"h-8 w-8 rounded-lg border-2 transition-transform hover:scale-105",
											roleColorDraft === color
												? "border-foreground ring-2 ring-primary/30"
												: "border-transparent",
										)}
										style={{ backgroundColor: color }}
										onClick={() => {
											setRoleColorDraft(color);
											setRoleError("");
										}}
										aria-label={color}
									/>
								))}
							</div>
						</div>
						<RolePermissionsEditor
							value={rolePermissionsDraft}
							onChange={setRolePermissionsDraft}
							className="sm:grid-cols-2 lg:grid-cols-3"
						/>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							disabled={!roleNameDraft.trim() || roleSaving}
							onClick={saveRole}
						>
							{roleSaving ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : isEditingRole ? null : (
								<Plus className="mr-2 h-4 w-4" />
							)}
							{isEditingRole
								? t("workspaceSettings.saveTeamRole")
								: t("workspaceSettings.createTeamRole")}
						</Button>
						{isEditingRole ? (
							<Button
								type="button"
								variant="outline"
								disabled={roleSaving}
								onClick={resetRoleForm}
							>
								<X className="mr-2 h-4 w-4" />
								{t("workspaceSettings.cancelEditTeamRole")}
							</Button>
						) : null}
					</div>
					{roleError ? (
						<p className="text-xs text-destructive">{roleError}</p>
					) : null}
				</div>
			</div>

			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
				<h3 className="text-base font-semibold text-foreground">
					{t("workspaceSettings.teamInviteTitle")}
				</h3>
				<p className="mt-0.5 text-sm text-muted-foreground">
					{t("workspaceSettings.teamInviteHint")}
				</p>
				<div className="mt-4 grid gap-3 lg:grid-cols-[1fr_13rem_auto_auto] lg:items-end">
					<div className="relative min-w-0">
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
								if (event.key === "Enter") sendInvite();
							}}
						/>
					</div>
					<div className="space-y-1.5">
						<label
							className="text-xs font-medium text-muted-foreground"
							htmlFor="workspace-invite-team-role"
						>
							{t("workspaceSettings.teamRoleLabel")}
						</label>
						<select
							id="workspace-invite-team-role"
							className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
							value={inviteRoleId}
							onChange={(event) => setInviteRoleId(event.target.value)}
						>
							{roles.map((role) => (
								<option key={role.id} value={role.id}>
									{role.name}
								</option>
							))}
						</select>
					</div>
					{canManageWorkspaceAdmins ? (
						<label className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
							<input
								type="checkbox"
								checked={inviteWorkspaceAdmin}
								onChange={(event) =>
									setInviteWorkspaceAdmin(event.target.checked)
								}
							/>
							{t("workspaceSettings.workspaceAdminToggle")}
						</label>
					) : null}
					<Button
						disabled={
							!inviteEmail.trim() ||
							!selectedInviteRole ||
							inviteMember.isPending
						}
						onClick={sendInvite}
					>
						{inviteMember.isPending ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Plus className="mr-2 h-4 w-4" />
						)}
						{t("workspaceSettings.teamInviteAction")}
					</Button>
				</div>
				{selectedInviteRole ? (
					<div className="mt-3 rounded-xl border border-border/70 bg-muted/15 p-3">
						<RoleBadge
							name={selectedInviteRole.name}
							color={selectedInviteRole.color}
						/>
						<div className="mt-2">
							<RolePermissionsSummary
								permissions={selectedInviteRole.permissions}
							/>
						</div>
					</div>
				) : null}
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
								<div className="flex shrink-0 flex-wrap items-center gap-2">
									<select
										className="h-9 min-w-[10rem] rounded-md border border-border bg-background px-2 text-sm"
										value={member.roleId ?? ""}
										disabled={
											updateMemberRole.isPending ||
											member.user.id === sessionUser.id ||
											roles.length === 0
										}
										onChange={(event) =>
											updateMemberRole.mutate({
												userId: member.user.id,
												roleId: event.target.value,
											})
										}
									>
										<option value="" disabled>
											{t("workspaceSettings.teamRoleLabel")}
										</option>
										{roles.map((role) => (
											<option key={role.id} value={role.id}>
												{role.name}
											</option>
										))}
									</select>
									<label className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
										<input
											type="checkbox"
											checked={member.workspaceRole === "admin"}
											disabled={
												updateMemberRole.isPending ||
												member.user.id === sessionUser.id ||
												!canManageWorkspaceAdmins
											}
											onChange={(event) =>
												updateMemberRole.mutate({
													userId: member.user.id,
													workspaceRole: event.target.checked
														? "admin"
														: "member",
												})
											}
										/>
										{t("workspaceSettings.workspaceAdminToggle")}
									</label>
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
