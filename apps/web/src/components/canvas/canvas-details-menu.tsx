import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ellipsis } from "lucide-react";
import type { ReactNode } from "react";

/** Secondary canvas information stays available without covering the board. */
export function CanvasDetailsMenu({
	label,
	children,
	className,
	iconOnly = true,
	side = "bottom",
}: {
	label: string;
	children: ReactNode;
	className?: string;
	iconOnly?: boolean;
	side?: "top" | "bottom";
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					className={className}
					size={iconOnly ? "icon" : "default"}
					aria-label={label}
				>
					{!iconOnly && <span>{label}</span>}
					<Ellipsis className="h-4 w-4 shrink-0" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				side={side}
				className="z-[70] max-h-[min(70dvh,480px)] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl p-3"
			>
				<div className="flex min-w-0 flex-col gap-3">{children}</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
