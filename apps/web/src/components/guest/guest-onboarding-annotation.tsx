import { cn } from "@/lib/utils";

interface GuestOnboardingAnnotationProps {
	label: string;
	/** SVG path fuer den skizzenhaften Pfeil */
	arrowPath: string;
	viewBox: string;
	width: number;
	height: number;
	className?: string;
	/** Label ober- oder unterhalb des Pfeils */
	labelPosition?: "above" | "below";
	markerId: string;
	labelAlign?: "left" | "center" | "right";
}

/** Handgezeichneter Hinweis-Pfeil fuer den leeren Gast-Canvas. */
export function GuestOnboardingAnnotation({
	label,
	arrowPath,
	viewBox,
	width,
	height,
	className,
	labelPosition = "above",
	markerId,
	labelAlign = "center",
}: GuestOnboardingAnnotationProps) {
	const labelClass = cn(
		"font-comic-note max-w-[240px] text-base leading-snug text-foreground/70",
		labelAlign === "left" && "text-left",
		labelAlign === "center" && "text-center",
		labelAlign === "right" && "text-right",
	);

	return (
		<div
			className={cn(
				"pointer-events-none absolute flex flex-col gap-2",
				className,
			)}
		>
			{labelPosition === "above" && <p className={labelClass}>{label}</p>}
			<svg
				width={width}
				height={height}
				viewBox={viewBox}
				className="shrink-0 text-foreground/65"
				aria-hidden
			>
				<title>{label}</title>
				<defs>
					<marker
						id={markerId}
						markerWidth="8"
						markerHeight="8"
						refX="6"
						refY="4"
						orient="auto"
					>
						<path
							d="M1,1 L7,4 L1,7"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
						/>
					</marker>
				</defs>
				{/* Leichte Doppel-Linie fuer handgezeichneten Look */}
				<path
					d={arrowPath}
					fill="none"
					stroke="currentColor"
					strokeWidth="2.2"
					strokeLinecap="round"
					strokeLinejoin="round"
					markerEnd={`url(#${markerId})`}
				/>
			</svg>
			{labelPosition === "below" && <p className={labelClass}>{label}</p>}
		</div>
	);
}

/** Skizzen-Pfeil unten rechts zum Hilfe-Button. */
export function GuestHelpArrowHint({ label }: { label: string }) {
	return (
		<div className="pointer-events-none hidden flex-col items-end gap-1.5 pr-0.5 lg:flex">
			<p className="font-comic-note max-w-[190px] text-right text-base leading-snug text-foreground/70">
				{label}
			</p>
			<svg
				width={72}
				height={52}
				viewBox="0 0 72 52"
				className="text-foreground/65"
				aria-hidden
			>
				<title>{label}</title>
				<defs>
					<marker
						id="guest-footer-arrow"
						markerWidth="8"
						markerHeight="8"
						refX="6"
						refY="4"
						orient="auto"
					>
						<path
							d="M1,1 L7,4 L1,7"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
						/>
					</marker>
				</defs>
				<path
					d="M 6 4 C 18 6, 34 16, 48 28 C 56 36, 62 42, 66 48"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.2"
					strokeLinecap="round"
					markerEnd="url(#guest-footer-arrow)"
				/>
			</svg>
		</div>
	);
}
