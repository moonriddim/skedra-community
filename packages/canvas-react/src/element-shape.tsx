/**
 * SVG-Rendering fuer ein einzelnes Canvas-Element (alle Typen).
 */

import {
	getCloudSvgPath,
	getEffectiveCornerRadius,
	getImageRenderGeometry,
	getLinePath,
	getPyramidDividerSegments,
	getTrianglePointsAttribute,
	smoothPath,
} from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { memo } from "react";
import { FrameElementShape } from "./frame-shapes";
import { KanbanCardShape } from "./kanban-card-shape";
import {
	ArrowShape,
	PathTextLabel,
	RectText,
	TextBlock,
} from "./path-and-text-shapes";
import { dashArray, useRoughShapeLayers } from "./render-helpers";
import { useCanvasRendererConfig } from "./renderer-config";
import { RoughGeometryLayers, RoughSvgMarkup } from "./rough-svg-markup";
import { StickyNoteShape } from "./sticky-note-shape";

export const ElementShape = memo(function ElementShape({
	element: el,
	isEditingText,
	resolveAssetUrl,
}: {
	element: CanvasElement;
	isEditingText: boolean;
	resolveAssetUrl?: (src: string) => string;
}) {
	const { svgIdPrefix } = useCanvasRendererConfig();
	const commonProps = {
		"data-element-id": el.id,
		opacity: el.opacity / 100,
	};

	const dash = dashArray(el.strokeStyle, el.strokeWidth);

	/* Transformation (Rotation + Flip) */
	const cx = el.x + el.width / 2;
	const cy = el.y + el.height / 2;
	const transforms: string[] = [];
	if (el.rotation) transforms.push(`rotate(${el.rotation} ${cx} ${cy})`);
	if (el.flipX || el.flipY) {
		transforms.push(
			`translate(${cx}, ${cy}) scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1}) translate(${-cx}, ${-cy})`,
		);
	}
	const transform = transforms.length > 0 ? transforms.join(" ") : undefined;

	const roughLayers = useRoughShapeLayers(el);
	const roughLineHtml =
		roughLayers && !roughLayers.fillHtml ? roughLayers.strokeHtml : null;

	switch (el.type) {
		case "rectangle": {
			const isGanttScrollThumb =
				el.customData?.ganttRole === "canvas-scroll-thumb";
			if (el.customData?.skedraType === "kanban-card") {
				return (
					<KanbanCardShape
						el={el}
						transform={transform}
						commonProps={commonProps}
						resolveAssetUrl={resolveAssetUrl}
					/>
				);
			}
			if (el.customData?.skedraType === "sticky-note") {
				return (
					<StickyNoteShape
						el={el}
						transform={transform}
						commonProps={commonProps}
						isEditingText={isEditingText}
					/>
				);
			}
			return (
				<g
					transform={transform}
					{...commonProps}
					data-gantt-scroll-thumb={isGanttScrollThumb ? "true" : undefined}
					style={isGanttScrollThumb ? { cursor: "grab" } : undefined}
				>
					{roughLayers ? (
						roughLayers.fillHtml ? (
							<RoughGeometryLayers el={el} layers={roughLayers} dash={dash} />
						) : (
							<RoughSvgMarkup html={roughLayers.strokeHtml ?? ""} dash={dash} />
						)
					) : (
						<rect
							x={el.x}
							y={el.y}
							width={Math.max(1, el.width)}
							height={Math.max(1, el.height)}
							rx={getEffectiveCornerRadius(el)}
							ry={getEffectiveCornerRadius(el)}
							fill={el.fill || "transparent"}
							stroke={el.stroke}
							strokeWidth={el.strokeWidth}
							strokeDasharray={dash}
						/>
					)}
					{!isEditingText && <RectText el={el} />}
				</g>
			);
		}

		case "diamond": {
			const dCx = el.x + el.width / 2;
			const dCy = el.y + el.height / 2;
			const dPoints = `${dCx},${el.y} ${el.x + el.width},${dCy} ${dCx},${el.y + el.height} ${el.x},${dCy}`;
			return (
				<g transform={transform} {...commonProps}>
					{roughLayers ? (
						roughLayers.fillHtml ? (
							<RoughGeometryLayers el={el} layers={roughLayers} dash={dash} />
						) : (
							<RoughSvgMarkup html={roughLayers.strokeHtml ?? ""} dash={dash} />
						)
					) : (
						<polygon
							points={dPoints}
							fill={el.fill || "transparent"}
							stroke={el.stroke}
							strokeWidth={el.strokeWidth}
							strokeDasharray={dash}
							strokeLinejoin="round"
						/>
					)}
					{!isEditingText && <RectText el={el} />}
				</g>
			);
		}

		case "triangle": {
			const trianglePoints = getTrianglePointsAttribute(el);
			const dividers = getPyramidDividerSegments(el, el.pyramidSections);
			return (
				<g transform={transform} {...commonProps}>
					{roughLayers ? (
						roughLayers.fillHtml ? (
							<RoughGeometryLayers el={el} layers={roughLayers} dash={dash} />
						) : (
							<RoughSvgMarkup html={roughLayers.strokeHtml ?? ""} dash={dash} />
						)
					) : (
						<polygon
							points={trianglePoints}
							fill={el.fill || "transparent"}
							stroke={el.stroke}
							strokeWidth={el.strokeWidth}
							strokeDasharray={dash}
							strokeLinejoin="round"
						/>
					)}
					{roughLayers?.detailHtml ? (
						<RoughSvgMarkup html={roughLayers.detailHtml} dash={dash} />
					) : (
						dividers.map((divider, index) => (
							<line
								key={`${el.id}-pyramid-divider-${index}`}
								x1={divider.x1}
								y1={divider.y1}
								x2={divider.x2}
								y2={divider.y2}
								fill="none"
								stroke={el.stroke}
								strokeWidth={el.strokeWidth}
								strokeDasharray={dash}
								strokeLinecap="round"
							/>
						))
					)}
					{!isEditingText && <RectText el={el} />}
				</g>
			);
		}

		case "cloud":
			return (
				<g transform={transform} {...commonProps}>
					{roughLayers ? (
						roughLayers.fillHtml ? (
							<RoughGeometryLayers el={el} layers={roughLayers} dash={dash} />
						) : (
							<RoughSvgMarkup html={roughLayers.strokeHtml ?? ""} dash={dash} />
						)
					) : (
						<path
							d={getCloudSvgPath(el)}
							fill={el.fill || "transparent"}
							stroke={el.stroke}
							strokeWidth={el.strokeWidth}
							strokeDasharray={dash}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					)}
					{!isEditingText && <RectText el={el} />}
				</g>
			);

		case "ellipse":
			return (
				<g transform={transform} {...commonProps}>
					{roughLayers ? (
						roughLayers.fillHtml ? (
							<RoughGeometryLayers el={el} layers={roughLayers} dash={dash} />
						) : (
							<RoughSvgMarkup html={roughLayers.strokeHtml ?? ""} dash={dash} />
						)
					) : (
						<ellipse
							cx={el.x + el.width / 2}
							cy={el.y + el.height / 2}
							rx={Math.max(1, el.width / 2)}
							ry={Math.max(1, el.height / 2)}
							fill={el.fill || "transparent"}
							stroke={el.stroke}
							strokeWidth={el.strokeWidth}
							strokeDasharray={dash}
						/>
					)}
					{!isEditingText && el.text && <RectText el={el} />}
				</g>
			);

		case "text": {
			const isPreview = el.id === "__preview";
			return (
				<g transform={transform} {...commonProps}>
					<rect
						x={el.x}
						y={el.y}
						width={Math.max(20, el.width)}
						height={Math.max(20, el.height)}
						fill={isPreview ? "var(--primary, #3b82f6)" : "transparent"}
						fillOpacity={isPreview ? 0.06 : 0}
						stroke={isPreview ? "var(--primary, #3b82f6)" : "none"}
						strokeWidth={isPreview ? 1.5 : 0}
						strokeDasharray={isPreview ? "6 3" : undefined}
						rx={3}
					/>
					{!isPreview && !isEditingText && <TextBlock el={el} />}
				</g>
			);
		}

		case "image": {
			const geometry = getImageRenderGeometry(el);
			if (!geometry.src) return null;
			const clipId = geometry.clipId
				? `${svgIdPrefix}-${geometry.clipId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
				: null;
			const imageSrc = resolveAssetUrl?.(geometry.src) ?? geometry.src;
			return (
				<g transform={transform} {...commonProps}>
					{clipId && geometry.clipRect && (
						<defs>
							<clipPath id={clipId}>
								<rect
									x={geometry.clipRect.x}
									y={geometry.clipRect.y}
									width={geometry.clipRect.width}
									height={geometry.clipRect.height}
								/>
							</clipPath>
						</defs>
					)}
					<rect
						x={geometry.x}
						y={geometry.y}
						width={Math.max(1, geometry.width)}
						height={Math.max(1, geometry.height)}
						fill="var(--card, #ffffff)"
						stroke={el.stroke || "#00000020"}
						strokeWidth={el.strokeWidth ?? 1}
						rx={8}
					/>
					<image
						href={imageSrc}
						x={geometry.imageX}
						y={geometry.imageY}
						width={Math.max(1, geometry.imageWidth)}
						height={Math.max(1, geometry.imageHeight)}
						preserveAspectRatio="xMidYMid meet"
						clipPath={clipId ? `url(#${clipId})` : undefined}
					/>
				</g>
			);
		}

		case "line": {
			if (!el.points || el.points.length < 2) return null;
			const textPathId = `skedra-line-text-${el.id}`;
			if (roughLayers) {
				return (
					<g transform={transform} {...commonProps}>
						{roughLayers.fillHtml ? (
							<RoughGeometryLayers el={el} layers={roughLayers} dash={dash} />
						) : (
							<RoughSvgMarkup html={roughLayers.strokeHtml ?? ""} dash={dash} />
						)}
						{!isEditingText && (
							<PathTextLabel el={el} pathId={textPathId} mode={el.arrowMode} />
						)}
					</g>
				);
			}
			const dLine = getLinePath(el.points, el.arrowMode, el.closed === true);
			return (
				<g transform={transform} {...commonProps}>
					<path
						d={dLine}
						fill={el.closed ? el.fill || "transparent" : "none"}
						stroke={el.stroke}
						strokeWidth={el.strokeWidth}
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeDasharray={dash}
						transform={`translate(${el.x}, ${el.y})`}
					/>
					{!isEditingText && (
						<PathTextLabel el={el} pathId={textPathId} mode={el.arrowMode} />
					)}
				</g>
			);
		}

		case "arrow": {
			if (!el.points || el.points.length < 2) return null;
			return (
				<ArrowShape
					el={el}
					transform={transform}
					commonProps={commonProps}
					dash={dash}
					isRough={roughLineHtml != null}
					roughHtml={roughLineHtml}
					isEditingText={isEditingText}
				/>
			);
		}

		case "freehand": {
			if (!el.points || el.points.length < 2) return null;
			if (roughLineHtml) {
				return (
					<g transform={transform} {...commonProps}>
						<RoughSvgMarkup html={roughLineHtml} dash={dash} />
					</g>
				);
			}
			const d = smoothPath(el.points);
			return (
				<g transform={transform} {...commonProps}>
					<path
						d={d}
						fill="none"
						stroke={el.stroke}
						strokeWidth={el.strokeWidth}
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeDasharray={dash}
						transform={`translate(${el.x}, ${el.y})`}
					/>
				</g>
			);
		}

		case "frame":
			return (
				<FrameElementShape
					el={el}
					transform={transform}
					commonProps={commonProps}
					isEditingText={isEditingText}
					resolveAssetUrl={resolveAssetUrl}
				/>
			);

		default:
			return null;
	}
});
