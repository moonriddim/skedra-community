import {
	exportSkedraPdf as exportSharedPdf,
	exportSkedraPng as exportSharedPng,
	exportSkedraPptx as exportSharedPptx,
	exportSkedraSvg as exportSharedSvg,
	exportSkedraVisual as exportSharedVisual,
	measureSkedraExportBounds as measureSharedExportBounds,
} from "@skedra/canvas-io/exporters";

export type SkedraVisualExportFormat = "svg" | "png" | "pdf" | "pptx";

export interface SkedraVisualExportOptions {
	padding?: number;
	background?: string;
	scale?: number;
}

export function exportSkedraSvg(
	svgElement: SVGSVGElement,
	options: SkedraVisualExportOptions = {},
): Blob {
	return exportSharedSvg(svgElement, options);
}

export function exportSkedraPng(
	svgElement: SVGSVGElement,
	options: SkedraVisualExportOptions = {},
): Promise<Blob> {
	return exportSharedPng(svgElement, options);
}

export function exportSkedraPdf(
	svgElement: SVGSVGElement,
	options: SkedraVisualExportOptions = {},
): Promise<Blob> {
	return exportSharedPdf(svgElement, options);
}

export function exportSkedraPptx(
	svgElement: SVGSVGElement,
	options: SkedraVisualExportOptions = {},
): Promise<Blob> {
	return exportSharedPptx(svgElement, options);
}

export function exportSkedraVisual(
	svgElement: SVGSVGElement,
	format: SkedraVisualExportFormat,
	options?: SkedraVisualExportOptions,
): Promise<Blob> {
	return exportSharedVisual(svgElement, format, options);
}

export function measureSkedraExportBounds(sourceLayer: SVGGElement) {
	return measureSharedExportBounds(sourceLayer);
}
