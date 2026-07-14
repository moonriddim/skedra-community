import { downloadBlob } from "@/lib/download-blob";
import {
	exportSkedraPdf,
	exportSkedraPng,
	exportSkedraPptx,
	exportSkedraSvg,
} from "@skedra/canvas-io/exporters";

export function exportSVG(
	svgElement: SVGSVGElement,
	filename = "skedra-whiteboard.svg",
) {
	downloadBlob(exportSkedraSvg(svgElement), filename);
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
