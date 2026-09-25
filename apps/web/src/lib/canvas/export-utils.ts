import { downloadBlob } from "@/lib/download-blob";
import type { CanvasElement } from "@skedra/canvas-core";
import {
	exportSkedraFrame,
	exportSkedraPdf,
	exportSkedraPng,
	exportSkedraPptx,
	exportSkedraSvgWithImages,
	getSkedraFrameExportFilename,
} from "@skedra/canvas-io/exporters";

export async function exportSVG(
	svgElement: SVGSVGElement,
	filename = "skedra-whiteboard.svg",
) {
	// Bilder einbetten: blob:-URLs der Sitzung wären in der Datei ungültig.
	downloadBlob(await exportSkedraSvgWithImages(svgElement), filename);
}

export async function exportPNG(
	svgElement: SVGSVGElement,
	filename = "skedra-whiteboard.png",
) {
	downloadBlob(await exportSkedraPng(svgElement), filename);
}

export async function exportPDF(
	svgElement: SVGSVGElement,
	filename = "skedra-whiteboard.pdf",
) {
	downloadBlob(await exportSkedraPdf(svgElement), filename);
}

export async function exportPPTX(
	svgElement: SVGSVGElement,
	filename = "skedra-whiteboard.pptx",
) {
	downloadBlob(await exportSkedraPptx(svgElement), filename);
}

/** Exportiert einen einzelnen Frame (geclippt, ohne Frame-Rahmen) als SVG. */
export async function exportFrameSVG(
	svgElement: SVGSVGElement,
	frame: CanvasElement,
	filename?: string,
) {
	downloadBlob(
		await exportSkedraFrame(svgElement, frame, "svg"),
		filename ?? getSkedraFrameExportFilename(frame, "svg"),
	);
}

/** Exportiert einen einzelnen Frame (geclippt, ohne Frame-Rahmen) als PNG. */
export async function exportFramePNG(
	svgElement: SVGSVGElement,
	frame: CanvasElement,
	filename?: string,
) {
	downloadBlob(
		await exportSkedraFrame(svgElement, frame, "png"),
		filename ?? getSkedraFrameExportFilename(frame, "png"),
	);
}
