/**
 * Mitglieder dieses Boards inkl. Rolle und Rechte (Freigabe-Dialog).
 */

import { RoleBadge } from "@/components/team/role-badge";
import { RolePermissionsSummary } from "@/components/team/role-permissions-editor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import type { TeamRolePermissions } from "@skedra/shared";
import { Loader2, Trash2 } from "lucide-react";

type BoardMember = {
	id: string;
	membershipId: string | null;
	name: string;
	image: string | null;
	isOwner: boolean;
	accessLevel: "owner" | "edit" | "view";
	roleId: string | null;
	roleName: string | null;
	roleColor: string | null;
	permissions: TeamRolePermissions;
};

type InviteRole = {
	id: string;
	name: string;
	color: string;
	permissions: TeamRolePermissions;
};

interface BoardShareMembersListProps {
	boardId: string;
	canManage: boolean;
	inviteRoles?: InviteRole[];
}

function memberInitials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function BoardShareMembersList({
	boardId,
	canManage,
	inviteRoles,
}: BoardShareMembersListProps) {
	const { t } = useI18n();
	const utils = trpc.useUtils();

	const { data, isLoading } = trpc.whiteboard.listMembers.useQuery(
		{ id: boardId },
		{ enabled: !!boardId },
	);

	const invalidate = () => {
		void utils.whiteboard.listMembers.invalidate({ id: boardId });
		void utils.whiteboard.getById.invalidate({ id: boardId });
	};

	const updateRole = trpc.whiteboard.updateMemberRole.useMutation({
		onSuccess: invalidate,
	});

	const removeMember = trpc.whiteboard.removeMember.useMutation({
		onSuccess: invalidate,
	});

	const members = (data?.members ?? []).filter(
		(member: BoardMember) => member.isOwner || member.membershipId,
	);

	return (
		<div className="space-y-3">
			<div>
				<p className="text-sm font-medium">
					{t("whiteboardPage.share.membersTitle")}
				</p>
				<p className="text-xs text-muted-foreground">
					{t("whiteboardPage.share.membersHint")}
				</p>
			</div>

			{isLoading ? (
				<div className="flex justify-center py-6">
					<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
				</div>
			) : members.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{t("whiteboardPage.share.membersEmpty")}
				</p>
			) : (
				<ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
					{members.map((member: BoardMember) => (
						<li
							key={member.id}
							className="rounded-lg border border-border/70 bg-muted/15 p-3"
						>
							<div className="flex items-start gap-3">
								<Avatar className="h-9 w-9 shrink-0">
									{member.image ? (
										<AvatarImage src={member.image} alt={member.name} />
									) : null}
									<AvatarFallback className="text-xs font-semibold">
										{memberInitials(member.name)}
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0 flex-1 space-y-2">
									<div className="flex flex-wrap items-center gap-2">
										<span className="truncate text-sm font-medium">
											{member.name}
										</span>
										{member.isOwner ? (
											<span className="text-xs text-muted-foreground">
												{t("whiteboardPage.share.memberOwner")}
											</span>
										) : null}
									</div>

									{member.isOwner ? (
										<RolePermissionsSummary permissions={member.permissions} />
									) : member.roleName && member.roleColor ? (
										<>
											{canManage &&
											member.membershipId &&
											inviteRoles &&
											inviteRoles.length > 0 ? (
												<select
													className="w-full max-w-xs rounded-md border border-border bg-background px-2 py-1.5 text-sm"
													value={member.roleId ?? ""}
													disabled={updateRole.isPending}
													onChange={(event) => {
														const roleId = event.target.value;
														if (!roleId) return;
														updateRole.mutate({
															id: boardId,
															userId: member.id,
															roleId,
														});
													}}
												>
													{!member.roleId ? (
														<option value="" disabled>
															{t("whiteboardPage.share.selectTeamRole")}
														</option>
													) : null}
													{inviteRoles.map((role) => (
														<option key={role.id} value={role.id}>
															{role.name}
														</option>
													))}
												</select>
											) : (
												<RoleBadge
													name={member.roleName}
													color={member.roleColor}
												/>
											)}
											<RolePermissionsSummary
												permissions={member.permissions}
											/>
										</>
									) : (
										<p className="text-xs text-muted-foreground">
											{t("whiteboardPage.share.missingTeamRole")}
										</p>
									)}
								</div>

								{canManage && !member.isOwner && member.membershipId ? (
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="shrink-0 text-muted-foreground hover:text-destructive"
										disabled={removeMember.isPending}
										aria-label={t("whiteboardPage.share.removeMember")}
										onClick={() =>
											removeMember.mutate({ id: boardId, userId: member.id })
										}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								) : null}
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
