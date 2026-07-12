/**
 * Häkchen für Workspace-Rollen-Rechte (Board-Einladungen).
 */

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
	TEAM_ROLE_PERMISSION_KEYS,
	type TeamRolePermissions,
} from "@skedra/shared";

interface RolePermissionsEditorProps {
	value: TeamRolePermissions;
	onChange: (next: TeamRolePermissions) => void;
	className?: string;
}

export function RolePermissionsEditor({
	value,
	onChange,
	className,
}: RolePermissionsEditorProps) {
	const { t } = useI18n();

	return (
		<div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-3", className)}>
			{TEAM_ROLE_PERMISSION_KEYS.map((key) => (
				<label
					key={key}
					className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-sm"
				>
					<input
						type="checkbox"
						className="mt-0.5"
						checked={value[key]}
						onChange={(event) =>
							onChange({ ...value, [key]: event.target.checked })
						}
					/>
					<span>
						<span className="font-medium text-foreground">
							{t(`workspaceSettings.rolePermissions.${key}.label`)}
						</span>
						<span className="mt-0.5 block text-xs text-muted-foreground">
							{t(`workspaceSettings.rolePermissions.${key}.hint`)}
						</span>
					</span>
				</label>
			))}
		</div>
	);
}

export function RolePermissionsSummary({
	permissions,
}: { permissions: TeamRolePermissions }) {
	const { t } = useI18n();
	const active = TEAM_ROLE_PERMISSION_KEYS.filter((key) => permissions[key]);

	if (active.length === 0) {
		return (
			<p className="text-xs text-muted-foreground">
				{t("workspaceSettings.rolePermissions.none")}
			</p>
		);
	}

	return (
		<ul className="flex flex-wrap gap-1.5">
			{active.map((key) => (
				<li
					key={key}
					className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
				>
					{t(`workspaceSettings.rolePermissions.${key}.short`)}
				</li>
			))}
		</ul>
	);
}
