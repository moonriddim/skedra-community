import {
	type KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useOptionalCanvasEditorServices } from "./canvas-editor";
import {
	CanvasEditorToolStrip,
	type CanvasEditorToolStripProps,
} from "./canvas-editor-tool-strip";
import {
	CANVAS_EDITOR_TOOL_DEFINITIONS,
	type CanvasEditorToolId,
} from "./editor-contract";

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
	type?: "action" | "label" | "separator" | "color";
	onSelect?: () => void | Promise<void>;
	disabled?: boolean;
	icon?: ReactNode;
	trailingIcon?: ReactNode;
	secondaryActions?: readonly CanvasEditorToolbarMenuItemAction[];
	closeOnSelect?: boolean;
	value?: string;
	onChange?: (value: string) => void;
}

export interface CanvasEditorToolbarMenu {
	type: "menu";
	id: string;
	label: string;
	icon: ReactNode;
	items: readonly CanvasEditorToolbarMenuItem[];
	disabled?: boolean;
	active?: boolean;
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
	track?: string;
	action?: string;
	actionActive?: string;
	separator?: string;
	menu?: string;
	popover?: string;
	menuItem?: string;
	menuLabel?: string;
	menuSeparator?: string;
	menuRow?: string;
	secondaryAction?: string;
	color?: string;
}

export interface CanvasEditorToolbarProps {
	toolStrip: CanvasEditorToolStripProps;
	items?: readonly CanvasEditorToolbarItem[];
	classes?: CanvasEditorToolbarClasses;
	responsive?: CanvasEditorToolbarResponsiveOptions;
}

export interface CanvasEditorToolbarResponsiveOptions {
	/** Container width at which secondary tools/actions move into one menu. */
	breakpoint?: number;
	primaryToolIds?: readonly CanvasEditorToolId[];
	moreLabel: string;
	moreIcon: ReactNode;
	popoverClassName?: string;
	hideToolLock?: boolean;
}

export const DEFAULT_CANVAS_EDITOR_COMPACT_TOOL_IDS = [
	"pan",
	"select",
	"rectangle",
	"arrow",
	"freehand",
	"text",
	"eraser",
] as const satisfies readonly CanvasEditorToolId[];

const MENU_ITEM_SELECTOR = '[role="menuitem"]:not(:disabled)';

function mergeClassNames(...classNames: Array<string | undefined>) {
	return classNames.filter(Boolean).join(" ") || undefined;
}

function getEnabledMenuItems(menu: HTMLDivElement) {
	return Array.from(
		menu.querySelectorAll<HTMLButtonElement>(MENU_ITEM_SELECTOR),
	);
}

function appendMenuSeparator(items: CanvasEditorToolbarMenuItem[], id: string) {
	if (items.length === 0 || items.at(-1)?.type === "separator") return;
	items.push({ id, label: "", type: "separator" });
}

function buildCompactMenuItems(options: {
	toolStrip: CanvasEditorToolStripProps;
	items: readonly CanvasEditorToolbarItem[];
	primaryToolIds: ReadonlySet<CanvasEditorToolId>;
	translate: (key: string, fallback: string) => string;
}) {
	const compactItems: CanvasEditorToolbarMenuItem[] = [];
	const includeTool = options.toolStrip.includeTool ?? (() => true);
	for (const definition of CANVAS_EDITOR_TOOL_DEFINITIONS) {
		if (!includeTool(definition) || options.primaryToolIds.has(definition.id)) {
			continue;
		}
		compactItems.push({
			id: `compact-tool-${definition.id}`,
			label: options.translate(definition.labelKey, definition.label),
			icon: options.toolStrip.renderIcon(definition.id),
			disabled: options.toolStrip.isToolDisabled?.(definition.id),
			onSelect: () => options.toolStrip.onToolSelect(definition.id),
		});
	}

	appendMenuSeparator(compactItems, "compact-tools-separator");
	for (const item of options.items) {
		if (item.type === "separator") {
			appendMenuSeparator(compactItems, `compact-${item.id}`);
			continue;
		}
		if (item.type === "action") {
			compactItems.push({
				id: `compact-${item.id}`,
				label: item.label,
				icon: item.icon,
				disabled: item.disabled,
				onSelect: item.onSelect,
			});
			continue;
		}
		if (item.type === "color") {
			compactItems.push({
				id: `compact-${item.id}`,
				type: "color",
				label: item.label,
				value: item.value,
				onChange: item.onChange,
				disabled: item.disabled,
			});
			continue;
		}
		appendMenuSeparator(compactItems, `compact-${item.id}-start`);
		compactItems.push({
			id: `compact-${item.id}-label`,
			type: "label",
			label: item.label,
		});
		compactItems.push(
			...item.items.map((menuItem) => ({
				...menuItem,
				id: `compact-${item.id}-${menuItem.id}`,
			})),
		);
		appendMenuSeparator(compactItems, `compact-${item.id}-end`);
	}
	while (compactItems.at(-1)?.type === "separator") compactItems.pop();
	return compactItems;
}

function useCanvasEditorCompactToolbar(
	rootRef: React.RefObject<HTMLDivElement | null>,
	responsive: CanvasEditorToolbarResponsiveOptions | undefined,
) {
	const [compact, setCompact] = useState(false);
	const enabled = responsive != null;
	const breakpoint = responsive?.breakpoint ?? 1023;
	useLayoutEffect(() => {
		if (!enabled || !rootRef.current) {
			setCompact(false);
			return;
		}
		const container =
			rootRef.current.closest<HTMLElement>(".canvas-editor") ??
			rootRef.current.parentElement;
		if (!container) return;
		const update = () =>
			setCompact(container.getBoundingClientRect().width <= breakpoint);
		update();
		const observer =
			typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
		observer?.observe(container);
		window.addEventListener("resize", update);
		return () => {
			observer?.disconnect();
			window.removeEventListener("resize", update);
		};
	}, [breakpoint, enabled, rootRef]);
	return compact;
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
	responsive,
}: CanvasEditorToolbarProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const services = useOptionalCanvasEditorServices();
	const compact = useCanvasEditorCompactToolbar(rootRef, responsive);
	const translate =
		toolStrip.translate ??
		services?.translations?.translate ??
		((_key: string, fallback: string) => fallback);
	const primaryToolIds = new Set(
		responsive?.primaryToolIds ?? DEFAULT_CANVAS_EDITOR_COMPACT_TOOL_IDS,
	);
	const baseIncludeTool = toolStrip.includeTool ?? (() => true);
	const resolvedToolStrip = compact
		? {
				...toolStrip,
				includeTool: (
					definition: (typeof CANVAS_EDITOR_TOOL_DEFINITIONS)[number],
				) => baseIncludeTool(definition) && primaryToolIds.has(definition.id),
				toolLocked:
					responsive?.hideToolLock === false ? toolStrip.toolLocked : undefined,
				onToolLockChange:
					responsive?.hideToolLock === false
						? toolStrip.onToolLockChange
						: undefined,
				renderToolLockIcon:
					responsive?.hideToolLock === false
						? toolStrip.renderToolLockIcon
						: undefined,
			}
		: toolStrip;
	const compactMenuItems =
		compact && responsive
			? buildCompactMenuItems({
					toolStrip,
					items,
					primaryToolIds,
					translate,
				})
			: [];
	const resolvedItems: readonly CanvasEditorToolbarItem[] =
		compact && responsive
			? [
					{
						type: "menu",
						id: "compact-more",
						label: responsive.moreLabel,
						icon: responsive.moreIcon,
						items: compactMenuItems,
						active:
							(!primaryToolIds.has(toolStrip.activeTool) &&
								baseIncludeTool(
									CANVAS_EDITOR_TOOL_DEFINITIONS.find(
										(definition) => definition.id === toolStrip.activeTool,
									) ?? CANVAS_EDITOR_TOOL_DEFINITIONS[0],
								)) ||
							items.some(
								(item) =>
									(item.type === "action" || item.type === "menu") &&
									item.active,
							),
						popoverClassName: responsive.popoverClassName,
					},
				]
			: items;
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
	const activeMenu = resolvedItems.find(
		(item): item is CanvasEditorToolbarMenu =>
			item.type === "menu" && item.id === openMenuId,
	);

	const renderMenuItems = (menu: CanvasEditorToolbarMenu) =>
		menu.items.map((menuItem) => {
			if (menuItem.type === "label") {
				return (
					<div
						key={menuItem.id}
						className={mergeClassNames(
							"canvas-editor__toolbar-menu-label",
							classes?.menuLabel,
						)}
					>
						{menuItem.label}
					</div>
				);
			}
			if (menuItem.type === "separator") {
				return (
					<hr
						key={menuItem.id}
						className={mergeClassNames(
							"canvas-editor__toolbar-menu-separator",
							classes?.menuSeparator,
						)}
					/>
				);
			}
			if (menuItem.type === "color") {
				return (
					<label
						key={menuItem.id}
						className="canvas-editor__toolbar-menu-color"
					>
						<span>{menuItem.label}</span>
						<input
							type="color"
							value={menuItem.value}
							aria-label={menuItem.label}
							disabled={menuItem.disabled}
							onChange={(event) => menuItem.onChange?.(event.target.value)}
						/>
					</label>
				);
			}
			const mainAction = (
				<button
					key={menuItem.id}
					type="button"
					className={mergeClassNames(
						"canvas-editor__toolbar-menu-item",
						classes?.menuItem,
					)}
					role="menuitem"
					tabIndex={-1}
					disabled={menuItem.disabled}
					onClick={() =>
						runAndClose(menuItem.onSelect, menuItem.closeOnSelect !== false)
					}
				>
					{menuItem.icon}
					<span>{menuItem.label}</span>
					{menuItem.trailingIcon}
				</button>
			);
			return menuItem.secondaryActions?.length ? (
				<div
					key={menuItem.id}
					className={mergeClassNames(
						"canvas-editor__toolbar-menu-row",
						classes?.menuRow,
					)}
				>
					{mainAction}
					{menuItem.secondaryActions.map((secondary) => (
						<button
							key={secondary.id}
							type="button"
							className={mergeClassNames(
								"canvas-editor__toolbar-secondary-action",
								classes?.secondaryAction,
							)}
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
		});

	return (
		<div
			ref={rootRef}
			className={mergeClassNames("canvas-editor__toolbar", classes?.root)}
			data-menu-open={activeMenu ? "true" : undefined}
			data-compact={compact || undefined}
			role="toolbar"
		>
			<div
				className={mergeClassNames(
					"canvas-editor__toolbar-track",
					classes?.track,
				)}
				onWheel={(event) => {
					const track = event.currentTarget;
					if (
						track.scrollWidth <= track.clientWidth ||
						Math.abs(event.deltaY) <= Math.abs(event.deltaX)
					) {
						return;
					}
					event.preventDefault();
					event.stopPropagation();
					track.scrollLeft += event.deltaY;
				}}
			>
				<CanvasEditorToolStrip
					{...resolvedToolStrip}
					onToolSelect={(tool) => {
						setOpenMenuId(null);
						toolStrip.onToolSelect(tool);
					}}
				/>
				{resolvedItems.map((item) => {
					if (item.type === "separator") {
						return (
							<span
								key={item.id}
								aria-hidden="true"
								className={mergeClassNames(
									"canvas-editor__toolbar-separator",
									classes?.separator,
								)}
							/>
						);
					}
					if (item.type === "color") {
						return (
							<label
								key={item.id}
								className={mergeClassNames(
									"canvas-editor__toolbar-color",
									item.className ?? classes?.color,
								)}
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
						const className = mergeClassNames(
							"canvas-editor__toolbar-action",
							item.className ?? classes?.action,
							item.active ? classes?.actionActive : undefined,
						);
						return (
							<button
								key={item.id}
								type="button"
								className={className}
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
					const menuButtonClassName = mergeClassNames(
						"canvas-editor__toolbar-action",
						classes?.action,
						open || item.active ? classes?.actionActive : undefined,
					);
					return (
						<div
							key={item.id}
							className={mergeClassNames(
								"canvas-editor__toolbar-menu",
								classes?.menu,
							)}
						>
							<button
								ref={(element) => {
									if (element) menuButtonRefs.current.set(item.id, element);
									else menuButtonRefs.current.delete(item.id);
								}}
								type="button"
								className={menuButtonClassName}
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
						</div>
					);
				})}
			</div>
			{activeMenu && (
				<div
					id={`${menuIdPrefix}-${activeMenu.id}-menu`}
					ref={(element) => {
						if (element) menuRefs.current.set(activeMenu.id, element);
						else menuRefs.current.delete(activeMenu.id);
					}}
					className={mergeClassNames(
						"canvas-editor__toolbar-popover",
						activeMenu.popoverClassName,
						classes?.popover,
					)}
					role="menu"
					aria-label={activeMenu.label}
					onKeyDown={handleMenuKeyDown}
				>
					{renderMenuItems(activeMenu)}
				</div>
			)}
		</div>
	);
}
