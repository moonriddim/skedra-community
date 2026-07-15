import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { Fragment, useMemo } from "react";

interface CanvasHelpDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Gastmodus: zusaetzliche Skedra-Hinweise anzeigen */
	guestMode?: boolean;
}

type ShortcutRow = {
	labelKey: string;
	/** Jede Gruppe ist eine Alternative (mit "oder"), innen mit + verbunden */
	keys: string[][];
};

/** Einzelnes Tasten-Badge wie bei Excalidraw */
function HelpKbd({ children }: { children: React.ReactNode }) {
	return (
		<kbd className="inline-flex min-h-[22px] min-w-[22px] items-center justify-center rounded border border-border/80 bg-muted/40 px-1.5 font-sans text-[11px] font-medium text-foreground/90 shadow-sm">
			{children}
		</kbd>
	);
}

function HelpShortcutRow({
	label,
	keys,
	orLabel,
}: {
	label: string;
	keys: string[][];
	orLabel: string;
}) {
	return (
		<div className="flex items-start justify-between gap-4 border-b border-border/40 py-2.5 text-sm last:border-b-0">
			<span className="min-w-0 flex-1 text-muted-foreground">{label}</span>
			<div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
				{keys.map((alternative, altIndex) => (
					<Fragment key={alternative.join("+")}>
						{altIndex > 0 && (
							<span className="px-0.5 text-xs text-muted-foreground/70">
								{orLabel}
							</span>
						)}
						<span className="inline-flex items-center gap-0.5">
							{alternative.map((key, keyIndex) => (
								<Fragment key={key}>
									{keyIndex > 0 && (
										<span className="px-0.5 text-[10px] text-muted-foreground/60">
											+
										</span>
									)}
									<HelpKbd>{key}</HelpKbd>
								</Fragment>
							))}
						</span>
					</Fragment>
				))}
			</div>
		</div>
	);
}

function HelpSection({
	title,
	rows,
	t,
	orLabel,
	resolveKeys,
}: {
	title: string;
	rows: ShortcutRow[];
	t: (key: string) => string;
	orLabel: string;
	resolveKeys: (keys: string[][]) => string[][];
}) {
	return (
		<section>
			<h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
			<div>
				{rows.map((row) => (
					<HelpShortcutRow
						key={row.labelKey}
						label={t(row.labelKey)}
						keys={resolveKeys(row.keys)}
						orLabel={orLabel}
					/>
				))}
			</div>
		</section>
	);
}

/** Excalidraw-aehnlicher Hilfe-Dialog mit Tastaturkuerzeln */
export function CanvasHelpDialog({
	open,
	onOpenChange,
	guestMode = false,
}: CanvasHelpDialogProps) {
	const { t } = useI18n();

	const mod = useMemo(() => {
		if (typeof navigator === "undefined") return "Strg";
		return /Mac|iPhone|iPad/i.test(navigator.platform) ? "⌘" : "Strg";
	}, []);

	const resolveKeys = (groups: string[][]) =>
		groups.map((group) =>
			group.map((key) => {
				if (key === "mod") return mod;
				if (key === "shift") return "Shift";
				if (key === "alt") return "Alt";
				if (key === "delete") return t("canvas.helpDialog.keys.delete");
				if (key === "space") return t("canvas.helpDialog.keys.space");
				if (key === "wheel") return t("canvas.helpDialog.keys.wheel");
				if (key === "drag") return t("canvas.helpDialog.keys.drag");
				if (key === "click") return t("canvas.helpDialog.keys.click");
				if (key === "esc") return "Esc";
				if (key === "enter") return "Enter";
				if (key === "dblclick") return t("canvas.helpDialog.keys.dblclick");
				if (key === "pgup") return "PgUp";
				if (key === "pgdn") return "PgDn";
				return key;
			}),
		);

	const toolShortcuts: ShortcutRow[] = [
		{ labelKey: "canvas.helpDialog.tools.pan", keys: [["H"]] },
		{ labelKey: "canvas.helpDialog.tools.select", keys: [["V"], ["1"]] },
		{ labelKey: "canvas.helpDialog.tools.lasso", keys: [] },
		{
			labelKey: "canvas.helpDialog.tools.lassoAltDrag",
			keys: [["alt", "drag"]],
		},
		{ labelKey: "canvas.helpDialog.tools.rectangle", keys: [["R"], ["2"]] },
		{ labelKey: "canvas.helpDialog.tools.diamond", keys: [["D"], ["3"]] },
		{ labelKey: "canvas.helpDialog.tools.ellipse", keys: [["O"], ["4"]] },
		{ labelKey: "canvas.helpDialog.tools.triangle", keys: [] },
		{ labelKey: "canvas.helpDialog.tools.cloud", keys: [] },
		{ labelKey: "canvas.helpDialog.tools.arrow", keys: [["A"], ["5"]] },
		{ labelKey: "canvas.helpDialog.tools.line", keys: [["L"], ["6"]] },
		{ labelKey: "canvas.helpDialog.tools.freehand", keys: [["P"], ["7"]] },
		{ labelKey: "canvas.helpDialog.tools.text", keys: [["T"], ["8"]] },
		{ labelKey: "canvas.helpDialog.tools.image", keys: [["9"]] },
		{ labelKey: "canvas.helpDialog.tools.eraser", keys: [["E"], ["0"]] },
		{ labelKey: "canvas.helpDialog.tools.laser", keys: [["K"]] },
		{
			labelKey: "canvas.helpDialog.tools.eyedropper",
			keys: [["I"], ["shift", "S"]],
		},
		{
			labelKey: "canvas.helpDialog.tools.eyedropperFill",
			keys: [["shift", "G"]],
		},
		{ labelKey: "canvas.helpDialog.tools.frame", keys: [["F"]] },
		{ labelKey: "canvas.helpDialog.tools.lockTool", keys: [["Q"]] },
		{ labelKey: "canvas.helpDialog.tools.editText", keys: [["enter"]] },
		{
			labelKey: "canvas.helpDialog.tools.cropImage",
			keys: [["enter"], ["dblclick"]],
		},
		{ labelKey: "canvas.helpDialog.tools.strokeColor", keys: [["S"]] },
		{ labelKey: "canvas.helpDialog.tools.fillColor", keys: [["G"]] },
		{ labelKey: "canvas.helpDialog.tools.fontPanel", keys: [["shift", "F"]] },
	];

	const editorShortcuts: ShortcutRow[] = [
		{
			labelKey: "canvas.helpDialog.editor.panCanvas",
			keys: [
				["space", "drag"],
				["wheel", "drag"],
			],
		},
		{
			labelKey: "canvas.helpDialog.editor.clearCanvas",
			keys: [["mod", "delete"]],
		},
		{ labelKey: "canvas.helpDialog.editor.delete", keys: [["delete"]] },
		{ labelKey: "canvas.helpDialog.editor.undo", keys: [["mod", "Z"]] },
		{
			labelKey: "canvas.helpDialog.editor.redo",
			keys: [
				["mod", "Y"],
				["mod", "shift", "Z"],
			],
		},
		{ labelKey: "canvas.helpDialog.editor.cut", keys: [["mod", "X"]] },
		{ labelKey: "canvas.helpDialog.editor.copy", keys: [["mod", "C"]] },
		{ labelKey: "canvas.helpDialog.editor.paste", keys: [["mod", "V"]] },
		{
			labelKey: "canvas.helpDialog.editor.pastePlain",
			keys: [["mod", "shift", "V"]],
		},
		{
			labelKey: "canvas.helpDialog.editor.duplicate",
			keys: [
				["mod", "D"],
				["alt", "drag"],
			],
		},
		{ labelKey: "canvas.helpDialog.editor.selectAll", keys: [["mod", "A"]] },
		{
			labelKey: "canvas.helpDialog.editor.addToSelection",
			keys: [
				["mod", "click"],
				["shift", "click"],
			],
		},
		{
			labelKey: "canvas.helpDialog.editor.selectInGroup",
			keys: [["alt", "click"]],
		},
		{
			labelKey: "canvas.helpDialog.editor.copyFormat",
			keys: [["mod", "alt", "C"]],
		},
		{
			labelKey: "canvas.helpDialog.editor.pasteFormat",
			keys: [["mod", "alt", "V"]],
		},
		{ labelKey: "canvas.helpDialog.editor.bringForward", keys: [["mod", "]"]] },
		{ labelKey: "canvas.helpDialog.editor.sendBackward", keys: [["mod", "["]] },
		{
			labelKey: "canvas.helpDialog.editor.bringToFront",
			keys: [["mod", "shift", "]"]],
		},
		{
			labelKey: "canvas.helpDialog.editor.sendToBack",
			keys: [["mod", "shift", "["]],
		},
		{
			labelKey: "canvas.helpDialog.editor.alignTop",
			keys: [["mod", "shift", "↑"]],
		},
		{
			labelKey: "canvas.helpDialog.editor.alignBottom",
			keys: [["mod", "shift", "↓"]],
		},
		{
			labelKey: "canvas.helpDialog.editor.alignLeft",
			keys: [["mod", "shift", "←"]],
		},
		{
			labelKey: "canvas.helpDialog.editor.alignRight",
			keys: [["mod", "shift", "→"]],
		},
		{
			labelKey: "canvas.helpDialog.editor.flipHorizontal",
			keys: [["shift", "H"]],
		},
		{
			labelKey: "canvas.helpDialog.editor.flipVertical",
			keys: [["shift", "V"]],
		},
		{ labelKey: "canvas.helpDialog.editor.addLink", keys: [["mod", "K"]] },
		{
			labelKey: "canvas.helpDialog.editor.toggleLock",
			keys: [["mod", "shift", "L"]],
		},
		{ labelKey: "canvas.helpDialog.editor.group", keys: [["mod", "G"]] },
		{
			labelKey: "canvas.helpDialog.editor.ungroup",
			keys: [["mod", "shift", "G"]],
		},
		{ labelKey: "canvas.helpDialog.editor.deselect", keys: [["esc"]] },
		{
			labelKey: "canvas.helpDialog.editor.decreaseFont",
			keys: [["mod", "shift", "<"]],
		},
		{
			labelKey: "canvas.helpDialog.editor.increaseFont",
			keys: [["mod", "shift", ">"]],
		},
		{
			labelKey: "canvas.helpDialog.editor.flowchartCreate",
			keys: [
				["mod", "↑"],
				["mod", "↓"],
				["mod", "←"],
				["mod", "→"],
			],
		},
		{
			labelKey: "canvas.helpDialog.editor.flowchartNavigate",
			keys: [
				["alt", "↑"],
				["alt", "↓"],
				["alt", "←"],
				["alt", "→"],
			],
		},
	];

	const viewShortcuts: ShortcutRow[] = [
		{ labelKey: "canvas.helpDialog.view.zoomIn", keys: [["mod", "+"]] },
		{ labelKey: "canvas.helpDialog.view.zoomOut", keys: [["mod", "-"]] },
		{ labelKey: "canvas.helpDialog.view.resetZoom", keys: [["mod", "0"]] },
		{ labelKey: "canvas.helpDialog.view.zoomToFit", keys: [["shift", "1"]] },
		{
			labelKey: "canvas.helpDialog.view.zoomToSelection",
			keys: [["shift", "2"]],
		},
		{
			labelKey: "canvas.helpDialog.view.scrollVertical",
			keys: [["pgup"], ["pgdn"]],
		},
		{
			labelKey: "canvas.helpDialog.view.scrollHorizontal",
			keys: [
				["shift", "pgup"],
				["shift", "pgdn"],
			],
		},
		{ labelKey: "canvas.helpDialog.view.snapToObjects", keys: [["alt", "S"]] },
		{ labelKey: "canvas.helpDialog.view.toggleGrid", keys: [["mod", "'"]] },
		{
			labelKey: "canvas.helpDialog.view.toggleTheme",
			keys: [["alt", "shift", "D"]],
		},
		{ labelKey: "canvas.helpDialog.view.toggleZen", keys: [["alt", "Z"]] },
		{
			labelKey: "canvas.helpDialog.view.commandPalette",
			keys: [
				["mod", "/"],
				["mod", "shift", "P"],
			],
		},
		{ labelKey: "canvas.helpDialog.view.openHelp", keys: [["?"]] },
	];

	const guestShortcuts: ShortcutRow[] = [
		{
			labelKey: "canvas.helpDialog.guest.saveToCloud",
			keys: [[t("canvas.helpDialog.guest.shareButton")]],
		},
		{
			labelKey: "canvas.helpDialog.guest.export",
			keys: [[t("canvas.helpDialog.guest.menuButton")]],
		},
	];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-2xl">
						{t("canvas.helpDialog.title")}
					</DialogTitle>
				</DialogHeader>

				<p className="text-sm font-medium text-muted-foreground">
					{t("canvas.helpDialog.shortcutsTitle")}
				</p>

				<div className="mt-2 grid gap-8 md:grid-cols-2">
					<HelpSection
						title={t("canvas.helpDialog.sections.tools")}
						rows={toolShortcuts}
						t={t}
						orLabel={t("canvas.helpDialog.or")}
						resolveKeys={resolveKeys}
					/>
					<HelpSection
						title={t("canvas.helpDialog.sections.editor")}
						rows={editorShortcuts}
						t={t}
						orLabel={t("canvas.helpDialog.or")}
						resolveKeys={resolveKeys}
					/>
				</div>

				<div className="mt-2 grid gap-8 md:grid-cols-2">
					<HelpSection
						title={t("canvas.helpDialog.sections.view")}
						rows={viewShortcuts}
						t={t}
						orLabel={t("canvas.helpDialog.or")}
						resolveKeys={resolveKeys}
					/>
					{guestMode && (
						<HelpSection
							title={t("canvas.helpDialog.sections.skedra")}
							rows={guestShortcuts}
							t={t}
							orLabel={t("canvas.helpDialog.or")}
							resolveKeys={resolveKeys}
						/>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
