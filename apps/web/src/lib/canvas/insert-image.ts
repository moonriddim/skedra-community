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
import { externalizeInlineImageElements } from "./inline-image-assets";

export async function pickAndBuildImageElements(
	center: {
		x: number;
		y: number;
	},
	theme?: CanvasThemeState,
	uploadOptions?: ImageUploadOptions,
): Promise<CanvasElement[]> {
	// SVGs zuerst inline lesen: Lassen sie sich in Formen umwandeln, braucht es
	// gar keinen Upload.
	const picked = await pickImageFile(uploadOptions, { keepSvgInline: true });
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
		// Eingebettete Rasterbilder im SVG werden als Assets ausgelagert.
		if (imported) {
			return externalizeInlineImageElements(imported.elements, uploadOptions);
		}
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

	// Nicht umwandelbares SVG (oder kein Speicher beim Lesen): als Asset
	// hochladen, sofern möglich; sonst bleibt es inline.
	return externalizeInlineImageElements([element], uploadOptions);
}
