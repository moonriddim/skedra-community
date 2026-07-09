import { useI18n } from "@/lib/i18n";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

export function Section({
	label,
	children,
}: { label: string; children: ReactNode }) {
	return (
		<div>
			<p className="mb-1 font-medium text-[9px] text-muted-foreground uppercase tracking-wider">
				{label}
			</p>
			{children}
		</div>
	);
}

export function ColorGrid({
	colors,
	active,
	onSelect,
}: {
	colors: string[];
	active: string;
	onSelect: (color: string) => void;
}) {
	const { t } = useI18n();

	return (
		<div className="flex flex-wrap gap-1">
			{colors.map((color) => (
				<button
					key={color}
					type="button"
					onClick={() => onSelect(color)}
					className={`h-5 w-5 cursor-pointer rounded border-2 transition-all ${
						active === color
							? "scale-110 border-primary"
							: "border-border hover:border-muted-foreground"
					}`}
					style={{
						background:
							color === "transparent"
								? "repeating-conic-gradient(#666 0% 25%, transparent 0% 50%) 50% / 8px 8px"
								: color,
					}}
					title={color === "transparent" ? t("common.transparent") : color}
				/>
			))}
			<label
				className="relative h-5 w-5 cursor-pointer overflow-hidden rounded border-2 border-border transition-all hover:border-muted-foreground"
				style={{
					background:
						"conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
				}}
			>
				<input
					type="color"
					value={active === "transparent" ? "#000000" : active}
					onChange={(event) => onSelect(event.target.value)}
					className="absolute inset-0 cursor-pointer opacity-0"
				/>
			</label>
		</div>
	);
}

export function ActionButton({
	children,
	title,
	onClick,
	danger,
}: {
	children: ReactNode;
	title: string;
	onClick: () => void;
	danger?: boolean;
}) {
	return (
		<button
			type="button"
			title={title}
			onClick={onClick}
			className={`flex flex-1 cursor-pointer items-center justify-center rounded border border-border py-1.5 transition-all hover:border-muted-foreground ${
				danger
					? "text-destructive hover:bg-destructive/10"
					: "text-card-foreground hover:bg-accent"
			}`}
		>
			{children}
		</button>
	);
}

export function DimensionInput({
	label,
	value,
	onCommit,
}: {
	label: string;
	value: number;
	onCommit: (value: number) => void;
}) {
	const [draft, setDraft] = useState(String(value));

	useEffect(() => {
		setDraft(String(value));
	}, [value]);

	const commit = () => {
		const parsed = Number(draft);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			setDraft(String(value));
			return;
		}
		onCommit(parsed);
	};

	return (
		<label className="flex flex-col gap-1">
			<span className="text-[9px] text-muted-foreground uppercase tracking-wider">
				{label}
			</span>
			<input
				type="number"
				min={1}
				step={1}
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.currentTarget.blur();
					}
				}}
				className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] text-card-foreground outline-none transition-colors focus:border-primary"
			/>
		</label>
	);
}

export function FontDropdown({
	fonts,
	value,
	onChange,
}: {
	fonts: { value: string; label: string }[];
	value: string;
	onChange: (value: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const handler = (event: PointerEvent) => {
			if (ref.current && !ref.current.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("pointerdown", handler, true);
		return () => document.removeEventListener("pointerdown", handler, true);
	}, [open]);

	const current = fonts.find((font) => font.value === value) ?? fonts[0];

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex w-full cursor-pointer items-center justify-between gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-card-foreground transition-all hover:border-muted-foreground"
			>
				<span
					className="truncate text-[11px]"
					style={{ fontFamily: current.value }}
				>
					{current.label}
				</span>
				<ChevronDown
					className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>

			{open && (
				<div
					className="scrollbar-thin absolute top-0 left-[calc(100%+8px)] z-50 max-h-64 w-44 overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-xl"
					onWheel={(event) => event.stopPropagation()}
				>
					{fonts.map((font) => (
						<button
							key={font.value}
							type="button"
							onClick={() => {
								onChange(font.value);
								setOpen(false);
							}}
							className={`w-full cursor-pointer px-3 py-2 text-left text-[12px] transition-colors hover:bg-accent ${
								value === font.value
									? "bg-primary/15 font-medium text-primary"
									: "text-popover-foreground"
							}`}
							style={{ fontFamily: font.value }}
						>
							{font.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
