import { getEffectiveCornerRadius } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import type { RoughShapeLayers } from "./render-helpers";

export function RoughSvgMarkup({
	html,
	dash,
}: { html: string; dash?: string | undefined }) {
	return (
		// biome-ignore lint/security/noDangerouslySetInnerHtml: rough.js generates SVG markup from local element geometry.
		<g dangerouslySetInnerHTML={{ __html: html }} strokeDasharray={dash} />
	);
}

/** Clip-Form fuer Musterfuellung — haelt Punkte/Schraffur innerhalb der Geometrie */
function GeometryClipShape({ el }: { el: CanvasElement }) {
	const w = Math.max(1, el.width);
	const h = Math.max(1, el.height);

	switch (el.type) {
		case "rectangle":
			return (
				<rect
					x={el.x}
					y={el.y}
					width={w}
					height={h}
					rx={getEffectiveCornerRadius(el)}
					ry={getEffectiveCornerRadius(el)}
				/>
			);
		case "ellipse":
			return (
				<ellipse cx={el.x + w / 2} cy={el.y + h / 2} rx={w / 2} ry={h / 2} />
			);
		case "diamond": {
			const cx = el.x + w / 2;
			const cy = el.y + h / 2;
			return (
				<polygon
					points={`${cx},${el.y} ${el.x + w},${cy} ${cx},${el.y + h} ${el.x},${cy}`}
				/>
			);
		}
		default:
			return null;
	}
}

/** Exakter SVG-Strich mit korrekten Ecken (Sauberkeit exakt oder als Kanten-Fallback) */
function GeometryExactStroke({
	el,
	dash,
}: {
	el: CanvasElement;
	dash: string | undefined;
}) {
	const w = Math.max(1, el.width);
	const h = Math.max(1, el.height);
	const strokeProps = {
		fill: "none" as const,
		stroke: el.stroke,
		strokeWidth: el.strokeWidth,
		strokeDasharray: dash,
	};

	switch (el.type) {
		case "rectangle":
			return (
				<rect
					x={el.x}
					y={el.y}
					width={w}
					height={h}
					rx={getEffectiveCornerRadius(el)}
					ry={getEffectiveCornerRadius(el)}
					{...strokeProps}
				/>
			);
		case "ellipse":
			return (
				<ellipse
					cx={el.x + w / 2}
					cy={el.y + h / 2}
					rx={w / 2}
					ry={h / 2}
					{...strokeProps}
				/>
			);
		case "diamond": {
			const cx = el.x + w / 2;
			const cy = el.y + h / 2;
			return (
				<polygon
					points={`${cx},${el.y} ${el.x + w},${cy} ${cx},${el.y + h} ${el.x},${cy}`}
					strokeLinejoin="round"
					{...strokeProps}
				/>
			);
		}
		default:
			return null;
	}
}

/** Rough.js in getrennten Fuell- (geclippt) und Strich-Layern fuer Geometrie-Formen */
export function RoughGeometryLayers({
	el,
	layers,
	dash,
}: {
	el: CanvasElement;
	layers: RoughShapeLayers;
	dash: string | undefined;
}) {
	const clipId = `rough-fill-clip-${el.id}`;

	return (
		<>
			{layers.fillHtml && (
				<>
					<defs>
						<clipPath id={clipId}>
							<GeometryClipShape el={el} />
						</clipPath>
					</defs>
					<g clipPath={`url(#${clipId})`}>
						<RoughSvgMarkup html={layers.fillHtml} />
					</g>
				</>
			)}
			{layers.strokeHtml && (
				<RoughSvgMarkup html={layers.strokeHtml} dash={dash} />
			)}
			{layers.svgStrokeFallback && <GeometryExactStroke el={el} dash={dash} />}
		</>
	);
}
