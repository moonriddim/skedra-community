import {
	type KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import {
	CanvasEditorToolStrip,
	type CanvasEditorToolStripProps,
} from "./canvas-editor-tool-strip";

export interface CanvasEditorToolbarAction {
	type: "action";
	id: string;
	label: string;
	icon: ReactNode;
	onSelect: () => void | Promise<void>;
	disabled?: boolean;
	active?: boolean;
	className?: string;
}

export interface CanvasEditorToolbarMenuItemAction {
	id: string;
	label: string;
	onSelect: () => void | Promise<void>;
	disabled?: boolean;
}

export interface CanvasEditorToolbarMenuItem {
	id: string;
	label: string;
	onSelect?: () => void | Promise<void>;
	disabled?: boolean;
	icon?: ReactNode;
	trailingIcon?: ReactNode;
	secondaryActions?: readonly CanvasEditorToolbarMenuItemAction[];
	closeOnSelect?: boolean;
}

export interface CanvasEditorToolbarMenu {
	type: "menu";
	id: string;
	label: string;
	icon: ReactNode;
	items: readonly CanvasEditorToolbarMenuItem[];
	disabled?: boolean;
	onOpen?: () => void;
	popoverClassName?: string;
}

export interface CanvasEditorToolbarColorControl {
	type: "color";
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	className?: string;
}

export interface CanvasEditorToolbarSeparator {
	type: "separator";
	id: string;
}

export type CanvasEditorToolbarItem =
	| CanvasEditorToolbarAction
	| CanvasEditorToolbarMenu
	| CanvasEditorToolbarColorControl
	| CanvasEditorToolbarSeparator;

export interface CanvasEditorToolbarClasses {
	root?: string;
	action?: string;
	actionActive?: string;
	separator?: string;
	menu?: string;
	popover?: string;
	menuItem?: string;
	menuRow?: string;
	secondaryAction?: string;
	color?: string;
}

export interface CanvasEditorToolbarProps {
	toolStrip: CanvasEditorToolStripProps;
	items?: readonly CanvasEditorToolbarItem[];
	classes?: CanvasEditorToolbarClasses;
}

const MENU_ITEM_SELECTOR = '[role="menuitem"]:not(:disabled)';

function getEnabledMenuItems(menu: HTMLDivElement) {
	return Array.from(
		menu.querySelectorAll<HTMLButtonElement>(MENU_ITEM_SELECTOR),
	);
}

function focusMenuItem(
	menu: HTMLDivElement | undefined,
	position: "first" | "last",
) {
	if (!menu) return;
	const items = getEnabledMenuItems(menu);
	const target = position === "first" ? items[0] : items.at(-1);
	target?.focus();
}

export type CanvasEditorMenuKeyAction =
	| { type: "focus"; index: number }
	| { type: "close"; restoreFocus: boolean };

export function resolveCanvasEditorMenuKeyAction(
	key: string,
	currentIndex: number,
	itemCount: number,
): CanvasEditorMenuKeyAction | null {
	if (key === "Escape") return { type: "close", restoreFocus: true };
	if (key === "Tab") return { type: "close", restoreFocus: false };
	if (itemCount === 0) return null;
	if (key === "ArrowDown") {
		return {
			type: "focus",
			index: currentIndex < 0 ? 0 : (currentIndex + 1) % itemCount,
		};
	}
	if (key === "ArrowUp") {
		return {
			type: "focus",
			index:
				currentIndex < 0
					? itemCount - 1
					: (currentIndex - 1 + itemCount) % itemCount,
		};
	}
	if (key === "Home") return { type: "focus", index: 0 };
	if (key === "End") return { type: "focus", index: itemCount - 1 };
	return null;
}

/**
 * Complete storage-independent editor toolbar. Hosts describe available product
 * actions, while button/menu behavior and accessible markup stay shared.
 */
export function CanvasEditorToolbar({
	toolStrip,
	items = [],
	classes,
}: CanvasEditorToolbarProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const menuIdPrefix = useId().replaceAll(":", "");
	const menuButtonRefs = useRef(new Map<string, HTMLButtonElement>());
	const menuRefs = useRef(new Map<string, HTMLDivElement>());
	const pendingMenuFocusRef = useRef<"first" | "last" | null>(null);
	const [openMenuId, setOpenMenuId] = useState<string | null>(null);

	useEffect(() => {
		if (!openMenuId) return;
		const pendingFocus = pendingMenuFocusRef.current;
		pendingMenuFocusRef.current = null;
		if (pendingFocus) {
			focusMenuItem(menuRefs.current.get(openMenuId), pendingFocus);
		}
		const closeOutside = (event: MouseEvent) => {
			if (
				event.target instanceof Node &&
				!rootRef.current?.contains(event.target)
			) {
				setOpenMenuId(null);
			}
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			menuButtonRefs.current.get(openMenuId)?.focus();
			setOpenMenuId(null);
		};
		document.addEventListener("mousedown", closeOutside);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("mousedown", closeOutside);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [openMenuId]);

	const closeMenu = (restoreFocus = true) => {
		const menuId = openMenuId;
		if (restoreFocus && menuId) {
			menuButtonRefs.current.get(menuId)?.focus();
		}
		setOpenMenuId(null);
	};

	const openMenu = (
		menu: CanvasEditorToolbarMenu,
		focus: "first" | "last" = "first",
	) => {
		pendingMenuFocusRef.current = focus;
		setOpenMenuId(menu.id);
		menu.onOpen?.();
	};

	const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		const items = getEnabledMenuItems(event.currentTarget);
		const currentIndex = items.indexOf(
			document.activeElement as HTMLButtonElement,
		);
		const action = resolveCanvasEditorMenuKeyAction(
			event.key,
			currentIndex,
			items.length,
		);
		if (!action) return;
		if (action.type === "close") {
			if (action.restoreFocus) {
				event.preventDefault();
				event.stopPropagation();
				closeMenu();
			} else {
				setOpenMenuId(null);
			}
			return;
		}
		event.preventDefault();
		items[action.index]?.focus();
	};

	const runAndClose = (
		action: (() => void | Promise<void>) | undefined,
		close = true,
	) => {
		if (close) closeMenu();
		if (action) void action();
	};

	return (
		<div ref={rootRef} className={classes?.root} role="toolbar">
			<CanvasEditorToolStrip
				{...toolStrip}
				onToolSelect={(tool) => {
					setOpenMenuId(null);
					toolStrip.onToolSelect(tool);
				}}
			/>
			{items.map((item) => {
				if (item.type === "separator") {
					return (
						<span
							key={item.id}
							aria-hidden="true"
							className={classes?.separator}
						/>
					);
				}
				if (item.type === "color") {
					return (
						<label
							key={item.id}
							className={item.className ?? classes?.color}
							title={item.label}
						>
							<input
								type="color"
								value={item.value}
								aria-label={item.label}
								disabled={item.disabled}
								onChange={(event) => item.onChange(event.target.value)}
							/>
						</label>
					);
				}
				if (item.type === "action") {
					const className = [
						item.className ?? classes?.action,
						item.active ? classes?.actionActive : undefined,
					]
						.filter(Boolean)
						.join(" ");
					return (
						<button
							key={item.id}
							type="button"
							className={className || undefined}
							title={item.label}
							aria-label={item.label}
							data-active={item.active || undefined}
							disabled={item.disabled}
							onClick={() => runAndClose(item.onSelect)}
						>
							{item.icon}
						</button>
					);
				}

				const open = openMenuId === item.id;
				const menuId = `${menuIdPrefix}-${item.id}-menu`;
				const menuButtonClassName = [
					classes?.action,
					open ? classes?.actionActive : undefined,
				]
					.filter(Boolean)
					.join(" ");
				return (
					<div key={item.id} className={classes?.menu}>
						<button
							ref={(element) => {
								if (element) menuButtonRefs.current.set(item.id, element);
								else menuButtonRefs.current.delete(item.id);
							}}
							type="button"
							className={menuButtonClassName || undefined}
							title={item.label}
							aria-label={item.label}
							aria-haspopup="menu"
							aria-expanded={open}
							aria-controls={menuId}
							data-active={open || undefined}
							disabled={item.disabled}
							onClick={() => {
								if (open) closeMenu(false);
								else openMenu(item);
							}}
							onKeyDown={(event) => {
								if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
									return;
								}
								event.preventDefault();
								openMenu(item, event.key === "ArrowDown" ? "first" : "last");
							}}
						>
							{item.icon}
						</button>
						{open && (
							<div
								id={menuId}
								ref={(element) => {
									if (element) menuRefs.current.set(item.id, element);
									else menuRefs.current.delete(item.id);
								}}
								className={
									[item.popoverClassName, classes?.popover]
										.filter(Boolean)
										.join(" ") || undefined
								}
								role="menu"
								aria-label={item.label}
								onKeyDown={handleMenuKeyDown}
							>
								{item.items.map((menuItem) => {
									const mainAction = (
										<button
											key={menuItem.id}
											type="button"
											className={classes?.menuItem}
											role="menuitem"
											tabIndex={-1}
											disabled={menuItem.disabled}
											onClick={() =>
												runAndClose(
													menuItem.onSelect,
													menuItem.closeOnSelect !== false,
												)
											}
										>
											{menuItem.icon}
											<span>{menuItem.label}</span>
											{menuItem.trailingIcon}
										</button>
									);
									return menuItem.secondaryActions?.length ? (
										<div key={menuItem.id} className={classes?.menuRow}>
											{mainAction}
											{menuItem.secondaryActions.map((secondary) => (
												<button
													key={secondary.id}
													type="button"
													className={classes?.secondaryAction}
													role="menuitem"
													tabIndex={-1}
													aria-label={secondary.label}
													title={secondary.label}
													disabled={secondary.disabled}
													onClick={() => runAndClose(secondary.onSelect)}
												>
													{secondary.label}
												</button>
											))}
										</div>
									) : (
										mainAction
									);
								})}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
