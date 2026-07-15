/**
 * Bild am Viewport-Zentrum einfuegen (Toolbar, Tastatur "9").
 */

import {
	type CanvasElement,
	createImageCanvasElement,
	fitImageSize,
} from "@skedra/canvas-core";
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
