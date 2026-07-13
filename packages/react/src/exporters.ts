export type SkedraVisualExportFormat = "svg" | "png" | "pdf" | "pptx";

export interface SkedraVisualExportOptions {
	padding?: number;
	background?: string;
	scale?: number;
}

interface RasterizedCanvas {
	canvas: HTMLCanvasElement;
	width: number;
	height: number;
}

export function exportSkedraSvg(
	svgElement: SVGSVGElement,
	options: SkedraVisualExportOptions = {},
): Blob {
	const prepared = prepareSvg(svgElement, options);
	return new Blob([new XMLSerializer().serializeToString(prepared.svg)], {
		type: "image/svg+xml;charset=utf-8",
	});
}

export async function exportSkedraPng(
	svgElement: SVGSVGElement,
	options: SkedraVisualExportOptions = {},
): Promise<Blob> {
	const { canvas } = await rasterizeSvg(svgElement, options);
	return canvasToBlob(canvas, "image/png");
}

export async function exportSkedraPdf(
	svgElement: SVGSVGElement,
	options: SkedraVisualExportOptions = {},
): Promise<Blob> {
	const { canvas, width, height } = await rasterizeSvg(svgElement, options);
	const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.92);
	const imageBytes = new Uint8Array(await jpeg.arrayBuffer());
	const pageWidth = Math.max(1, width * 0.75);
	const pageHeight = Math.max(1, height * 0.75);
	return new Blob(
		[
			buildImagePdf({
				imageBytes,
				pixelWidth: canvas.width,
				pixelHeight: canvas.height,
				width: pageWidth,
				height: pageHeight,
			}),
		],
		{ type: "application/pdf" },
	);
}

export async function exportSkedraPptx(
	svgElement: SVGSVGElement,
	options: SkedraVisualExportOptions = {},
): Promise<Blob> {
	const { canvas } = await rasterizeSvg(svgElement, options);
	const png = await canvasToBlob(canvas, "image/png");
	return new Blob(
		[buildSingleSlidePptx(new Uint8Array(await png.arrayBuffer()))],
		{
			type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		},
	);
}

export async function exportSkedraVisual(
	svgElement: SVGSVGElement,
	format: SkedraVisualExportFormat,
	options?: SkedraVisualExportOptions,
): Promise<Blob> {
	switch (format) {
		case "svg":
			return exportSkedraSvg(svgElement, options);
		case "png":
			return exportSkedraPng(svgElement, options);
		case "pdf":
			return exportSkedraPdf(svgElement, options);
		case "pptx":
			return exportSkedraPptx(svgElement, options);
	}
}

function prepareSvg(
	svgElement: SVGSVGElement,
	options: SkedraVisualExportOptions,
) {
	const sourceLayer = svgElement.querySelector<SVGGElement>(
		"[data-skedra-elements]",
	);
	const bbox = sourceLayer?.getBBox();
	const padding = options.padding ?? 40;
	const x = bbox && bbox.width > 0 ? bbox.x - padding : 0;
	const y = bbox && bbox.height > 0 ? bbox.y - padding : 0;
	const width = Math.max(
		1,
		bbox && bbox.width > 0 ? bbox.width + padding * 2 : 1920,
	);
	const height = Math.max(
		1,
		bbox && bbox.height > 0 ? bbox.height + padding * 2 : 1080,
	);
	const clone = svgElement.cloneNode(true) as SVGSVGElement;
	clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	clone.classList.add("skedra-sdk");
	clone.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
	clone.setAttribute("width", String(width));
	clone.setAttribute("height", String(height));
	for (const element of clone.querySelectorAll(
		"[data-skedra-ui], .skedra-sdk__selection, .skedra-sdk__lasso, .skedra-sdk__laser, .skedra-sdk__selected-outline",
	)) {
		element.remove();
	}
	const layer = clone.querySelector<SVGGElement>("[data-skedra-elements]");
	layer?.removeAttribute("transform");
	embedSdkStyles(clone);
	const background = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"rect",
	);
	background.setAttribute("x", String(x));
	background.setAttribute("y", String(y));
	background.setAttribute("width", String(width));
	background.setAttribute("height", String(height));
	background.setAttribute(
		"fill",
		options.background ?? resolveCanvasBackground(svgElement),
	);
	clone.insertBefore(background, clone.firstChild);
	return { svg: clone, width, height };
}

function embedSdkStyles(svg: SVGSVGElement) {
	const css: string[] = [];
	for (const sheet of document.styleSheets) {
		try {
			for (const rule of sheet.cssRules) {
				if (rule.cssText.includes("skedra-sdk")) css.push(rule.cssText);
			}
		} catch {
			// Cross-origin stylesheets cannot be inspected and are not SDK-owned.
		}
	}
	if (css.length === 0) return;
	let defs = svg.querySelector("defs");
	if (!defs) {
		defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
		svg.prepend(defs);
	}
	const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
	style.textContent = css.join("\n");
	defs.append(style);
}

async function rasterizeSvg(
	svgElement: SVGSVGElement,
	options: SkedraVisualExportOptions,
): Promise<RasterizedCanvas> {
	const prepared = prepareSvg(svgElement, options);
	const scale = Math.max(0.25, options.scale ?? 2);
	const source = new XMLSerializer().serializeToString(prepared.svg);
	const url = URL.createObjectURL(
		new Blob([source], { type: "image/svg+xml;charset=utf-8" }),
	);
	try {
		const image = await loadImage(url);
		const canvas = document.createElement("canvas");
		canvas.width = Math.ceil(prepared.width * scale);
		canvas.height = Math.ceil(prepared.height * scale);
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Canvas 2D context is unavailable");
		context.scale(scale, scale);
		context.drawImage(image, 0, 0, prepared.width, prepared.height);
		return { canvas, width: prepared.width, height: prepared.height };
	} finally {
		URL.revokeObjectURL(url);
	}
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = reject;
		image.src = src;
	});
}

function canvasToBlob(
	canvas: HTMLCanvasElement,
	type: string,
	quality?: number,
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) =>
				blob ? resolve(blob) : reject(new Error("Canvas export failed")),
			type,
			quality,
		);
	});
}

function resolveCanvasBackground(svgElement: SVGSVGElement) {
	let element: Element | null = svgElement.closest(".skedra-sdk") ?? svgElement;
	while (element) {
		const color = getComputedStyle(element).backgroundColor;
		if (color && !isTransparent(color)) return color;
		element = element.parentElement;
	}
	return "#ffffff";
}

function isTransparent(color: string) {
	const normalized = color.trim().toLowerCase();
	return (
		normalized === "transparent" ||
		normalized === "rgba(0, 0, 0, 0)" ||
		normalized === "rgba(0 0 0 / 0)"
	);
}

function buildImagePdf(input: {
	imageBytes: Uint8Array;
	pixelWidth: number;
	pixelHeight: number;
	width: number;
	height: number;
}) {
	const encoder = new TextEncoder();
	const content = `q ${input.width.toFixed(2)} 0 0 ${input.height.toFixed(2)} 0 0 cm /Im0 Do Q`;
	const objects: Array<Array<string | Uint8Array>> = [
		["1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"],
		["2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"],
		[
			`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${input.width.toFixed(2)} ${input.height.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
		],
		[
			`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${input.pixelWidth} /Height ${input.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${input.imageBytes.length} >>\nstream\n`,
			input.imageBytes,
			"\nendstream\nendobj\n",
		],
		[
			`5 0 obj\n<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream\nendobj\n`,
		],
	];
	const parts: Uint8Array[] = [encoder.encode("%PDF-1.4\n")];
	const offsets = [0];
	let length = parts[0].length;
	for (const object of objects) {
		offsets.push(length);
		for (const part of object) {
			const bytes = typeof part === "string" ? encoder.encode(part) : part;
			parts.push(bytes);
			length += bytes.length;
		}
	}
	const xref = [
		"xref\n",
		`0 ${objects.length + 1}\n`,
		"0000000000 65535 f \n",
		...offsets
			.slice(1)
			.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
		`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF`,
	].join("");
	parts.push(encoder.encode(xref));
	return concatBytes(parts);
}

function buildSingleSlidePptx(imageBytes: Uint8Array) {
	const width = 9144000;
	const height = 5143500;
	return zipStore({
		"[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`,
		"_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
		"ppt/presentation.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="${width}" cy="${height}" type="wide"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
		"ppt/_rels/presentation.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`,
		"ppt/slides/slide1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/><a:chOff x="0" y="0"/><a:chExt cx="${width}" cy="${height}"/></a:xfrm></p:grpSpPr><p:pic><p:nvPicPr><p:cNvPr id="2" name="Skedra export"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
		"ppt/slides/_rels/slide1.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>`,
		"ppt/media/image1.png": imageBytes,
	});
}

function concatBytes(parts: Uint8Array[]) {
	const output = new Uint8Array(
		parts.reduce((sum, part) => sum + part.length, 0),
	);
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
		const local = zipHeader({ signature: 0x04034b50, nameBytes, data, crc });
		localParts.push(local, data);
		centralParts.push(
			zipHeader({
				signature: 0x02014b50,
				nameBytes,
				data,
				crc,
				localHeaderOffset: offset,
			}),
		);
		offset += local.length + data.length;
	}
	const central = concatBytes(centralParts);
	return concatBytes([
		...localParts,
		central,
		zipEnd(Object.keys(files).length, central.length, offset),
	]);
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
	const bytes = new Uint8Array(22);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, 0x06054b50, true);
	view.setUint16(8, fileCount, true);
	view.setUint16(10, fileCount, true);
	view.setUint32(12, centralSize, true);
	view.setUint32(16, centralOffset, true);
	return bytes;
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
	for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}
