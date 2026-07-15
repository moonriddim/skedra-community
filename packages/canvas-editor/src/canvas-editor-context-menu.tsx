import type { CanvasObjectSnapMode } from "@skedra/canvas-core";
import {
	ArrowDown,
	ArrowUp,
	ChevronRight,
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
	RotateCw,
	Scissors,
	Trash2,
	Ungroup,
	Unlock,
} from "lucide-react";
import {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import {
	CanvasEditorSnapMenu,
	type CanvasEditorSnapModeState,
} from "./canvas-editor-snap-menu";

export type CanvasEditorContextMenuTranslate = (
	key: string,
	fallback: string,
) => string;

export interface CanvasEditorContextMenuProps {
	x: number;
	y: number;
	hasSelection: boolean;
	selectionCount: number;
	isLocked: boolean;
	isInFrame: boolean;
	isGrouped: boolean;
	readOnly?: boolean;
	canPaste: boolean;
	canPasteFormat: boolean;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void | Promise<void>;
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
	onCopyMirrorHorizontal: () => void;
	onCopyMirrorVertical: () => void;
	onRotate: (angle: number) => void;
	onCopyRotate: (angle: number) => void;
	onAddLink: () => void;
	onEmbedInFrame: () => void;
	onRemoveFromFrame: () => void;
	onGroup: () => void;
	onUngroup: () => void;
	snapToObjects: boolean;
	onToggleSnap: () => void;
	showSnapPoints: boolean;
	onToggleSnapPoints: () => void;
	snapModes: CanvasEditorSnapModeState;
	onToggleSnapMode: (mode: CanvasObjectSnapMode) => void;
	snapDivisionCount: number;
	onSnapDivisionCountChange: (count: number) => void;
	gridEnabled: boolean;
	onToggleGrid: () => void;
	gridSnapEnabled: boolean;
	onToggleGridSnap: () => void;
	gridSize: number;
	onGridSizeChange: (size: number) => void;
	translate?: CanvasEditorContextMenuTranslate;
	onClose: () => void;
}

interface ContextMenuItem {
	id: string;
	label: string;
	icon: ReactNode;
	shortcut?: string;
	action?: () => void | Promise<void>;
	danger?: boolean;
	disabled?: boolean;
	active?: boolean;
	submenu?: "snap";
	numberInput?: {
		value: number;
		min: number;
		max: number;
		step: number;
		onChange: (value: number) => void;
		onSubmit?: (value: number) => void;
	};
}

const icon = (value: ReactNode) => value;

/** Complete storage-independent canvas context menu used by every host. */
export function CanvasEditorContextMenu({
	x,
	y,
	hasSelection,
	selectionCount,
	isLocked,
	isInFrame,
	isGrouped,
	readOnly = false,
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
	onCopyMirrorHorizontal,
	onCopyMirrorVertical,
	onRotate,
	onCopyRotate,
	onAddLink,
	onEmbedInFrame,
	onRemoveFromFrame,
	onGroup,
	onUngroup,
	snapToObjects,
	onToggleSnap,
	showSnapPoints,
	onToggleSnapPoints,
	snapModes,
	onToggleSnapMode,
	snapDivisionCount,
	onSnapDivisionCountChange,
	gridEnabled,
	onToggleGrid,
	gridSnapEnabled,
	onToggleGridSnap,
	gridSize,
	onGridSizeChange,
	translate,
	onClose,
}: CanvasEditorContextMenuProps) {
	const t = translate ?? ((_key: string, fallback: string) => fallback);
	const menuRef = useRef<HTMLDivElement>(null);
	const [rotationAngle, setRotationAngle] = useState(90);
	const [snapSubmenuPosition, setSnapSubmenuPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [position, setPosition] = useState({ left: x, top: y });

	useLayoutEffect(() => {
		const menu = menuRef.current;
		if (!menu) return;
		const padding = 12;
		const rect = menu.getBoundingClientRect();
		setPosition({
			left: Math.max(
				padding,
				Math.min(x, window.innerWidth - rect.width - padding),
			),
			top: Math.max(
				padding,
				Math.min(y, window.innerHeight - rect.height - padding),
			),
		});
	}, [x, y]);

	useEffect(() => {
		const closeOutside = (event: MouseEvent) => {
			const target = event.target as Element | null;
			if (
				menuRef.current &&
				!menuRef.current.contains(target) &&
				!target?.closest('[data-skedra-ui="snap-menu"]')
			) {
				onClose();
			}
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("mousedown", closeOutside);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("mousedown", closeOutside);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [onClose]);

	const openSnapSubmenu = (target: HTMLElement) => {
		const rect = target.getBoundingClientRect();
		const submenuWidth = 280;
		const gap = 6;
		const openRight = rect.right + gap + submenuWidth <= window.innerWidth - 8;
		setSnapSubmenuPosition({
			x: openRight ? rect.right + gap : rect.left - submenuWidth - gap,
			y: rect.top - 6,
		});
	};
	const mutatingDisabled = readOnly || isLocked;
	const clipboardGroup: ContextMenuItem[] = [
		{
			id: "cut",
			label: t("canvas.contextMenu.cut", "Cut"),
			icon: icon(<Scissors />),
			shortcut: "Ctrl+X",
			action: onCut,
			disabled: readOnly,
		},
		{
			id: "copy",
			label: t("canvas.contextMenu.copy", "Copy"),
			icon: icon(<Copy />),
			shortcut: "Ctrl+C",
			action: onCopy,
		},
		{
			id: "paste",
			label: t("canvas.contextMenu.paste", "Paste"),
			icon: icon(<ClipboardPaste />),
			shortcut: "Ctrl+V",
			action: onPaste,
			disabled: readOnly || !canPaste,
		},
	];
	const formatGroup: ContextMenuItem[] = [
		{
			id: "copy-format",
			label: t("canvas.contextMenu.copyFormatting", "Copy formatting"),
			icon: icon(<Paintbrush />),
			shortcut: "Ctrl+Alt+C",
			action: onCopyFormat,
		},
		{
			id: "paste-format",
			label: t("canvas.contextMenu.pasteFormatting", "Paste formatting"),
			icon: icon(<Paintbrush />),
			shortcut: "Ctrl+Alt+V",
			action: onPasteFormat,
			disabled: readOnly || !canPasteFormat,
		},
	];
	const orderGroup: ContextMenuItem[] = [
		{
			id: "send-backward",
			label: t("canvas.contextMenu.sendBackward", "Send backward"),
			icon: icon(<ArrowDown />),
			shortcut: "Ctrl+[",
			action: onSendBackward,
			disabled: mutatingDisabled,
		},
		{
			id: "bring-forward",
			label: t("canvas.contextMenu.bringForward", "Bring forward"),
			icon: icon(<ArrowUp />),
			shortcut: "Ctrl+]",
			action: onBringForward,
			disabled: mutatingDisabled,
		},
		{
			id: "send-to-back",
			label: t("canvas.contextMenu.sendToBack", "Send to back"),
			icon: icon(<ChevronsDown />),
			shortcut: "Ctrl+Shift+[",
			action: onSendToBack,
			disabled: mutatingDisabled,
		},
		{
			id: "bring-to-front",
			label: t("canvas.contextMenu.bringToFront", "Bring to front"),
			icon: icon(<ChevronsUp />),
			shortcut: "Ctrl+Shift+]",
			action: onBringToFront,
			disabled: mutatingDisabled,
		},
	];
	const transformGroup: ContextMenuItem[] = [
		{
			id: "flip-horizontal",
			label: t("canvas.contextMenu.flipHorizontal", "Flip horizontally"),
			icon: icon(<FlipHorizontal2 />),
			shortcut: "Shift+H",
			action: onFlipHorizontal,
			disabled: mutatingDisabled,
		},
		{
			id: "copy-mirror-horizontal",
			label: t(
				"canvas.contextMenu.copyMirrorHorizontal",
				"Create horizontal mirror copy",
			),
			icon: icon(<CopyPlus />),
			action: onCopyMirrorHorizontal,
			disabled: readOnly,
		},
		{
			id: "flip-vertical",
			label: t("canvas.contextMenu.flipVertical", "Flip vertically"),
			icon: icon(<FlipVertical2 />),
			shortcut: "Shift+V",
			action: onFlipVertical,
			disabled: mutatingDisabled,
		},
		{
			id: "copy-mirror-vertical",
			label: t(
				"canvas.contextMenu.copyMirrorVertical",
				"Create vertical mirror copy",
			),
			icon: icon(<CopyPlus />),
			action: onCopyMirrorVertical,
			disabled: readOnly,
		},
		{
			id: "rotation-angle",
			label: t("canvas.contextMenu.rotationAngle", "Rotation angle"),
			icon: icon(<RotateCw />),
			disabled: readOnly,
			numberInput: {
				value: rotationAngle,
				min: -36000,
				max: 36000,
				step: 0.1,
				onChange: setRotationAngle,
				onSubmit: onRotate,
			},
		},
		{
			id: "rotate",
			label: t("canvas.contextMenu.rotateByAngle", "Rotate by angle"),
			icon: icon(<RotateCw />),
			shortcut: `${rotationAngle}°`,
			action: () => onRotate(rotationAngle),
			disabled: mutatingDisabled || !Number.isFinite(rotationAngle),
		},
		{
			id: "copy-rotate",
			label: t("canvas.contextMenu.copyRotate", "Create rotated copy"),
			icon: icon(<CopyPlus />),
			shortcut: `${rotationAngle}°`,
			action: () => onCopyRotate(rotationAngle),
			disabled: readOnly || !Number.isFinite(rotationAngle),
		},
	];
	const lockItem: ContextMenuItem = isLocked
		? {
				id: "unlock",
				label: t("canvas.contextMenu.unlock", "Unlock"),
				icon: icon(<Unlock />),
				shortcut: "Ctrl+Shift+L",
				action: onToggleLock,
				disabled: readOnly,
			}
		: {
				id: "lock",
				label: t("canvas.contextMenu.lock", "Lock"),
				icon: icon(<Lock />),
				shortcut: "Ctrl+Shift+L",
				action: onToggleLock,
				disabled: readOnly,
			};
	const frameGroup: ContextMenuItem[] = [
		isInFrame
			? {
					id: "remove-from-frame",
					label: t("canvas.contextMenu.removeFromFrame", "Remove from frame"),
					icon: icon(<Ungroup />),
					action: onRemoveFromFrame,
					disabled: readOnly,
				}
			: {
					id: "embed-in-frame",
					label: t("canvas.contextMenu.embedInFrame", "Wrap in frame"),
					icon: icon(<Frame />),
					action: onEmbedInFrame,
					disabled: readOnly,
				},
	];
	const groupGroup: ContextMenuItem[] = isGrouped
		? [
				{
					id: "ungroup",
					label: t("canvas.contextMenu.ungroup", "Ungroup"),
					icon: icon(<Ungroup />),
					shortcut: "Ctrl+Shift+G",
					action: onUngroup,
					disabled: readOnly,
				},
			]
		: selectionCount >= 2
			? [
					{
						id: "group",
						label: t("canvas.contextMenu.group", "Group"),
						icon: icon(<Group />),
						shortcut: "Ctrl+G",
						action: onGroup,
						disabled: readOnly,
					},
				]
			: [];
	const snapGroup: ContextMenuItem[] = [
		{
			id: "snap-settings",
			label: t("canvas.contextMenu.snapSettings", "Object snap settings"),
			icon: icon(<Magnet />),
			shortcut: "F3",
			active: snapToObjects,
			submenu: "snap",
		},
	];
	const gridGroup: ContextMenuItem[] = [
		{
			id: "grid",
			label: gridEnabled
				? t("canvas.contextMenu.gridEnabled", "Grid enabled")
				: t("canvas.contextMenu.grid", "Grid"),
			icon: icon(<Grid3X3 />),
			shortcut: "Ctrl+'",
			action: onToggleGrid,
			active: gridEnabled,
		},
		{
			id: "grid-snap",
			label: gridSnapEnabled
				? t("canvas.contextMenu.gridSnapEnabled", "Grid snap enabled")
				: t("canvas.contextMenu.gridSnap", "Snap to grid"),
			icon: icon(<Grid3X3 />),
			action: onToggleGridSnap,
			active: gridSnapEnabled,
		},
		{
			id: "grid-size",
			label: t("canvas.contextMenu.gridSpacing", "Grid spacing"),
			icon: icon(<Grid3X3 />),
			numberInput: {
				value: gridSize,
				min: 1,
				max: 1000,
				step: 1,
				onChange: onGridSizeChange,
			},
		},
	];
	const groups = (
		hasSelection
			? [
					clipboardGroup,
					frameGroup,
					groupGroup,
					formatGroup,
					orderGroup,
					transformGroup,
					[
						{
							id: "add-link",
							label: t("canvas.contextMenu.addLink", "Add link"),
							icon: icon(<Link />),
							shortcut: "Ctrl+K",
							action: onAddLink,
							disabled: readOnly,
						},
					],
					[
						{
							id: "duplicate",
							label: t("canvas.contextMenu.duplicate", "Duplicate"),
							icon: icon(<CopyPlus />),
							shortcut: "Ctrl+D",
							action: onDuplicate,
							disabled: readOnly,
						},
						lockItem,
					],
					snapGroup,
					gridGroup,
					[
						{
							id: "delete",
							label: t("canvas.contextMenu.delete", "Delete"),
							icon: icon(<Trash2 />),
							shortcut: "Delete",
							action: onDelete,
							danger: true,
							disabled: readOnly,
						},
					],
				]
			: [
					[
						{
							id: "paste",
							label: t("canvas.contextMenu.paste", "Paste"),
							icon: icon(<ClipboardPaste />),
							shortcut: "Ctrl+V",
							action: onPaste,
							disabled: readOnly || !canPaste,
						},
						{
							id: "paste-format",
							label: t(
								"canvas.contextMenu.pasteFormatting",
								"Paste formatting",
							),
							icon: icon(<Paintbrush />),
							shortcut: "Ctrl+Alt+V",
							action: onPasteFormat,
							disabled: readOnly || !canPasteFormat,
						},
					],
					[
						{
							id: "select-all",
							label: t("canvas.contextMenu.selectAll", "Select all"),
							icon: icon(<Clipboard />),
							shortcut: "Ctrl+A",
							action: onSelectAll,
						},
					],
					snapGroup,
					gridGroup,
				]
	) as ContextMenuItem[][];

	const runAndClose = (item: ContextMenuItem) => {
		if (item.disabled || !item.action) return;
		void item.action();
		onClose();
	};
	const renderItem = (item: ContextMenuItem) => {
		if (item.numberInput) {
			return (
				<label
					key={item.id}
					className="canvas-editor__context-menu-number"
					data-disabled={item.disabled || undefined}
					onPointerEnter={() => setSnapSubmenuPosition(null)}
				>
					{item.icon}
					<span>{item.label}</span>
					<input
						type="number"
						value={item.numberInput.value}
						min={item.numberInput.min}
						max={item.numberInput.max}
						step={item.numberInput.step}
						disabled={item.disabled}
						onChange={(event) =>
							item.numberInput?.onChange(Number(event.target.value))
						}
						onKeyDown={(event) => {
							event.stopPropagation();
							if (event.key === "Enter" && item.numberInput?.onSubmit) {
								event.preventDefault();
								item.numberInput.onSubmit(item.numberInput.value);
								onClose();
							}
						}}
					/>
				</label>
			);
		}
		if (item.submenu === "snap") {
			return (
				<div key={item.id} className="canvas-editor__context-menu-submenu">
					<button
						type="button"
						role="menuitem"
						className="canvas-editor__context-menu-item"
						data-active={item.active || undefined}
						aria-haspopup="menu"
						aria-expanded={snapSubmenuPosition != null}
						onPointerEnter={(event) => openSnapSubmenu(event.currentTarget)}
						onFocus={(event) => openSnapSubmenu(event.currentTarget)}
						onClick={(event) => openSnapSubmenu(event.currentTarget)}
						onKeyDown={(event) => {
							if (event.key === "ArrowRight") {
								event.preventDefault();
								openSnapSubmenu(event.currentTarget);
							}
						}}
					>
						{item.icon}
						<span>{item.label}</span>
						{item.shortcut && <small>{item.shortcut}</small>}
						<ChevronRight aria-hidden="true" />
					</button>
					{snapSubmenuPosition &&
						typeof document !== "undefined" &&
						createPortal(
							<CanvasEditorSnapMenu
								x={snapSubmenuPosition.x}
								y={snapSubmenuPosition.y}
								kind="running"
								enabled={snapToObjects}
								modes={snapModes}
								showPoints={showSnapPoints}
								divisionCount={snapDivisionCount}
								hideHeader
								translate={t}
								onToggleEnabled={onToggleSnap}
								onToggleMode={onToggleSnapMode}
								onToggleShowPoints={onToggleSnapPoints}
								onDivisionCountChange={onSnapDivisionCountChange}
								onClose={() => setSnapSubmenuPosition(null)}
							/>,
							document.body,
						)}
				</div>
			);
		}
		return (
			<button
				key={item.id}
				type="button"
				role="menuitem"
				className="canvas-editor__context-menu-item"
				data-danger={item.danger || undefined}
				data-active={item.active || undefined}
				disabled={item.disabled}
				onPointerEnter={() => setSnapSubmenuPosition(null)}
				onClick={() => runAndClose(item)}
			>
				{item.icon}
				<span>{item.label}</span>
				{item.shortcut && <small>{item.shortcut}</small>}
			</button>
		);
	};

	return (
		<div
			ref={menuRef}
			className="canvas-editor__context-menu"
			style={position}
			role="menu"
			aria-label={t("canvas.contextMenu.label", "Canvas actions")}
		>
			<div className="canvas-editor__context-menu-scroll">
				{groups
					.filter((group) => group.length > 0)
					.map((group, groupIndex) => (
						<div
							key={group.map((item) => item.id).join("|")}
							className="canvas-editor__context-menu-group"
							data-separated={groupIndex > 0 || undefined}
						>
							{group.map(renderItem)}
						</div>
					))}
			</div>
		</div>
	);
}
