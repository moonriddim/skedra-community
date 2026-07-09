/**
 * Bild am Viewport-Zentrum einfuegen (Toolbar, Tastatur "9").
 */

import {
	type CanvasElement,
	createImageCanvasElement,
} from "@skedra/canvas-core";
import type { CanvasThemeState } from "./canvas-defaults";
import { getCanvasElementFactoryDefaults } from "./canvas-factory-defaults";
import { fitImageSize, pickImageFile } from "./image-utils";

export async function pickAndBuildImageElements(
	center: {
		x: number;
		y: number;
	},
	theme?: CanvasThemeState,
): Promise<CanvasElement[]> {
	const picked = await pickImageFile();
	if (!picked) return [];

	const fitted = fitImageSize(picked.width, picked.height, 480, 360);
	return [
		createImageCanvasElement(getCanvasElementFactoryDefaults(theme), {
			x: center.x - fitted.width / 2,
			y: center.y - fitted.height / 2,
			src: picked.src,
			width: fitted.width,
			height: fitted.height,
			alt: picked.name,
		}),
	];
}
