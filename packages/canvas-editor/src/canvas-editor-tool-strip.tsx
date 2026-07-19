import type { ArrowMode, CanvasPathDrawMode } from "@skedra/canvas-core";
import { Fragment, type ReactNode } from "react";
import { useOptionalCanvasEditorServices } from "./canvas-editor";
import {
	CANVAS_EDITOR_TOOL_DEFINITIONS,
	type CanvasEditorToolDefinition,
	type CanvasEditorToolId,
} from "./editor-contract";
import {
	CANVAS_PATH_DRAW_MODE_OPTIONS,
	CANVAS_PATH_MODE_OPTIONS,
	resolveCanvasEditorPathMode,
} from "./path-editor-controller";

export interface CanvasEditorToolStripClasses {
	button?: string;
	divider?: string;
	pathSelect?: string;
}

export interface CanvasEditorToolStripProps {
	activeTool: CanvasEditorToolId;
	onToolSelect: (tool: CanvasEditorToolId) => void;
	renderIcon: (tool: CanvasEditorToolId) => ReactNode;
	translate?: (key: string, fallback: string) => string;
	isToolDisabled?: (tool: CanvasEditorToolId) => boolean;
	includeTool?: (definition: CanvasEditorToolDefinition) => boolean;
	classes?: CanvasEditorToolStripClasses;
	getButtonClassName?: (tool: CanvasEditorToolId, active: boolean) => string;
	toolLocked?: boolean;
	onToolLockChange?: (locked: boolean) => void;
	renderToolLockIcon?: (locked: boolean) => ReactNode;
	pathDrawMode?: CanvasPathDrawMode;
	pathMode?: ArrowMode;
	onPathDrawModeChange?: (mode: CanvasPathDrawMode) => void;
	onPathModeChange?: (mode: ArrowMode) => void;
}

const GROUP_ORDER: CanvasEditorToolDefinition["group"][] = [
	"navigation",
	"drawing",
	"utility",
	"structured",
];

function mergeClassNames(...classNames: Array<string | undefined>) {
	return classNames.filter(Boolean).join(" ") || undefined;
}

export function CanvasEditorToolStrip({
	activeTool,
	onToolSelect,
	renderIcon,
	translate,
	isToolDisabled = () => false,
	includeTool = () => true,
	classes,
	getButtonClassName,
	toolLocked,
	onToolLockChange,
	renderToolLockIcon,
	pathDrawMode,
	pathMode,
	onPathDrawModeChange,
	onPathModeChange,
}: CanvasEditorToolStripProps) {
	const services = useOptionalCanvasEditorServices();
	const t =
		translate ??
		services?.translations?.translate ??
		((_key, fallback) => fallback);
	const groups = GROUP_ORDER.map((group) => ({
		group,
		tools: CANVAS_EDITOR_TOOL_DEFINITIONS.filter(
			(definition) => definition.group === group && includeTool(definition),
		),
	})).filter(({ tools }) => tools.length > 0);
	const toolLockLabel = toolLocked
		? t("canvas.toolbar.unlockTool", "Unlock tool")
		: t("canvas.toolbar.lockTool", "Lock tool");
	const toolLockTitle = `${toolLockLabel} (Q)`;

	return (
		<>
			{toolLocked !== undefined && onToolLockChange && renderToolLockIcon && (
				<>
					<button
						type="button"
						className={mergeClassNames(
							"canvas-editor__toolbar-action",
							getButtonClassName?.(activeTool, toolLocked) ?? classes?.button,
						)}
						data-active={toolLocked}
						data-canvas-toolbar-interactive="true"
						title={toolLockTitle}
						aria-label={toolLockTitle}
						onClick={() => onToolLockChange(!toolLocked)}
					>
						<span className="canvas-editor__toolbar-icon">
							{renderToolLockIcon(toolLocked)}
						</span>
					</button>
					<span
						aria-hidden="true"
						className={mergeClassNames(
							"canvas-editor__toolbar-separator",
							classes?.divider,
						)}
					/>
				</>
			)}
			{groups.map(({ group, tools }, groupIndex) => (
				<Fragment key={group}>
					{groupIndex > 0 && (
						<span
							aria-hidden="true"
							className={mergeClassNames(
								"canvas-editor__toolbar-separator",
								classes?.divider,
							)}
						/>
					)}
					{tools.map((definition) => {
						const label = t(definition.labelKey, definition.label);
						const title = definition.shortcut
							? `${label} (${definition.shortcut})`
							: label;
						return (
							<button
								key={definition.id}
								type="button"
								className={mergeClassNames(
									"canvas-editor__toolbar-action",
									getButtonClassName?.(
										definition.id,
										activeTool === definition.id,
									) ?? classes?.button,
								)}
								data-active={activeTool === definition.id}
								data-canvas-toolbar-interactive="true"
								title={title}
								aria-label={label}
								disabled={isToolDisabled(definition.id)}
								onClick={() => onToolSelect(definition.id)}
							>
								<span className="canvas-editor__toolbar-icon">
									{renderIcon(definition.id)}
								</span>
							</button>
						);
					})}
				</Fragment>
			))}

			{activeTool === "cloud" && pathDrawMode && onPathDrawModeChange && (
				<>
					<span
						aria-hidden="true"
						className={mergeClassNames(
							"canvas-editor__toolbar-separator",
							classes?.divider,
						)}
					/>
					<select
						className={mergeClassNames(
							"canvas-editor__toolbar-path-select",
							classes?.pathSelect,
						)}
						value={pathDrawMode}
						aria-label={t(
							"canvas.properties.cloudDrawMode",
							"Cloud drawing mode",
						)}
						title={t("canvas.properties.cloudDrawMode", "Cloud drawing mode")}
						onChange={(event) =>
							onPathDrawModeChange(event.target.value as CanvasPathDrawMode)
						}
					>
						<option value="normal">
							{t("canvas.properties.cloudDrawRectangle", "Rectangle")}
						</option>
						<option value="multi">
							{t("canvas.properties.cloudDrawPoints", "Point by point")}
						</option>
					</select>
				</>
			)}

			{(activeTool === "line" || activeTool === "arrow") &&
				pathDrawMode &&
				pathMode &&
				onPathDrawModeChange &&
				onPathModeChange && (
					<>
						<span
							aria-hidden="true"
							className={mergeClassNames(
								"canvas-editor__toolbar-separator",
								classes?.divider,
							)}
						/>
						<select
							className={mergeClassNames(
								"canvas-editor__toolbar-path-select",
								classes?.pathSelect,
							)}
							value={pathDrawMode}
							aria-label={t("canvas.properties.pathDrawMode", "Path draw mode")}
							title={t("canvas.properties.pathDrawMode", "Path draw mode")}
							onChange={(event) =>
								onPathDrawModeChange(event.target.value as CanvasPathDrawMode)
							}
						>
							{CANVAS_PATH_DRAW_MODE_OPTIONS.map((mode) => (
								<option key={mode} value={mode}>
									{mode === "normal"
										? t("canvas.properties.pathDrawNormal", "Single segment")
										: t("canvas.properties.pathDrawMulti", "Multi-line")}
								</option>
							))}
						</select>
						<select
							className={mergeClassNames(
								"canvas-editor__toolbar-path-select",
								classes?.pathSelect,
							)}
							value={resolveCanvasEditorPathMode(pathMode)}
							aria-label={t("canvas.properties.pathStyle", "Path style")}
							title={t("canvas.properties.pathStyle", "Path style")}
							onChange={(event) =>
								onPathModeChange(event.target.value as ArrowMode)
							}
						>
							{CANVAS_PATH_MODE_OPTIONS.map((mode) => (
								<option key={mode} value={mode}>
									{mode === "straight"
										? t("canvas.properties.cornered", "Corners")
										: t("canvas.properties.curve", "Curves")}
								</option>
							))}
						</select>
					</>
				)}
		</>
	);
}
