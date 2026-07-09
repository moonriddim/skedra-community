/**
 * Rollen & Rechte nur für dieses Board (Canvas) — anlegen, bearbeiten, löschen.
 */

import { RoleBadge } from "@/components/team/role-badge";
import { RolePermissionsEditor } from "@/components/team/role-permissions-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NEW_ROLE_PERMISSIONS_DEFAULT } from "@/lib/default-role-permissions";
import { useI18n } from "@/lib/i18n";
import { PRESET_TEAM_ROLE_COLORS } from "@/lib/team-role-colors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { BoardRolePermissions } from "@skedra/shared";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

type ListedRole = {
	id: string;
	name: string;
	color: string;
	permissions: BoardRolePermissions;
};

interface BoardRolesSettingsProps {
	boardId: string;
	showHeader?: boolean;
}

function RolesPanel({
	children,
	showHeader,
}: {
	children: ReactNode;
	showHeader: boolean;
}) {
	const { t } = useI18n();
	if (!showHeader) {
		return <div className="space-y-3">{children}</div>;
	}
	return (
		<div className="space-y-3 rounded-lg border border-border/80 bg-muted/15 p-4">
			<div>
				<p className="text-sm font-medium">
					{t("whiteboardPage.share.boardRolesTitle")}
				</p>
				<p className="text-xs text-muted-foreground">
					{t("whiteboardPage.share.boardRolesHint")}
				</p>
			</div>
			{children}
		</div>
	);
}

function RoleFormFields({
	roleNameDraft,
	setRoleNameDraft,
	roleColorDraft,
	setRoleColorDraft,
	rolePermissionsDraft,
	setRolePermissionsDraft,
	onClearError,
}: {
	roleNameDraft: string;
	setRoleNameDraft: (value: string) => void;
	roleColorDraft: string;
	setRoleColorDraft: (value: string) => void;
	rolePermissionsDraft: BoardRolePermissions;
	setRolePermissionsDraft: (value: BoardRolePermissions) => void;
	onClearError: () => void;
}) {
	const { t } = useI18n();

	return (
		<div className="grid gap-4">
			<div className="space-y-1.5">
				<label
					htmlFor="board-role-name"
					className="text-xs font-medium text-muted-foreground"
				>
					{t("whiteboardPage.share.roleNameLabel")}
				</label>
				<Input
					id="board-role-name"
					className="w-full min-w-0"
					placeholder={t("whiteboardPage.share.roleNamePlaceholder")}
					value={roleNameDraft}
					onChange={(event) => {
						setRoleNameDraft(event.target.value);
						onClearError();
					}}
				/>
			</div>
			<div className="space-y-1.5">
				<span className="text-xs font-medium text-muted-foreground">
					{t("whiteboardPage.share.roleColorLabel")}
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
								onClearError();
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
	);
}

export function BoardRolesSettings({
	boardId,
	showHeader = true,
}: BoardRolesSettingsProps) {
	const { t } = useI18n();
	const utils = trpc.useUtils();
	const { data: roles, isLoading } = trpc.whiteboard.listInviteRoles.useQuery({
		id: boardId,
	});

	const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
	const [roleNameDraft, setRoleNameDraft] = useState("");
	const [roleColorDraft, setRoleColorDraft] = useState<string>(
		PRESET_TEAM_ROLE_COLORS[1],
	);
	const [rolePermissionsDraft, setRolePermissionsDraft] =
		useState<BoardRolePermissions>(NEW_ROLE_PERMISSIONS_DEFAULT);
	const [roleError, setRoleError] = useState("");

	const isEditing = editingRoleId !== null;

	const invalidate = () => {
		void utils.whiteboard.listInviteRoles.invalidate({ id: boardId });
		void utils.whiteboard.listMembers.invalidate({ id: boardId });
		void utils.whiteboard.getById.invalidate({ id: boardId });
	};

	const resetForm = () => {
		setEditingRoleId(null);
		setRoleNameDraft("");
		setRoleColorDraft(PRESET_TEAM_ROLE_COLORS[1]);
		setRolePermissionsDraft(NEW_ROLE_PERMISSIONS_DEFAULT);
		setRoleError("");
	};

	const startEdit = (role: ListedRole) => {
		setEditingRoleId(role.id);
		setRoleNameDraft(role.name);
		setRoleColorDraft(role.color);
		setRolePermissionsDraft({ ...role.permissions });
		setRoleError("");
	};

	const createRole = trpc.whiteboard.createBoardRole.useMutation({
		onSuccess: () => {
			resetForm();
			invalidate();
		},
		onError: (error) => setRoleError(error.message),
	});

	const updateRole = trpc.whiteboard.updateBoardRole.useMutation({
		onSuccess: () => {
			resetForm();
			invalidate();
		},
		onError: (error) => setRoleError(error.message),
	});

	const deleteRole = trpc.whiteboard.deleteBoardRole.useMutation({
		onSuccess: (_data, variables) => {
			if (variables.roleId === editingRoleId) {
				resetForm();
			}
			invalidate();
		},
	});

	useEffect(() => {
		if (!editingRoleId || !roles?.length) return;
		if (!roles.some((role) => role.id === editingRoleId)) {
			setEditingRoleId(null);
			setRoleNameDraft("");
			setRoleColorDraft(PRESET_TEAM_ROLE_COLORS[1]);
			setRolePermissionsDraft(NEW_ROLE_PERMISSIONS_DEFAULT);
			setRoleError("");
		}
	}, [editingRoleId, roles]);

	const clearError = () => setRoleError("");

	const handleSave = () => {
		const name = roleNameDraft.trim();
		if (!name) return;

		if (isEditing && editingRoleId) {
			updateRole.mutate({
				id: boardId,
				roleId: editingRoleId,
				name,
				color: roleColorDraft,
				permissions: rolePermissionsDraft,
			});
			return;
		}

		createRole.mutate({
			id: boardId,
			name,
			color: roleColorDraft,
			permissions: rolePermissionsDraft,
		});
	};

	const isSaving = createRole.isPending || updateRole.isPending;

	if (isLoading) {
		return (
			<div className="flex justify-center py-4">
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<RolesPanel showHeader={showHeader}>
			{(roles?.length ?? 0) > 0 ? (
				<ul className="flex flex-col gap-2">
					{(roles ?? []).map((role) => (
						<li
							key={role.id}
							className={cn(
								"flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 transition-colors",
								editingRoleId === role.id
									? "border-primary/50 bg-primary/5"
									: "border-border/70 bg-background/40",
							)}
						>
							<RoleBadge name={role.name} color={role.color} />
							<div className="flex shrink-0 items-center gap-1">
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="text-muted-foreground hover:text-foreground"
									disabled={isSaving}
									aria-label={t("whiteboardPage.share.editBoardRole")}
									onClick={() => startEdit(role)}
								>
									<Pencil className="h-4 w-4" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="text-muted-foreground hover:text-destructive"
									disabled={deleteRole.isPending}
									aria-label={t("whiteboardPage.share.deleteBoardRole")}
									onClick={() =>
										deleteRole.mutate({ id: boardId, roleId: role.id })
									}
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						</li>
					))}
				</ul>
			) : (
				<p className="text-sm text-muted-foreground">
					{t("whiteboardPage.share.boardRolesEmpty")}
				</p>
			)}

			<div className="rounded-lg border border-border/70 bg-muted/10 p-4 space-y-4">
				<p className="text-sm font-medium text-foreground">
					{isEditing
						? t("whiteboardPage.share.editBoardRoleTitle")
						: t("whiteboardPage.share.newBoardRoleTitle")}
				</p>
				<RoleFormFields
					roleNameDraft={roleNameDraft}
					setRoleNameDraft={setRoleNameDraft}
					roleColorDraft={roleColorDraft}
					setRoleColorDraft={setRoleColorDraft}
					rolePermissionsDraft={rolePermissionsDraft}
					setRolePermissionsDraft={setRolePermissionsDraft}
					onClearError={clearError}
				/>
				<div className="flex flex-wrap gap-2">
					<Button
						className="flex-1 sm:flex-none"
						disabled={!roleNameDraft.trim() || isSaving}
						onClick={handleSave}
					>
						{isSaving ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : isEditing ? null : (
							<Plus className="mr-2 h-4 w-4" />
						)}
						{isEditing
							? t("whiteboardPage.share.saveBoardRole")
							: t("whiteboardPage.share.createBoardRole")}
					</Button>
					{isEditing ? (
						<Button
							type="button"
							variant="outline"
							disabled={isSaving}
							onClick={resetForm}
						>
							<X className="mr-2 h-4 w-4" />
							{t("whiteboardPage.share.cancelEditBoardRole")}
						</Button>
					) : null}
				</div>
			</div>
			{roleError ? (
				<p className="text-xs text-destructive">{roleError}</p>
			) : null}
		</RolesPanel>
	);
}
