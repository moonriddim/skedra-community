import assert from "node:assert/strict";
import { test } from "node:test";
import {
	convertExcalidrawElement,
	convertExcalidrawLibraryGroups,
	createExcalidrawFile,
	parseExcalidrawClipboard,
	parseExcalidrawScene,
	serializeExcalidrawClipboard,
	serializeSkedraClipboard,
} from "./excalidraw-import.js";

import { cloneCanvasSelection } from "./selection-operations.js";
import type { CanvasElement } from "./types.js";

const options = {
	createId: () => "generated-id",
	defaultFontFamily: "Inter",
	defaultStroke: "#111111",
};

test("converts Excalidraw arrows with points and arrow heads", () => {
	const element = convertExcalidrawElement(
		{
			id: "arrow-1",
			type: "line",
			x: 10,
			y: 20,
			width: 100,
			height: 40,
			strokeColor: "#ff0000",
			strokeStyle: "dashed",
			endArrowhead: "triangle",
			points: [
				[0, 0],
				[100, 40],
			],
		},
		options,
	);

	assert.equal(element?.type, "arrow");
	assert.equal(element?.strokeStyle, "dashed");
	assert.equal(element?.arrowHeadEnd, "triangle");
	assert.deepEqual(element?.points, [
		[0, 0],
		[100, 40],
	]);
});

test("converts Excalidraw text with fallback font and group id", () => {
	const element = convertExcalidrawElement(
		{
			type: "text",
			x: 0,
			y: 0,
			width: 120,
			height: 40,
			text: "Hello",
			groupIds: ["group-a"],
		},
		options,
	);

	assert.equal(element?.id, "generated-id");
	assert.equal(element?.text, "Hello");
	assert.equal(element?.fontFamily, "Inter");
	assert.equal(element?.groupId, "group-a");
	assert.equal(element?.customData?.excalidrawImport, true);
});

test("converts only non-empty Excalidraw library groups", () => {
	const groups = convertExcalidrawLibraryGroups(
		[
			[{ id: "rect-1", type: "rectangle", width: 10, height: 10 }],
			[{ type: "unknown" }],
			[{ id: "deleted", type: "ellipse", isDeleted: true }],
		],
		options,
	);

	assert.equal(groups.length, 1);
	assert.equal(groups[0].name, "Item 1");
	assert.equal(groups[0].elements[0].id, "rect-1");
});

test("parses Excalidraw clipboard scenes emitted by drwn.io", () => {
	const elements = parseExcalidrawClipboard(
		JSON.stringify({
			type: "excalidraw",
			version: 2,
			source: "https://excalidraw.com",
			elements: [
				{
					id: "line-1",
					type: "line",
					x: 348,
					y: 75,
					width: 454,
					height: 1,
					groupIds: ["browser-window"],
					points: [
						[0, 0],
						[454, 1],
					],
				},
				{
					id: "title-1",
					type: "text",
					x: 485,
					y: -66,
					width: 184,
					height: 41,
					text: "website-window",
				},
			],
		}),
		options,
	);

	assert.equal(elements?.length, 2);
	assert.equal(elements?.[0].groupId, "browser-window");
	assert.equal(elements?.[1].text, "website-window");
});

test("restores filled curved drwn.io paths whose first and last point match", () => {
	const elements = parseExcalidrawClipboard(
		JSON.stringify({
			type: "excalidraw",
			version: 2,
			source: "https://excalidraw.com",
			elements: [
				{
					id: "tailwind-ribbon",
					type: "line",
					x: 290,
					y: -562,
					width: 414,
					height: 179,
					strokeColor: "#000000",
					backgroundColor: "#17bab9",
					fillStyle: "solid",
					strokeWidth: 1,
					strokeStyle: "solid",
					roughness: 1,
					opacity: 100,
					strokeSharpness: "round",
					points: [
						[0, -53],
						[46, -126],
						[154, -144],
						[253, -78],
						[414, -74],
						[361, 15],
						[213, 6],
						[107, -89],
						[0, -53],
					],
				},
			],
		}),
		options,
	);

	assert.equal(elements?.length, 1);
	assert.equal(elements?.[0].type, "line");
	assert.equal(elements?.[0].closed, true);
	assert.equal(elements?.[0].arrowMode, "curve");
	assert.equal(elements?.[0].fill, "#17bab9");
	assert.equal(elements?.[0].roughFillStyle, "solid");
	assert.deepEqual(elements?.[0].points, [
		[0, -53],
		[46, -126],
		[154, -144],
		[253, -78],
		[414, -74],
		[361, 15],
		[213, 6],
		[107, -89],
	]);
});

test("ignores plain text and other clipboard JSON formats", () => {
	assert.equal(parseExcalidrawClipboard("not json", options), null);
	assert.equal(
		parseExcalidrawClipboard('{"type":"skedra-clipboard"}', options),
		null,
	);
});

test("preserves nested groups, bindings, text metrics, and unsupported arrowheads", () => {
	const scene = parseExcalidrawScene(
		{
			type: "excalidraw",
			version: 2,
			elements: [
				{
					id: "shape-1",
					type: "rectangle",
					x: 10,
					y: 20,
					width: 120,
					height: 80,
					groupIds: ["inner", "outer"],
					roundness: { type: 3 },
					boundElements: [{ id: "arrow-1", type: "arrow" }],
				},
				{
					id: "arrow-1",
					type: "arrow",
					x: 130,
					y: 60,
					width: 100,
					height: 0,
					points: [
						[0, 0],
						[100, 0],
					],
					startBinding: { elementId: "shape-1", focus: 0, gap: 1 },
					endArrowhead: "diamond_outline",
				},
				{
					id: "text-1",
					type: "text",
					x: 20,
					y: 30,
					width: 80,
					height: 25,
					text: "Virgil",
					fontFamily: 1,
					fontSize: 20,
					textAlign: "right",
					verticalAlign: "bottom",
					baseline: 17,
					lineHeight: 1.25,
				},
			],
		},
		options,
	);

	assert.ok(scene);
	assert.equal(scene.elements[0].groupId, "inner");
	assert.equal(scene.elements[0].cornerRadius, 32);
	assert.match(scene.elements[2].fontFamily ?? "", /Virgil/u);
	assert.equal(scene.elements[2].textAlign, "right");
	assert.equal(scene.elements[2].verticalAlign, "bottom");
	assert.equal(scene.elements[2].baseline, 17);
	assert.deepEqual(scene.elements[1].startBinding, {
		elementId: "shape-1",
		focus: 0,
		gap: 1,
	});

	const exported = createExcalidrawFile(scene.elements, { now: 123 });
	const shape = exported.elements.find((element) => element.id === "shape-1");
	const arrow = exported.elements.find((element) => element.id === "arrow-1");
	const text = exported.elements.find((element) => element.id === "text-1");
	assert.deepEqual(shape?.groupIds, ["inner", "outer"]);
	assert.deepEqual(arrow?.startBinding, {
		elementId: "shape-1",
		focus: 0,
		gap: 1,
	});
	assert.equal(arrow?.endArrowhead, "diamond_outline");
	assert.equal(text?.fontFamily, 1);
	assert.equal(text?.verticalAlign, "bottom");
	assert.equal(text?.baseline, 17);
});

test("round-trips Skedra-only shapes and inline text through Excalidraw customData", () => {
	const triangle: CanvasElement = {
		id: "triangle-1",
		type: "triangle",
		x: 5,
		y: 10,
		width: 200,
		height: 120,
		rotation: 0,
		fill: "#ffeeaa",
		stroke: "#222222",
		strokeWidth: 2,
		strokeStyle: "solid",
		opacity: 90,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		text: "Skedra pyramid",
		fontSize: 22,
		fontFamily: "Inter",
		textAlign: "center",
		verticalAlign: "middle",
		roughFillStyle: "dots",
		pyramidSections: 4,
		customData: { skedraType: "architecture-pyramid" },
	};

	const exported = createExcalidrawFile([triangle], { now: 123 });
	assert.equal(exported.elements[0].type, "rectangle");
	assert.equal(exported.elements[0].fillStyle, "dots");
	assert.equal(exported.elements[1].type, "text");
	assert.equal(exported.elements[1].containerId, "triangle-1");

	const imported = parseExcalidrawScene(exported, options);
	assert.ok(imported);
	assert.equal(imported.elements.length, 1);
	assert.equal(imported.elements[0].type, "triangle");
	assert.equal(imported.elements[0].pyramidSections, 4);
	assert.equal(imported.elements[0].roughFillStyle, "dots");
	assert.equal(imported.elements[0].text, "Skedra pyramid");
	assert.equal(
		imported.elements[0].customData?.skedraType,
		"architecture-pyramid",
	);
	const clipboard = JSON.parse(serializeExcalidrawClipboard([triangle]));
	assert.equal(clipboard.type, "excalidraw/clipboard");
	assert.equal(clipboard.elements[0].id, "triangle-1");
	assert.equal(clipboard.appState, undefined);
	assert.equal(clipboard.source, undefined);
	assert.equal(clipboard.version, undefined);

	const skedraClipboard = JSON.parse(serializeSkedraClipboard([triangle]));
	assert.equal(skedraClipboard.type, "skedra-clipboard");
	assert.equal(skedraClipboard.version, 1);
	assert.equal(skedraClipboard.elements[0].type, "triangle");
});

test("imports Excalidraw image files and exports their binary payload", () => {
	const dataURL = "data:image/png;base64,AAAA";
	const scene = parseExcalidrawScene(
		{
			type: "excalidraw",
			version: 2,
			elements: [
				{
					id: "image-1",
					type: "image",
					fileId: "file-1",
					x: 0,
					y: 0,
					width: 100,
					height: 80,
					crop: {
						x: 10,
						y: 20,
						width: 100,
						height: 80,
						naturalWidth: 200,
						naturalHeight: 160,
					},
				},
			],
			files: {
				"file-1": {
					id: "file-1",
					mimeType: "image/png",
					dataURL,
					created: 1,
				},
			},
		},
		options,
	);

	assert.ok(scene);
	assert.equal(scene.elements[0].type, "image");
	assert.equal(scene.elements[0].customData?.imageSrc, dataURL);
	assert.deepEqual(scene.elements[0].customData?.imageCrop, {
		x: 0.05,
		y: 0.125,
		width: 0.5,
		height: 0.5,
	});
	const exported = createExcalidrawFile(scene.elements, { now: 123 });
	assert.equal(
		(exported.files["file-1"] as Record<string, unknown>).dataURL,
		dataURL,
	);
});

test("keeps unsupported Excalidraw element payloads while exposing an editable fallback", () => {
	const scene = parseExcalidrawScene(
		{
			type: "excalidraw",
			version: 2,
			elements: [
				{
					id: "embed-1",
					type: "embeddable",
					x: 40,
					y: 60,
					width: 320,
					height: 180,
					link: "https://example.com/demo",
					seed: 9182,
					customFutureField: { mode: "preserve-me" },
				},
			],
		},
		options,
	);
	assert.ok(scene);
	assert.equal(scene.elements[0].type, "rectangle");

	const exported = createExcalidrawFile([{ ...scene.elements[0], x: 75 }], {
		now: 123,
	});
	assert.equal(exported.elements[0].type, "embeddable");
	assert.equal(exported.elements[0].x, 75);
	assert.equal(exported.elements[0].seed, 9182);
	assert.deepEqual(exported.elements[0].customFutureField, {
		mode: "preserve-me",
	});
});

test("remaps Excalidraw nested groups and bindings when pasted", () => {
	const scene = parseExcalidrawScene(
		{
			type: "excalidraw",
			version: 2,
			elements: [
				{
					id: "source-shape",
					type: "rectangle",
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					groupIds: ["inner", "outer"],
				},
				{
					id: "source-arrow",
					type: "arrow",
					x: 100,
					y: 25,
					width: 100,
					height: 0,
					points: [
						[0, 0],
						[100, 0],
					],
					groupIds: ["inner", "outer"],
					startBinding: { elementId: "source-shape", focus: 0, gap: 0 },
				},
			],
		},
		options,
	);
	assert.ok(scene);
	const ids = ["shape-copy", "arrow-copy", "inner-copy", "outer-copy"];
	const cloned = cloneCanvasSelection({
		elements: scene.elements,
		createId: () => ids.shift() ?? "fallback",
		offset: { x: 0, y: 0 },
	});
	assert.equal(cloned.elements[1].startBinding?.elementId, "shape-copy");
	const exported = createExcalidrawFile(cloned.elements, { now: 123 });
	const shape = exported.elements.find(
		(element) => element.id === "shape-copy",
	);
	const arrow = exported.elements.find(
		(element) => element.id === "arrow-copy",
	);
	assert.deepEqual(shape?.groupIds, ["inner-copy", "outer-copy"]);
	assert.deepEqual(arrow?.groupIds, ["inner-copy", "outer-copy"]);
	assert.equal(
		(arrow?.startBinding as Record<string, unknown>).elementId,
		"shape-copy",
	);
});
