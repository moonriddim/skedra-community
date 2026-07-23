/**
 * Bild am Viewport-Zentrum einfuegen (Toolbar, Tastatur "9").
 */

import {
	type CanvasElement,
	createImageCanvasElement,
	fitImageSize,
	parseSvgToCanvasElements,
} from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import type { CanvasThemeState } from "./canvas-defaults";
import { getCanvasElementFactoryDefaults } from "./canvas-factory-defaults";
import { type ImageUploadOptions, pickImageFile } from "./image-utils";

export async function pickAndBuildImageElements(
	center: {
		x: number;
		y: number;
	},
	theme?: CanvasThemeState,
	uploadOptions?: ImageUploadOptions,
): Promise<CanvasElement[]> {
	const picked = await pickImageFile(uploadOptions);
	if (!picked) return [];
	if (picked.svgText) {
		const imported = parseSvgToCanvasElements(picked.svgText, {
			createId: nanoid,
			stroke: theme?.resolvedTheme === "dark" ? "#f5f5f4" : "#17211d",
			target: center,
			maxWidth: 480,
			maxHeight: 360,
			sourceName: picked.name,
		});
		if (imported) return imported.elements;
	}

	const fitted = fitImageSize(picked.width, picked.height, 480, 360);
	const element = createImageCanvasElement(
		getCanvasElementFactoryDefaults(theme),
		{
			x: center.x - fitted.width / 2,
			y: center.y - fitted.height / 2,
			src: picked.src,
			width: picked.width,
			height: picked.height,
			alt: picked.name,
		},
	);
	if (picked.assetId) {
		element.customData = {
			...(element.customData ?? {}),
			assetId: picked.assetId,
		};
	}

	return [element];
}
