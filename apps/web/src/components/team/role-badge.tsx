import { cn } from "@/lib/utils";

interface RoleBadgeProps {
	name: string;
	color: string;
	className?: string;
}

/** Kleines Rollen-Label mit Farbpunkt (Mitgliederliste, @-Vorschläge). */
export function RoleBadge({ name, color, className }: RoleBadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-foreground",
				className,
			)}
		>
			<span
				className="h-2 w-2 shrink-0 rounded-full"
				style={{ backgroundColor: color }}
				aria-hidden
			/>
			{name}
		</span>
	);
}

/** Farbring um Avatare (Erwähnungen, Marker). */
function RoleColorRing({
	color,
	children,
	className,
}: {
	color: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<span
			className={cn("inline-flex rounded-full p-0.5", className)}
			style={{ boxShadow: `0 0 0 2px ${color}` }}
		>
			{children}
		</span>
	);
}
