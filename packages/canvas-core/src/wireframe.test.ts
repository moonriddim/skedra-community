import assert from "node:assert/strict";
import { test } from "node:test";
import { cloneCanvasSelection } from "./selection-operations";
import {
	WIREFRAME_COMPONENT_CATEGORIES,
	WIREFRAME_COMPONENT_IDS,
	createWireframeComponentElements,
	createWireframeScreenElements,
	getWireframeElementMeta,
	resolveWireframeInsertionTarget,
} from "./wireframe";
import {
	WIREFRAME_BLANK_PRESET_IDS,
	WIREFRAME_PRESET_IDS,
	WIREFRAME_STARTER_PRESET_IDS,
	createWireframePresetElements,
} from "./wireframe-presets";

function defaults(prefix = "id") {
	let index = 0;
	return {
		createId: () => `${prefix}-${index++}`,
		stroke: "#111",
		fontFamily: "Inter",
	};
}

test("wireframe catalogs cover every component and preset exactly once", () => {
	assert.deepEqual(
		Object.values(WIREFRAME_COMPONENT_CATEGORIES).flat().toSorted(),
		[...WIREFRAME_COMPONENT_IDS].toSorted(),
	);
	assert.deepEqual(
		[...WIREFRAME_BLANK_PRESET_IDS, ...WIREFRAME_STARTER_PRESET_IDS].toSorted(),
		[...WIREFRAME_PRESET_IDS].toSorted(),
	);
});

test("blank wireframe screens persist one canonical frame relationship", () => {
	for (const viewport of ["desktop", "tablet", "mobile"] as const) {
		const elements = createWireframeScreenElements({
			x: 0,
			y: 0,
			viewport,
			defaults: defaults(viewport),
		});
		const frame = elements.find((element) => element.type === "frame");
		assert.ok(frame);
		assert.equal(getWireframeElementMeta(frame)?.wireframeScreenId, frame.id);
		for (const element of elements) {
			assert.ok(!("wireframeScreenId" in (element.customData ?? {})));
			if (element.id !== frame.id) {
				assert.equal(element.frameId, frame.id);
				assert.equal(
					getWireframeElementMeta(element)?.wireframeScreenId,
					frame.id,
				);
			}
		}
	}
});

test("wireframe insertion target follows the selected canonical screen", () => {
	const elements = createWireframeScreenElements({
		x: 400,
		y: 300,
		viewport: "tablet",
		defaults: defaults("target"),
	});
	const map = new Map(elements.map((element) => [element.id, element]));
	const frame = elements.find((element) => element.type === "frame");
	const child = elements.find((element) => element.frameId === frame?.id);
	assert.ok(frame);
	assert.ok(child);
	assert.deepEqual(resolveWireframeInsertionTarget(map, [child]), {
		frameId: frame.id,
		viewport: "tablet",
		point: {
			x: frame.x + frame.width / 2,
			y: frame.y + frame.height / 2,
		},
	});
	assert.equal(resolveWireframeInsertionTarget(map, []), null);
});

test("every built-in wireframe component is an editable canonical group", () => {
	for (const component of WIREFRAME_COMPONENT_IDS) {
		const elements = createWireframeComponentElements({
			component,
			x: 100,
			y: 100,
			frameId: "screen",
			defaults: defaults(component),
		});
		assert.ok(elements.length > 0, `${component} must contain elements`);
		const groupIds = new Set(elements.map((element) => element.groupId));
		assert.equal(groupIds.size, 1, `${component} must be one editable group`);
		assert.ok(elements.every((element) => element.frameId === "screen"));
		assert.ok(
			elements.every(
				(element) =>
					getWireframeElementMeta(element)?.wireframeComponent === component,
			),
		);
	}
});

test("every built-in screen preset keeps all nodes inside its screen frames", () => {
	for (const preset of WIREFRAME_PRESET_IDS) {
		const elements = createWireframePresetElements({
			preset,
			x: 0,
			y: 0,
			defaults: defaults(preset),
		});
		assert.ok(elements.length > 0, `${preset} must contain elements`);
		const frameIds = new Set(
			elements
				.filter((element) => element.type === "frame")
				.map((element) => element.id),
		);
		assert.ok(frameIds.size > 0, `${preset} must contain a screen frame`);
		assert.ok(
			elements.every(
				(element) =>
					element.customData?.wireframePreset === preset &&
					(element.type === "frame" ||
						(!!element.frameId && frameIds.has(element.frameId))),
			),
		);
	}
});

test("cloning a responsive wireframe derives fresh screen references from frameId", () => {
	const source = createWireframePresetElements({
		preset: "responsive-landing",
		x: 0,
		y: 0,
		defaults: defaults("source"),
	});
	const cloneDefaults = defaults("clone");
	const cloned = cloneCanvasSelection({
		elements: source,
		createId: cloneDefaults.createId,
	});
	const clonedFrameIds = new Set(
		cloned.elements
			.filter((element) => element.type === "frame")
			.map((element) => element.id),
	);
	const clonedNodes = cloned.elements.filter(
		(element) => element.customData?.skedraType === "wireframe-node",
	);
	assert.ok(clonedNodes.length > 0);
	assert.ok(
		clonedNodes.every(
			(element) =>
				!!element.frameId &&
				clonedFrameIds.has(element.frameId) &&
				getWireframeElementMeta(element)?.wireframeScreenId === element.frameId,
		),
	);
});
