import assert from "node:assert/strict";
import test from "node:test";
import type { CanvasElement } from "@skedra/canvas-core";
import { decodeCanvasElement, encodeCanvasElement } from "./codecs";
import { getSkedraFrameExportFilename } from "./exporters";

test("frame export filenames are shared by every host", () => {
	assert.equal(
		getSkedraFrameExportFilename({ frameLabel: "Login / Screen" }, "svg"),
		"login-screen.svg",
	);
});

function shape(
	type: "triangle" | "cloud",
	overrides: Partial<CanvasElement> = {},
): CanvasElement {
	return {
		id: type,
		type,
		x: 10,
		y: 20,
		width: 180,
		height: 120,
		rotation: 0,
		fill: "#fde68a",
		stroke: "#78350f",
		strokeWidth: 2,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		...overrides,
	};
}

test("round-trips triangle pyramid sections and cloud arc radii", () => {
	const triangle = shape("triangle", { pyramidSections: 5 });
	const cloud = shape("cloud", { cloudArcRadius: 24 });
	const decodedTriangle = decodeCanvasElement(encodeCanvasElement(triangle));
	const decodedCloud = decodeCanvasElement(encodeCanvasElement(cloud));

	assert.equal(decodedTriangle?.type, "triangle");
	assert.equal(decodedTriangle?.pyramidSections, 5);
	assert.equal(decodedCloud?.type, "cloud");
	assert.equal(decodedCloud?.cloudArcRadius, 24);
});

test("rejects invalid persisted cloud arc radii", () => {
	const encoded = encodeCanvasElement(shape("cloud", { cloudArcRadius: 18 }));
	assert.equal(decodeCanvasElement({ ...encoded, cloudArcRadius: 3 }), null);
	assert.equal(decodeCanvasElement({ ...encoded, cloudArcRadius: 49 }), null);
});

test("rejects invalid persisted pyramid section counts", () => {
	const encoded = encodeCanvasElement(
		shape("triangle", { pyramidSections: 3 }),
	);
	assert.equal(decodeCanvasElement({ ...encoded, pyramidSections: 0 }), null);
	assert.equal(decodeCanvasElement({ ...encoded, pyramidSections: 2.5 }), null);
	assert.equal(decodeCanvasElement({ ...encoded, pyramidSections: 13 }), null);
});
