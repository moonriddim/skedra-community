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
	type: "rectangle" | "ellipse" | "triangle" | "cloud",
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

test("round-trips polygon sides, triangle sections and cloud arc radii", () => {
	const polygon = shape("rectangle", { polygonSides: 8 });
	const triangle = shape("triangle", { pyramidSections: 5 });
	const cloud = shape("cloud", { cloudArcRadius: 24 });
	const decodedPolygon = decodeCanvasElement(encodeCanvasElement(polygon));
	const decodedTriangle = decodeCanvasElement(encodeCanvasElement(triangle));
	const decodedCloud = decodeCanvasElement(encodeCanvasElement(cloud));

	assert.equal(decodedPolygon?.type, "rectangle");
	assert.equal(decodedPolygon?.polygonSides, 8);
	assert.equal(decodedTriangle?.type, "triangle");
	assert.equal(decodedTriangle?.pyramidSections, 5);
	assert.equal(decodedCloud?.type, "cloud");
	assert.equal(decodedCloud?.cloudArcRadius, 24);
});

test("round-trips ellipse arc angles as an all-or-nothing pair", () => {
	const arc = shape("ellipse", { arcStartAngle: 25, arcEndAngle: 220 });
	const decoded = decodeCanvasElement(encodeCanvasElement(arc));
	assert.equal(decoded?.arcStartAngle, 25);
	assert.equal(decoded?.arcEndAngle, 220);

	const encoded = encodeCanvasElement(arc);
	assert.equal(
		decodeCanvasElement({ ...encoded, arcEndAngle: undefined }),
		null,
	);
});

test("rejects invalid persisted polygon side counts", () => {
	const encoded = encodeCanvasElement(shape("rectangle", { polygonSides: 6 }));
	assert.equal(decodeCanvasElement({ ...encoded, polygonSides: 3 }), null);
	assert.equal(decodeCanvasElement({ ...encoded, polygonSides: 5.5 }), null);
	assert.equal(decodeCanvasElement({ ...encoded, polygonSides: 13 }), null);
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
