/**
 * Export-Utilities: SVG und PNG Export des Canvas.
 * Klont den SVG-DOM und rendert ihn als Datei.
 */

import { downloadBlob } from "@/lib/download-blob";

/**
 * Exportiert das Canvas als SVG-Datei.
 * Klont den SVG-Node, entfernt UI-Elemente, und triggered einen Download.
 */
export function exportSVG(
	svgElement: SVGSVGElement,
	filename = "skedra-whiteboard.svg",
) {
	const clone = svgElement.cloneNode(true) as SVGSVGElement;

	/* UI-Elemente entfernen (Handles, Grid, Selection-Box) */
	const toRemove = clone.querySelectorAll(".selection-handles, [data-ui-only]");
	for (const el of toRemove) {
		el.remove();
	}

	/* ViewBox anpassen auf sichtbaren Bereich */
	const bbox = getContentBBox(svgElement);
	if (bbox) {
		const padding = 40;
		clone.setAttribute(
			"viewBox",
			`${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`,
		);
		clone.setAttribute("width", String(bbox.width + padding * 2));
		clone.setAttribute("height", String(bbox.height + padding * 2));
	}

	const serializer = new XMLSerializer();
	const svgStr = serializer.serializeToString(clone);
	const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
	downloadBlob(blob, filename);
}

/**
 * Exportiert das Canvas als PNG-Datei.
 * Rendert SVG auf ein OffscreenCanvas und erzeugt ein PNG.
 */
export async function exportPNG(
	svgElement: SVGSVGElement,
	filename = "skedra-whiteboard.png",
) {
	const { canvas, width, height } = await rasterizeSVG(svgElement, "png");

	return new Promise<void>((resolve) => {
		canvas.toBlob((blob) => {
			if (blob) downloadBlob(blob, filename);
			resolve();
		}, "image/png");
	});
}

export async function exportPDF(
	svgElement: SVGSVGElement,
	filename = "skedra-whiteboard.pdf",
) {
	const { canvas, width, height } = await rasterizeSVG(svgElement, "pdf");
	const imageBlob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/jpeg", 0.92),
	);
	if (!imageBlob) return;

	const jpegBytes = new Uint8Array(await imageBlob.arrayBuffer());
	const pageWidth = Math.max(1, width * 0.75);
	const pageHeight = Math.max(1, height * 0.75);
	const content = `q ${pageWidth.toFixed(2)} 0 0 ${pageHeight.toFixed(2)} 0 0 cm /Im0 Do Q`;
	const pdfBytes = buildImagePdf({
		imageBytes: jpegBytes,
		width: pageWidth,
		height: pageHeight,
		content,
	});
	downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), filename);
}

export async function exportPPTX(
	svgElement: SVGSVGElement,
	filename = "skedra-whiteboard.pptx",
) {
	const { canvas } = await rasterizeSVG(svgElement, "pptx");
	const imageBlob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/png"),
	);
	if (!imageBlob) return;

	const pngBytes = new Uint8Array(await imageBlob.arrayBuffer());
	const pptxBytes = buildSingleSlidePptx(pngBytes);
	downloadBlob(
		new Blob([pptxBytes], {
			type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		}),
		filename,
	);
}

async function rasterizeSVG(
	svgElement: SVGSVGElement,
	_exportKind: "png" | "pdf" | "pptx",
) {
	const clone = svgElement.cloneNode(true) as SVGSVGElement;

	const toRemove = clone.querySelectorAll(".selection-handles, [data-ui-only]");
	for (const el of toRemove) {
		el.remove();
	}

	const bbox = getContentBBox(svgElement);
	const padding = 40;
	const w = bbox ? bbox.width + padding * 2 : 1920;
	const h = bbox ? bbox.height + padding * 2 : 1080;

	if (bbox) {
		clone.setAttribute(
			"viewBox",
			`${bbox.x - padding} ${bbox.y - padding} ${w} ${h}`,
		);
	}
	clone.setAttribute("width", String(w));
	clone.setAttribute("height", String(h));

	const serializer = new XMLSerializer();
	const svgStr = serializer.serializeToString(clone);

	const img = new Image();
	const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
	const url = URL.createObjectURL(svgBlob);

	return new Promise<{
		canvas: HTMLCanvasElement;
		width: number;
		height: number;
	}>((resolve) => {
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = w * 2; /* 2x fuer Retina */
			canvas.height = h * 2;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				URL.revokeObjectURL(url);
				resolve({ canvas, width: w, height: h });
				return;
			}
			ctx.scale(2, 2);
			ctx.fillStyle = resolveCanvasBackground(svgElement);
			ctx.fillRect(0, 0, w, h);
			ctx.drawImage(img, 0, 0, w, h);
			URL.revokeObjectURL(url);

			resolve({ canvas, width: w * 2, height: h * 2 });
		};
		img.src = url;
	});
}

function getContentBBox(svg: SVGSVGElement): DOMRect | null {
	const elementsLayer = svg.querySelector(".elements-layer");
	if (!elementsLayer) return null;
	const bbox = (elementsLayer as SVGGElement).getBBox();
	if (bbox.width === 0 && bbox.height === 0) return null;
	return bbox;
}

function resolveCanvasBackground(svgElement: SVGSVGElement) {
	let element: Element | null =
		svgElement.closest(".skedra-canvas") ?? svgElement.parentElement;

	while (element) {
		if (element instanceof HTMLElement || element instanceof SVGElement) {
			const color = getComputedStyle(element).backgroundColor;
			if (color && !isTransparentColor(color)) return color;
		}
		element = element.parentElement;
	}

	const bodyColor = getComputedStyle(document.body).backgroundColor;
	if (bodyColor && !isTransparentColor(bodyColor)) return bodyColor;

	return "#ffffff";
}

function isTransparentColor(color: string) {
	const normalized = color.trim().toLowerCase();
	return (
		normalized === "transparent" ||
		normalized === "rgba(0, 0, 0, 0)" ||
		normalized === "rgba(0 0 0 / 0)" ||
		/^rgba\([^)]*,\s*0\)$/.test(normalized) ||
		/^rgb\([^)]*\/\s*0\)$/.test(normalized)
	);
}

function buildImagePdf(input: {
	imageBytes: Uint8Array;
	width: number;
	height: number;
	content: string;
}) {
	const encoder = new TextEncoder();
	const objects: Array<Array<string | Uint8Array>> = [
		["1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"],
		["2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"],
		[
			`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${input.width.toFixed(2)} ${input.height.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
		],
		[
			`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.round(input.width / 0.75)} /Height ${Math.round(input.height / 0.75)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${input.imageBytes.length} >>\nstream\n`,
			input.imageBytes,
			"\nendstream\nendobj\n",
		],
		[
			`5 0 obj\n<< /Length ${encoder.encode(input.content).length} >>\nstream\n${input.content}\nendstream\nendobj\n`,
		],
	];

	const parts: Uint8Array[] = [encoder.encode("%PDF-1.4\n")];
	const offsets = [0];
	let byteLength = parts[0].length;

	for (const objectParts of objects) {
		offsets.push(byteLength);
		for (const part of objectParts) {
			const bytes = typeof part === "string" ? encoder.encode(part) : part;
			parts.push(bytes);
			byteLength += bytes.length;
		}
	}

	const xrefOffset = byteLength;
	const xref = [
		"xref\n",
		`0 ${objects.length + 1}\n`,
		"0000000000 65535 f \n",
		...offsets
			.slice(1)
			.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
		`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
	].join("");
	parts.push(encoder.encode(xref));

	return concatBytes(parts);
}

function buildSingleSlidePptx(imageBytes: Uint8Array) {
	const slideWidth = 9144000;
	const slideHeight = 5143500;
	const files: Record<string, string | Uint8Array> = {
		"[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`,
		"_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
		"ppt/presentation.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="${slideWidth}" cy="${slideHeight}" type="wide"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
		"ppt/_rels/presentation.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`,
		"ppt/slides/slide1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${slideWidth}" cy="${slideHeight}"/><a:chOff x="0" y="0"/><a:chExt cx="${slideWidth}" cy="${slideHeight}"/></a:xfrm></p:grpSpPr><p:pic><p:nvPicPr><p:cNvPr id="2" name="Skedra export"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${slideWidth}" cy="${slideHeight}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
		"ppt/slides/_rels/slide1.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>`,
		"ppt/media/image1.png": imageBytes,
	};
	return zipStore(files);
}

function concatBytes(parts: Uint8Array[]) {
	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const output = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		output.set(part, offset);
		offset += part.length;
	}
	return output;
}

function zipStore(files: Record<string, string | Uint8Array>) {
	const encoder = new TextEncoder();
	const localParts: Uint8Array[] = [];
	const centralParts: Uint8Array[] = [];
	let offset = 0;

	for (const [name, value] of Object.entries(files)) {
		const nameBytes = encoder.encode(name);
		const data = typeof value === "string" ? encoder.encode(value) : value;
		const crc = crc32(data);
		const localHeader = zipHeader({
			signature: 0x04034b50,
			nameBytes,
			data,
			crc,
		});
		localParts.push(localHeader, data);
		centralParts.push(
			zipHeader({
				signature: 0x02014b50,
				nameBytes,
				data,
				crc,
				localHeaderOffset: offset,
			}),
		);
		offset += localHeader.length + data.length;
	}

	const centralDirectory = concatBytes(centralParts);
	const end = zipEnd(
		Object.keys(files).length,
		centralDirectory.length,
		offset,
	);
	return concatBytes([...localParts, centralDirectory, end]);
}

function zipHeader(input: {
	signature: number;
	nameBytes: Uint8Array;
	data: Uint8Array;
	crc: number;
	localHeaderOffset?: number;
}) {
	const central = input.signature === 0x02014b50;
	const header = new Uint8Array(central ? 46 : 30);
	const view = new DataView(header.buffer);
	view.setUint32(0, input.signature, true);
	if (central) {
		view.setUint16(4, 20, true);
		view.setUint16(6, 20, true);
		view.setUint32(16, input.crc, true);
		view.setUint32(20, input.data.length, true);
		view.setUint32(24, input.data.length, true);
		view.setUint16(28, input.nameBytes.length, true);
		view.setUint32(42, input.localHeaderOffset ?? 0, true);
	} else {
		view.setUint16(4, 20, true);
		view.setUint32(14, input.crc, true);
		view.setUint32(18, input.data.length, true);
		view.setUint32(22, input.data.length, true);
		view.setUint16(26, input.nameBytes.length, true);
	}
	return concatBytes([header, input.nameBytes]);
}

function zipEnd(fileCount: number, centralSize: number, centralOffset: number) {
	const end = new Uint8Array(22);
	const view = new DataView(end.buffer);
	view.setUint32(0, 0x06054b50, true);
	view.setUint16(8, fileCount, true);
	view.setUint16(10, fileCount, true);
	view.setUint32(12, centralSize, true);
	view.setUint32(16, centralOffset, true);
	return end;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
	let value = index;
	for (let bit = 0; bit < 8; bit++) {
		value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
	}
	return value >>> 0;
});

function crc32(bytes: Uint8Array) {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}
