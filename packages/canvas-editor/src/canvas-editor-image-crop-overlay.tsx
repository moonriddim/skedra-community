/**
 * Bild-Zuschneiden: Overlay mit verschiebbarem Crop-Rechteck.
 */

import {
	type ImageCropRect,
	clampCropRect,
	getCropBoundsInElementSpace,
} from "@skedra/canvas-core";
import type { CanvasElement, Viewport } from "@skedra/canvas-core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasEditorBeginAuxiliaryPointerGesture } from "./use-canvas-editor-pointer";

export interface CanvasEditorImageCropOverlayProps {
	element: CanvasElement;
	viewport: Viewport;
	onApply: (crop: ImageCropRect) => void;
	onCancel: () => void;
	beginAuxiliaryPointerGesture?: CanvasEditorBeginAuxiliaryPointerGesture;
}

export function CanvasEditorImageCropOverlay({
	element,
	viewport,
	onApply,
	onCancel,
	beginAuxiliaryPointerGesture,
}: CanvasEditorImageCropOverlayProps) {
	const initial = getCropBoundsInElementSpace(element);
	const [crop, setCrop] = useState({
		x: initial.x,
		y: initial.y,
		width: initial.width,
		height: initial.height,
	});
	const dragRef = useRef<{
		mode: "move" | "resize";
		startX: number;
		startY: number;
		startCrop: typeof crop;
	} | null>(null);

	const toFraction = useCallback(
		(next: typeof crop): ImageCropRect =>
			clampCropRect({
				x: (next.x - element.x) / element.width,
				y: (next.y - element.y) / element.height,
				width: next.width / element.width,
				height: next.height / element.height,
			}),
		[element.height, element.width, element.x, element.y],
	);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.isComposing) return;
			if (event.key === "Escape") {
				event.preventDefault();
				onCancel();
			}
			if (event.key === "Enter") {
				event.preventDefault();
				onApply(toFraction(crop));
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [crop, onApply, onCancel, toFraction]);

	const onPointerDown = (
		event: React.PointerEvent<SVGElement>,
		mode: "move" | "resize",
	) => {
		event.preventDefault();
		event.stopPropagation();
		const startCrop = crop;
		if (
			beginAuxiliaryPointerGesture &&
			!beginAuxiliaryPointerGesture(event, () => {
				dragRef.current = null;
				setCrop(startCrop);
			})
		) {
			return;
		}
		dragRef.current = {
			mode,
			startX: event.clientX,
			startY: event.clientY,
			startCrop: crop,
		};
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {
			// The browser may already have cancelled the pointer.
		}
	};

	const onPointerMove = (event: React.PointerEvent) => {
		const drag = dragRef.current;
		if (!drag) return;
		const dx = (event.clientX - drag.startX) / viewport.zoom;
		const dy = (event.clientY - drag.startY) / viewport.zoom;

		if (drag.mode === "move") {
			const maxX = element.x + element.width - drag.startCrop.width;
			const maxY = element.y + element.height - drag.startCrop.height;
			setCrop({
				...drag.startCrop,
				x: Math.max(element.x, Math.min(maxX, drag.startCrop.x + dx)),
				y: Math.max(element.y, Math.min(maxY, drag.startCrop.y + dy)),
			});
			return;
		}

		setCrop({
			...drag.startCrop,
			width: Math.max(24, drag.startCrop.width + dx),
			height: Math.max(24, drag.startCrop.height + dy),
		});
	};

	const onPointerUp = () => {
		dragRef.current = null;
	};

	const stroke = 1.5 / viewport.zoom;
	const handle = 10 / viewport.zoom;

	return (
		<g
			className="image-crop-overlay"
			data-ui-only="true"
			data-skedra-ui="image-crop"
			pointerEvents="none"
		>
			{/* Abdunklung ausserhalb Crop */}
			<rect
				x={element.x}
				y={element.y}
				width={element.width}
				height={Math.max(0, crop.y - element.y)}
				fill="rgba(0,0,0,0.45)"
			/>
			<rect
				x={element.x}
				y={crop.y + crop.height}
				width={element.width}
				height={Math.max(
					0,
					element.y + element.height - (crop.y + crop.height),
				)}
				fill="rgba(0,0,0,0.45)"
			/>
			<rect
				x={element.x}
				y={crop.y}
				width={Math.max(0, crop.x - element.x)}
				height={crop.height}
				fill="rgba(0,0,0,0.45)"
			/>
			<rect
				x={crop.x + crop.width}
				y={crop.y}
				width={Math.max(0, element.x + element.width - (crop.x + crop.width))}
				height={crop.height}
				fill="rgba(0,0,0,0.45)"
			/>

			<rect
				x={crop.x}
				y={crop.y}
				width={crop.width}
				height={crop.height}
				fill="transparent"
				stroke="#6366f1"
				strokeWidth={stroke}
				strokeDasharray={`${4 / viewport.zoom}`}
				pointerEvents="all"
				onPointerDown={(event) => onPointerDown(event, "move")}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
				onLostPointerCapture={onPointerUp}
			/>

			<rect
				className="canvas-editor__coarse-pointer-target"
				x={crop.x + crop.width - handle / 2}
				y={crop.y + crop.height - handle / 2}
				width={handle}
				height={handle}
				fill="none"
				stroke="transparent"
				onPointerDown={(event) => onPointerDown(event, "resize")}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
				onLostPointerCapture={onPointerUp}
			/>

			<rect
				x={crop.x + crop.width - handle / 2}
				y={crop.y + crop.height - handle / 2}
				width={handle}
				height={handle}
				rx={2 / viewport.zoom}
				fill="#6366f1"
				stroke="#fff"
				strokeWidth={stroke}
				pointerEvents="all"
				onPointerDown={(event) => onPointerDown(event, "resize")}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
				onLostPointerCapture={onPointerUp}
			/>
		</g>
	);
}
