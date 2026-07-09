import { useI18n } from "@/lib/i18n";
import {
	ArrowDown,
	ArrowUp,
	ChevronsDown,
	ChevronsUp,
	Clipboard,
	ClipboardPaste,
	Copy,
	CopyPlus,
	FlipHorizontal2,
	FlipVertical2,
	Frame,
	Grid3X3,
	Group,
	Link,
	Lock,
	Magnet,
	Paintbrush,
	Scissors,
	Trash2,
	Ungroup,
	Unlock,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface ContextMenuProps {
	x: number;
	y: number;
	hasSelection: boolean;
	isLocked: boolean;
	isInFrame: boolean;
	isGrouped: boolean;
	canPaste: boolean;
	canPasteFormat: boolean;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
	onSelectAll: () => void;
	onToggleLock: () => void;
	onCopyFormat: () => void;
	onPasteFormat: () => void;
	onBringForward: () => void;
	onSendBackward: () => void;
	onBringToFront: () => void;
	onSendToBack: () => void;
	onFlipHorizontal: () => void;
	onFlipVertical: () => void;
	onAddLink: () => void;
	onEmbedInFrame: () => void;
	onRemoveFromFrame: () => void;
	onGroup: () => void;
	onUngroup: () => void;
	snapToObjects: boolean;
	onToggleSnap: () => void;
	showSnapPoints: boolean;
	onToggleSnapPoints: () => void;
	snapToCenters: boolean;
	onToggleSnapCenters: () => void;
	snapToMidpoints: boolean;
	onToggleSnapMidpoints: () => void;
	gridEnabled: boolean;
	onToggleGrid: () => void;
	onClose: () => void;
}

interface MenuItem {
	label: string;
	icon: React.ReactNode;
	shortcut?: string;
	action: () => void;
	danger?: boolean;
	disabled?: boolean;
}

export function ContextMenu({
	x,
	y,
	hasSelection,
	isLocked,
	isInFrame,
	isGrouped,
	canPaste,
	canPasteFormat,
	onCopy,
	onCut,
	onPaste,
	onDuplicate,
	onDelete,
	onSelectAll,
	onToggleLock,
	onCopyFormat,
	onPasteFormat,
	onBringForward,
	onSendBackward,
	onBringToFront,
	onSendToBack,
	onFlipHorizontal,
	onFlipVertical,
	onAddLink,
	onEmbedInFrame,
	onRemoveFromFrame,
	onGroup,
	onUngroup,
	snapToObjects,
	onToggleSnap,
	showSnapPoints,
	onToggleSnapPoints,
	snapToCenters,
	onToggleSnapCenters,
	snapToMidpoints,
	onToggleSnapMidpoints,
	gridEnabled,
	onToggleGrid,
	onClose,
}: ContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null);
	const { t } = useI18n();
	/** Position nach Messung — damit das Menü nie unter den Viewport ragt */
	const [coords, setCoords] = useState({ left: x, top: y });

	useLayoutEffect(() => {
		const menu = menuRef.current;
		if (!menu) return;

		const padding = 12;
		const rect = menu.getBoundingClientRect();
		let left = x;
		let top = y;

		if (left + rect.width > window.innerWidth - padding) {
			left = Math.max(padding, window.innerWidth - rect.width - padding);
		}
		if (top + rect.height > window.innerHeight - padding) {
			top = Math.max(padding, window.innerHeight - rect.height - padding);
		}
		if (top < padding) top = padding;

		setCoords((prev) =>
			prev.left === left && prev.top === top ? prev : { left, top },
		);
	}, [x, y]);

	useEffect(() => {
		const handleClick = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				onClose();
			}
		};

		const handleKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};

		document.addEventListener("mousedown", handleClick);
		document.addEventListener("keydown", handleKey);

		return () => {
			document.removeEventListener("mousedown", handleClick);
			document.removeEventListener("keydown", handleKey);
		};
	}, [onClose]);

	const left = coords.left;
	const top = coords.top;

	const clipboardGroup: MenuItem[] = [
		{
			label: t("canvas.contextMenu.cut"),
			icon: <Scissors className="h-3.5 w-3.5" />,
			shortcut: "Ctrl+X",
			action: onCut,
		},
		{
			label: t("canvas.contextMenu.copy"),
			icon: <Copy className="h-3.5 w-3.5" />,
			shortcut: "Ctrl+C",
			action: onCopy,
		},
		{
			label: t("canvas.contextMenu.paste"),
			icon: <ClipboardPaste className="h-3.5 w-3.5" />,
			shortcut: "Ctrl+V",
			action: onPaste,
			disabled: !canPaste,
		},
	];

	const formatGroup: MenuItem[] = [
		{
			label: t("canvas.contextMenu.copyFormatting"),
			icon: <Paintbrush className="h-3.5 w-3.5" />,
			shortcut: "Ctrl+Alt+C",
			action: onCopyFormat,
		},
		{
			label: t("canvas.contextMenu.pasteFormatting"),
			icon: <Paintbrush className="h-3.5 w-3.5" />,
			shortcut: "Ctrl+Alt+V",
			action: onPasteFormat,
			disabled: !canPasteFormat,
		},
	];

	const orderGroup: MenuItem[] = [
		{
			label: t("canvas.contextMenu.sendBackward"),
			icon: <ArrowDown className="h-3.5 w-3.5" />,
			shortcut: "Ctrl+[",
			action: onSendBackward,
		},
		{
			label: t("canvas.contextMenu.bringForward"),
			icon: <ArrowUp className="h-3.5 w-3.5" />,
			shortcut: "Ctrl+]",
			action: onBringForward,
		},
		{
			label: t("canvas.contextMenu.sendToBack"),
			icon: <ChevronsDown className="h-3.5 w-3.5" />,
			shortcut: "Ctrl+Shift+[",
			action: onSendToBack,
		},
		{
			label: t("canvas.contextMenu.bringToFront"),
			icon: <ChevronsUp className="h-3.5 w-3.5" />,
			shortcut: "Ctrl+Shift+]",
			action: onBringToFront,
		},
	];

	const flipGroup: MenuItem[] = [
		{
			label: t("canvas.contextMenu.flipHorizontal"),
			icon: <FlipHorizontal2 className="h-3.5 w-3.5" />,
			shortcut: "Shift+H",
			action: onFlipHorizontal,
		},
		{
			label: t("canvas.contextMenu.flipVertical"),
			icon: <FlipVertical2 className="h-3.5 w-3.5" />,
			shortcut: "Shift+V",
			action: onFlipVertical,
		},
	];

	const lockItem: MenuItem = isLocked
		? {
				label: t("canvas.contextMenu.unlock"),
				icon: <Unlock className="h-3.5 w-3.5" />,
				shortcut: "Ctrl+Shift+L",
				action: onToggleLock,
			}
		: {
				label: t("canvas.contextMenu.lock"),
				icon: <Lock className="h-3.5 w-3.5" />,
				shortcut: "Ctrl+Shift+L",
				action: onToggleLock,
			};

	const frameGroup: MenuItem[] = isInFrame
		? [
				{
					label: t("canvas.contextMenu.removeFromFrame"),
					icon: <Ungroup className="h-3.5 w-3.5" />,
					action: onRemoveFromFrame,
				},
			]
		: [
				{
					label: t("canvas.contextMenu.embedInFrame"),
					icon: <Frame className="h-3.5 w-3.5" />,
					action: onEmbedInFrame,
				},
			];

	const groupGroup: MenuItem[] = isGrouped
		? [
				{
					label: t("canvas.contextMenu.ungroup"),
					icon: <Ungroup className="h-3.5 w-3.5" />,
					shortcut: "Ctrl+Shift+G",
					action: onUngroup,
				},
			]
		: [
				{
					label: t("canvas.contextMenu.group"),
					icon: <Group className="h-3.5 w-3.5" />,
					shortcut: "Ctrl+G",
					action: onGroup,
				},
			];

	const deleteGroup: MenuItem[] = [
		{
			label: t("canvas.contextMenu.delete"),
			icon: <Trash2 className="h-3.5 w-3.5" />,
			shortcut: "Delete",
			action: onDelete,
			danger: true,
		},
	];

	const snapGroup: MenuItem[] = [
		{
			label: snapToObjects
				? t("canvas.contextMenu.snapToObjectsEnabled")
				: t("canvas.contextMenu.snapToObjects"),
			icon: <Magnet className="h-3.5 w-3.5" />,
			shortcut: "Alt+S",
			action: onToggleSnap,
		},
		{
			label: showSnapPoints
				? t("canvas.contextMenu.showSnapPointsEnabled")
				: t("canvas.contextMenu.showSnapPoints"),
			icon: <Magnet className="h-3.5 w-3.5" />,
			action: onToggleSnapPoints,
		},
		{
			label: snapToCenters
				? t("canvas.contextMenu.snapToCentersEnabled")
				: t("canvas.contextMenu.snapToCenters"),
			icon: <Magnet className="h-3.5 w-3.5" />,
			action: onToggleSnapCenters,
		},
		{
			label: snapToMidpoints
				? t("canvas.contextMenu.snapToMidpointsEnabled")
				: t("canvas.contextMenu.snapToMidpoints"),
			icon: <Magnet className="h-3.5 w-3.5" />,
			action: onToggleSnapMidpoints,
		},
		{
			label: gridEnabled
				? t("canvas.contextMenu.gridEnabled")
				: t("canvas.contextMenu.grid"),
			icon: <Grid3X3 className="h-3.5 w-3.5" />,
			shortcut: "Ctrl+'",
			action: onToggleGrid,
		},
	];

	const groups: MenuItem[][] = hasSelection
		? [
				clipboardGroup,
				frameGroup,
				groupGroup,
				formatGroup,
				orderGroup,
				flipGroup,
				snapGroup,
				[
					{
						label: t("canvas.contextMenu.addLink"),
						icon: <Link className="h-3.5 w-3.5" />,
						shortcut: "Ctrl+K",
						action: onAddLink,
					},
				],
				[
					{
						label: t("canvas.contextMenu.duplicate"),
						icon: <CopyPlus className="h-3.5 w-3.5" />,
						shortcut: "Ctrl+D",
						action: onDuplicate,
					},
					lockItem,
				],
				deleteGroup,
			]
		: [
				[
					{
						label: t("canvas.contextMenu.paste"),
						icon: <ClipboardPaste className="h-3.5 w-3.5" />,
						shortcut: "Ctrl+V",
						action: onPaste,
						disabled: !canPaste,
					},
					{
						label: t("canvas.contextMenu.pasteFormatting"),
						icon: <Paintbrush className="h-3.5 w-3.5" />,
						shortcut: "Ctrl+Alt+V",
						action: onPasteFormat,
						disabled: !canPasteFormat,
					},
				],
				[
					{
						label: t("canvas.contextMenu.selectAll"),
						icon: <Clipboard className="h-3.5 w-3.5" />,
						shortcut: "Ctrl+A",
						action: onSelectAll,
					},
				],
				snapGroup,
			];

	return (
		<div
			ref={menuRef}
			className="fixed z-150 min-w-[240px] rounded-lg border border-border bg-card/95 shadow-2xl backdrop-blur-md"
			style={{ left, top }}
		>
			{/* Scrollbar wenn viele Eintraege — bleibt immer im Viewport */}
			<div className="max-h-[min(480px,calc(100dvh-24px))] overflow-y-auto overscroll-contain py-1">
				{groups.map((group, groupIndex) => (
					<div key={group.map((item) => item.label).join("|")}>
						{groupIndex > 0 && <div className="my-1 h-px bg-border" />}
						{group.map((item) => (
							<button
								key={item.label}
								type="button"
								disabled={item.disabled}
								onClick={() => {
									item.action();
									onClose();
								}}
								className={`
								flex w-full items-center gap-3 px-3 py-1.5 text-xs transition-colors
								${item.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-accent"}
								${item.danger ? "text-destructive" : "text-card-foreground"}
							`}
							>
								{item.icon}
								<span className="flex-1 text-left">{item.label}</span>
								{item.shortcut && (
									<span className="text-[10px] text-muted-foreground">
										{item.shortcut}
									</span>
								)}
							</button>
						))}
					</div>
				))}
			</div>
		</div>
	);
}
