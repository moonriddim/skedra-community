import assert from "node:assert/strict";
import test from "node:test";
import { hitTest } from "./hit-test.js";
import { isCanvasPointPathElement } from "./path-editing.js";
import { parseSvgToCanvasElements } from "./svg-import.js";
import {
	getSvgImportedLineData,
	getSvgImportedRectData,
	getSvgPathElementData,
	getSvgPathElementSubpaths,
	getSvgPathRenderMatrix,
} from "./svg-path-element.js";

function importSvg(markup: string) {
	let id = 0;
	return parseSvgToCanvasElements(markup, {
		createId: () => `svg-${++id}`,
		stroke: "#17211d",
		target: { x: 300, y: 200 },
		maxWidth: 480,
		maxHeight: 360,
		sourceName: "logo.svg",
	});
}

test("imports basic SVG shapes as one editable canvas group", () => {
	const result = importSvg(`
		<svg viewBox="0 0 200 100" width="400" height="200">
			<rect id="panel" x="10" y="10" width="60" height="40" rx="5" fill="#f43f5e"/>
			<circle id="dot" cx="100" cy="30" r="20" fill="#38bdf8"/>
			<path id="wave" d="M 10 80 C 50 20 150 140 190 60" fill="none" stroke="#111827" stroke-width="3"/>
		</svg>
	`);

	assert.ok(result);
	assert.equal(result.usedFallback, false);
	assert.equal(result.elements.length, 3);
	assert.deepEqual(
		result.elements.map((element) => element.type),
		["rectangle", "ellipse", "line"],
	);
	assert.ok(result.elements.every((element) => element.groupId === "svg-1"));
	assert.equal(result.elements[0].customData?.svgSourceId, "panel");

	const path = result.elements[2];
	const data = getSvgPathElementData(path);
	assert.ok(data);
	assert.equal(data.d, "M 10 80 C 50 20 150 140 190 60");
	assert.ok(data.subpaths[0].length > 4);
	assert.ok(
		hitTest(path, path.x + path.width / 2, path.y + path.height / 2, 12),
	);
});

test("keeps SVG path transforms exact and scales hit contours with the element", () => {
	const result = importSvg(`
		<svg viewBox="0 0 100 100">
			<g transform="translate(10 20) rotate(15)">
				<path d="M 0 0 Q 20 40 40 0 A 10 10 0 0 1 60 0 Z" fill="#0f766e"/>
			</g>
		</svg>
	`);
	assert.ok(result);
	const element = result.elements[0];
	const data = getSvgPathElementData(element);
	assert.ok(data);
	assert.notDeepEqual(data.transform, [1, 0, 0, 1, 0, 0]);
	assert.ok(getSvgPathRenderMatrix(element));

	const resized = {
		...element,
		width: element.width * 2,
		height: element.height * 3,
	};
	const originalSubpaths = getSvgPathElementSubpaths(element);
	const resizedSubpaths = getSvgPathElementSubpaths(resized);
	assert.ok(originalSubpaths);
	assert.ok(resizedSubpaths);
	assert.ok(
		Math.abs(resizedSubpaths[0][1][0] - originalSubpaths[0][1][0] * 2) < 1e-9,
	);
	assert.ok(
		Math.abs(resizedSubpaths[0][1][1] - originalSubpaths[0][1][1] * 3) < 1e-9,
	);
});

test("isolates unsupported SVG effects as a sanitized image fallback", () => {
	const result = importSvg(`
		<svg viewBox="0 0 120 80">
			<defs>
				<linearGradient id="gradient"><stop offset="0" stop-color="red"/></linearGradient>
			</defs>
			<rect x="4" y="4" width="30" height="20" fill="#22c55e"/>
			<path d="M 45 10 L 110 10 L 80 70 Z" fill="url(#gradient)" onclick="alert(1)"/>
		</svg>
	`);
	assert.ok(result);
	assert.equal(result.usedFallback, true);
	assert.equal(result.elements.length, 2);
	assert.equal(result.elements[0].type, "rectangle");
	assert.equal(result.elements[1].type, "image");
	const source = String(result.elements[1].customData?.imageSrc);
	const decoded = decodeURIComponent(source.slice(source.indexOf(",") + 1));
	assert.doesNotMatch(decoded, /onclick/i);
	assert.match(decoded, /linearGradient/);
});

test("keeps ordinary SVG lines and polygons point-editable with exact presentation data", () => {
	const result = importSvg(`
		<svg viewBox="0 0 120 80">
			<g transform="translate(5 7) rotate(12)">
				<polygon points="0,0 50,0 25,40" fill="#ef4444" stroke="#111827"
					stroke-width="2" stroke-dasharray="6 3" fill-opacity="0.7"/>
			</g>
		</svg>
	`);
	assert.ok(result);
	assert.equal(result.usedFallback, false);
	assert.equal(result.elements.length, 1);
	const polygon = result.elements[0];
	assert.equal(polygon.type, "line");
	assert.equal(polygon.closed, true);
	assert.equal(isCanvasPointPathElement(polygon), true);
	assert.equal(polygon.points?.length, 3);
	const presentation = getSvgImportedLineData(polygon);
	assert.ok(presentation);
	assert.equal(presentation.fillOpacity, 0.7);
	assert.equal(presentation.strokeLinecap, "butt");
	assert.equal(presentation.strokeLinejoin, "miter");
	assert.ok(presentation.strokeDasharray);
});

test("groups native and fallback parts by the elements actually emitted", () => {
	const result = importSvg(`
		<svg viewBox="0 0 100 50">
			<rect width="20" height="20" fill="#22c55e"/>
			<image x="30" width="20" height="20"
				href="data:image/png;base64,iVBORw0KGgo="/>
		</svg>
	`);
	assert.ok(result);
	assert.equal(result.elements.length, 2);
	assert.ok(result.elements[0].groupId);
	assert.equal(result.elements[0].groupId, result.elements[1].groupId);
	assert.equal(result.elements[1].customData?.skedraType, "svg-fallback");
});

test("recognizes inline effects, preserves inherited styles, and avoids filter clipping", () => {
	const result = importSvg(`
		<svg viewBox="0 0 120 80">
			<defs>
				<filter id="blur"><feGaussianBlur stdDeviation="20"/></filter>
			</defs>
			<g fill="#ff0000">
				<path d="M 10 10 H 40 V 40 Z" style="filter: url(#blur)"/>
			</g>
		</svg>
	`);
	assert.ok(result);
	assert.equal(result.usedFallback, true);
	assert.equal(result.elements.length, 1);
	const fallback = result.elements[0];
	assert.equal(fallback.type, "image");
	assert.equal(fallback.width, 120);
	assert.equal(fallback.height, 80);
	const source = String(fallback.customData?.imageSrc);
	const decoded = decodeURIComponent(source.slice(source.indexOf(",") + 1));
	assert.match(
		decoded,
		/filter:\s*url\(&quot;#blur&quot;\)|filter:\s*url\("#blur"\)/,
	);
	assert.match(decoded, /fill="#ff0000"/);
});

test("removes external resource URLs and active SVG content from fallbacks", () => {
	const result = importSvg(`
		<svg viewBox="0 0 100 60">
			<defs><filter id="f"><feGaussianBlur stdDeviation="2"/></filter></defs>
			<path d="M 0 0 H 30 V 30 Z"
				style="filter:url(#f);fill:url(https://example.invalid/paint.svg#x)"
				onload="alert(1)"/>
			<script>alert(2)</script>
		</svg>
	`);
	assert.ok(result);
	assert.equal(result.usedFallback, true);
	const source = String(result.elements[0].customData?.imageSrc);
	const decoded = decodeURIComponent(source.slice(source.indexOf(",") + 1));
	assert.doesNotMatch(decoded, /https:\/\/example\.invalid/i);
	assert.doesNotMatch(decoded, /onload|script|alert/i);
	assert.match(
		decoded,
		/filter:\s*url\(&quot;#f&quot;\)|filter:\s*url\("#f"\)/,
	);
});

test("falls back for stylesheets instead of silently ignoring CSS selectors", () => {
	const result = importSvg(`
		<svg viewBox="0 0 100 60">
			<style>rect { fill: #7c3aed; }</style>
			<rect width="40" height="30"/>
		</svg>
	`);
	assert.ok(result);
	assert.equal(result.usedFallback, true);
	assert.equal(result.elements.length, 1);
	assert.equal(result.elements[0].type, "image");
	assert.equal(result.elements[0].width, 100);
	assert.equal(result.elements[0].height, 60);
});

test("preserves independent SVG rectangle corner radii while allowing editor overrides", () => {
	const result = importSvg(`
		<svg viewBox="0 0 100 50">
			<rect width="80" height="40" rx="5" ry="18" fill="#f43f5e"/>
		</svg>
	`);
	assert.ok(result);
	const rectangle = result.elements[0];
	assert.equal(rectangle.type, "rectangle");
	const radii = getSvgImportedRectData(rectangle);
	assert.ok(radii);
	assert.equal(radii.rxRatio, 5 / 80);
	assert.equal(radii.ryRatio, 18 / 40);
	assert.equal(
		getSvgImportedRectData({ ...rectangle, cornerRadiusPercent: 25 }),
		null,
	);
});

test("uses explicit inherited opacity values instead of multiplying overrides", () => {
	const result = importSvg(`
		<svg viewBox="0 0 100 50">
			<g fill-opacity="0.4">
				<rect width="50" height="30" fill="#0ea5e9" fill-opacity="0.7"/>
			</g>
		</svg>
	`);
	assert.ok(result);
	const data = getSvgPathElementData(result.elements[0]);
	assert.ok(data);
	assert.equal(data.fillOpacity, 0.7);
});

test("rejects declarations and malformed XML before they reach fallback markup", () => {
	assert.equal(
		importSvg(`<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///tmp/secret">]>
			<svg viewBox="0 0 10 10"><text>&xxe;</text></svg>`),
		null,
	);
	assert.equal(
		importSvg(`<svg viewBox="0 0 10 10"><rect width="10 height="10"/></svg>`),
		null,
	);
});
