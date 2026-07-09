import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/theme";

interface BrandLogoProps {
	className?: string;
	markClassName?: string;
	wordmarkClassName?: string;
	showWordmark?: boolean;
}

export function BrandLogo({
	className,
	markClassName,
	wordmarkClassName,
	showWordmark = true,
}: BrandLogoProps) {
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
	const markSrc =
		resolvedTheme === "dark"
			? "/logo-mark-transparent-dark.png"
			: "/logo-mark-transparent.png";

	return (
		<span
			className={cn("inline-flex shrink-0 items-center gap-2.5", className)}
		>
			<img
				src={markSrc}
				alt={showWordmark ? "" : "Skedra"}
				aria-hidden={showWordmark || undefined}
				decoding="async"
				className={cn("h-10 w-10 object-contain", markClassName)}
			/>
			{showWordmark ? (
				<span
					className={cn(
						"text-xl font-extrabold leading-none tracking-normal text-foreground",
						wordmarkClassName,
					)}
				>
					Skedra
				</span>
			) : null}
		</span>
	);
}
