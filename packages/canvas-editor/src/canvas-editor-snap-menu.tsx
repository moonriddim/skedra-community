import {
	type CanvasObjectSnapMode,
	MAX_CANVAS_SNAP_DIVISION_COUNT,
	MIN_CANVAS_SNAP_DIVISION_COUNT,
} from "@skedra/canvas-core";
import {
	Check,
	CircleDot,
	Crosshair,
	Diamond,
	LocateFixed,
	type LucideIcon,
	Magnet,
	Minus,
	Plus,
	ScanLine,
	Square,
	Target,
	X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CANVAS_EDITOR_OBJECT_SNAP_MODES } from "./snap-controller";

export type CanvasEditorSnapMenuKind = "running" | "override";

export type CanvasEditorSnapModeState = Record<CanvasObjectSnapMode, boolean>;

export interface CanvasEditorSnapMenuProps {
	x: number;
	y: number;
	kind: CanvasEditorSnapMenuKind;
	enabled: boolean;
	modes: CanvasEditorSnapModeState;
	showPoints?: boolean;
	divisionCount?: number;
	hideHeader?: boolean;
	translate?: (key: string, fallback: string) => string;
	onToggleEnabled?: () => void;
	onToggleMode?: (mode: CanvasObjectSnapMode) => void;
	onToggleShowPoints?: () => void;
	onDivisionCountChange?: (count: number) => void;
	onSelectOverride?: (mode: CanvasObjectSnapMode) => void;
	onClose: () => void;
}

const MODE_LABELS: Record<CanvasObjectSnapMode, string> = {
	endpoint: "Endpoint",
	midpoint: "Midpoint",
	division: "Division points",
	center: "Center",
	"geometric-center": "Geometric center",
	quadrant: "Quadrant",
	intersection: "Intersection",
	extension: "Extension",
	insertion: "Insertion",
	nearest: "Nearest",
};

const MODE_ICONS: Record<CanvasObjectSnapMode, LucideIcon> = {
	endpoint: Square,
	midpoint: Minus,
	division: Plus,
	center: CircleDot,
	"geometric-center": Target,
	quadrant: Diamond,
	intersection: Crosshair,
	extension: ScanLine,
	insertion: LocateFixed,
	nearest: Magnet,
};

const DIVISION_COUNT_OPTIONS = Array.from(
	{
		length: MAX_CANVAS_SNAP_DIVISION_COUNT - MIN_CANVAS_SNAP_DIVISION_COUNT + 1,
	},
	(_, index) => MIN_CANVAS_SNAP_DIVISION_COUNT + index,
);

/** Shared object-snap menu for Community and public SDK hosts. */
export function CanvasEditorSnapMenu({
	x,
	y,
	kind,
	enabled,
	modes,
	showPoints = true,
	divisionCount = MIN_CANVAS_SNAP_DIVISION_COUNT,
	hideHeader = false,
	translate,
	onToggleEnabled,
	onToggleMode,
	onToggleShowPoints,
	onDivisionCountChange,
	onSelectOverride,
	onClose,
}: CanvasEditorSnapMenuProps) {
	const t = translate ?? ((_key: string, fallback: string) => fallback);
	const menuRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ left: x, top: y });

	useLayoutEffect(() => {
		const menu = menuRef.current;
		if (!menu) return;
		const margin = 8;
		const rect = menu.getBoundingClientRect();
		setPosition({
			left: Math.max(
				margin,
				Math.min(x, window.innerWidth - rect.width - margin),
			),
			top: Math.max(
				margin,
				Math.min(y, window.innerHeight - rect.height - margin),
			),
		});
	}, [x, y]);

	useEffect(() => {
		const handlePointerDown = (event: PointerEvent) => {
			if (!menuRef.current?.contains(event.target as Node)) onClose();
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("pointerdown", handlePointerDown);
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("pointerdown", handlePointerDown);
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [onClose]);

	const title =
		kind === "override"
			? t("canvas.snapMenu.overrideTitle", "Snap override")
			: t("canvas.snapMenu.runningTitle", "Running object snaps");

	return (
		<div
			ref={menuRef}
			className="canvas-editor__snap-menu"
			data-skedra-ui="snap-menu"
			style={position}
			role="menu"
			aria-label={title}
			data-kind={kind}
		>
			{!hideHeader && (
				<header className="canvas-editor__snap-menu-header">
					<Magnet aria-hidden="true" />
					<strong>{title}</strong>
					<button
						type="button"
						className="canvas-editor__panel-icon-button"
						onClick={onClose}
						aria-label={t("common.close", "Close")}
					>
						<X aria-hidden="true" />
					</button>
				</header>
			)}

			{kind === "running" && onToggleEnabled && (
				<button
					type="button"
					role="menuitemcheckbox"
					aria-checked={enabled}
					className="canvas-editor__snap-menu-item"
					onClick={onToggleEnabled}
				>
					<span className="canvas-editor__snap-menu-check">
						{enabled && <Check aria-hidden="true" />}
					</span>
					{t("canvas.snapMenu.enabled", "Object snap enabled")}
				</button>
			)}

			<div className="canvas-editor__snap-menu-grid">
				{CANVAS_EDITOR_OBJECT_SNAP_MODES.map((mode) => {
					const active = modes[mode];
					const ModeIcon = MODE_ICONS[mode];
					return (
						<button
							key={mode}
							type="button"
							role={kind === "running" ? "menuitemcheckbox" : "menuitem"}
							aria-checked={kind === "running" ? active : undefined}
							className="canvas-editor__snap-menu-item"
							data-active={active}
							onClick={() => {
								if (kind === "override") {
									onSelectOverride?.(mode);
									onClose();
								} else {
									onToggleMode?.(mode);
								}
							}}
						>
							<span className="canvas-editor__snap-menu-check">
								{kind === "running" && active && <Check aria-hidden="true" />}
							</span>
							<ModeIcon
								className="canvas-editor__snap-menu-mode-icon"
								aria-hidden="true"
							/>
							{t(`canvas.snapMenu.mode.${mode}`, MODE_LABELS[mode])}
						</button>
					);
				})}
			</div>

			{kind === "running" && onDivisionCountChange && (
				<label className="canvas-editor__snap-menu-division-count">
					<span>
						{t(
							"canvas.snapMenu.divisionCount",
							"Division points per side or quadrant",
						)}
					</span>
					<select
						value={divisionCount}
						onChange={(event) =>
							onDivisionCountChange(Number(event.currentTarget.value))
						}
						aria-label={t(
							"canvas.snapMenu.divisionCount",
							"Division points per side or quadrant",
						)}
					>
						{DIVISION_COUNT_OPTIONS.map((count) => (
							<option key={count} value={count}>
								{count}
							</option>
						))}
					</select>
				</label>
			)}

			{kind === "running" && onToggleShowPoints && (
				<button
					type="button"
					role="menuitemcheckbox"
					aria-checked={showPoints}
					className="canvas-editor__snap-menu-item canvas-editor__snap-menu-points"
					onClick={onToggleShowPoints}
				>
					<span className="canvas-editor__snap-menu-check">
						{showPoints && <Check aria-hidden="true" />}
					</span>
					{t("canvas.snapMenu.showPoints", "Show snap points")}
				</button>
			)}
		</div>
	);
}
