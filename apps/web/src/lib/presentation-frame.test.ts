import assert from "node:assert/strict";
import { test } from "node:test";
import type { CanvasElement, SavedCanvasView } from "@skedra/canvas-core";
import {
	createPresentationFrameContent,
	decodePresentationFrameContent,
	getPresentationFrameAssetIds,
	viewportFromPresentationCamera,
} from "./presentation-frame.js";

function rectangle(id: string, x: number, y: number): CanvasElement {
	return {
		id,
		type: "rectangle",
		x,
		y,
		width: 100,
		height: 100,
		rotation: 0,
		fill: "transparent",
		stroke: "#ffffff",
		strokeWidth: 2,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
	};
}

const slide: SavedCanvasView = {
	id: "slide-1",
	name: "Opening",
	x: 0,
	y: 0,
	width: 1_600,
	height: 900,
	createdAt: 1,
	updatedAt: 1,
	order: 0,
	aspectRatio: "16:9",
};

test("presentation frames contain only elements intersecting the current slide", () => {
	const frame = createPresentationFrameContent({
		slide,
		slideIndex: 0,
		totalSlides: 2,
		elements: [
			rectangle("inside", 100, 100),
			rectangle("secret", 5_000, 5_000),
		],
		viewport: { x: 0, y: 0, zoom: 1 },
		viewportSize: { width: 1_600, height: 900 },
	});
	const decoded = decodePresentationFrameContent(frame);

	assert.deepEqual(
		decoded.elements.map((element) => element.id),
		["inside"],
	);
	assert.equal("presenterNotes" in decoded.view, false);
});

test("relative presentation cameras preserve the slide across viewport sizes", () => {
	const frame = createPresentationFrameContent({
		slide,
		slideIndex: 0,
		totalSlides: 1,
		elements: [],
		viewport: { x: 0, y: 0, zoom: 1 },
		viewportSize: { width: 1_600, height: 900 },
	});
	const viewer = viewportFromPresentationCamera(
		frame.camera,
		{ width: 800, height: 600 },
		slide,
	);

	assert.equal(viewer.zoom, 0.5);
	assert.equal(viewer.x, 0);
	assert.equal(viewer.y, 75);
});

test("presentation frames expose only their referenced stored asset ids", () => {
	const assetId = "22222222-2222-4222-8222-222222222222";
	const element = rectangle("image", 100, 100);
	element.type = "image";
	element.customData = {
		imageSrc: `/api/assets/${assetId}#encrypted-reference`,
	};
	const frame = createPresentationFrameContent({
		slide,
		slideIndex: 0,
		totalSlides: 1,
		elements: [element],
		viewport: { x: 0, y: 0, zoom: 1 },
		viewportSize: { width: 1_600, height: 900 },
	});

	assert.deepEqual(getPresentationFrameAssetIds(frame), [assetId]);
});

test("presentation frames strip hidden element metadata and attachment assets", () => {
	const attachmentId = "55555555-5555-4555-8555-555555555555";
	const element = rectangle("card", 100, 100);
	element.link = "https://internal.example/secret";
	element.customData = {
		skedraType: "kanban-card",
		description: "visible".repeat(100),
		attachments: [
			{
				id: "secret-attachment",
				src: `/api/assets/${attachmentId}`,
				name: "confidential.pdf",
				width: 100,
				height: 100,
			},
		],
		assigneeId: "private-user-id",
	};
	const frame = createPresentationFrameContent({
		slide,
		slideIndex: 0,
		totalSlides: 1,
		elements: [element],
		viewport: { x: 0, y: 0, zoom: 1 },
		viewportSize: { width: 1_600, height: 900 },
	});
	const [decoded] = decodePresentationFrameContent(frame).elements;

	assert.equal(decoded.link, undefined);
	assert.equal(decoded.customData?.assigneeId, undefined);
	assert.equal((decoded.customData?.description as string).length, 300);
	assert.deepEqual(getPresentationFrameAssetIds(frame), []);
});
