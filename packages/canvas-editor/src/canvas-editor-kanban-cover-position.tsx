import {
	type KanbanCoverPosition,
	moveKanbanCoverPosition,
} from "@skedra/canvas-core";
import { type PointerEvent, useRef, useState } from "react";

export function CanvasEditorKanbanCoverPosition({
	src,
	alt,
	imageWidth,
	imageHeight,
	aspectRatio,
	position,
	onChange,
	labels,
}: {
	src: string;
	alt: string;
	imageWidth: number;
	imageHeight: number;
	aspectRatio: number;
	position: KanbanCoverPosition;
	onChange: (position: KanbanCoverPosition) => void;
	labels: {
		hint: string;
		horizontal: string;
		vertical: string;
		center: string;
	};
}) {
	const [naturalSize, setNaturalSize] = useState({
		width: imageWidth,
		height: imageHeight,
	});
	const drag = useRef<{
		id: number;
		x: number;
		y: number;
		position: KanbanCoverPosition;
		frame: { width: number; height: number };
	} | null>(null);
	const [dragging, setDragging] = useState(false);
	const ratio = Math.max(0.01, aspectRatio);
	const imageRatio = naturalSize.width / naturalSize.height;
	const canMoveX = imageRatio > ratio + 0.001;
	const canMoveY = imageRatio < ratio - 0.001;
	const move = (event: PointerEvent<HTMLButtonElement>) => {
		const start = drag.current;
		if (!start || start.id !== event.pointerId) return;
		onChange(
			moveKanbanCoverPosition(
				start.position,
				{ x: event.clientX - start.x, y: event.clientY - start.y },
				naturalSize,
				start.frame,
			),
		);
	};
	const cancel = (event: PointerEvent<HTMLButtonElement>) => {
		if (drag.current?.id !== event.pointerId) return;
		onChange(drag.current.position);
		drag.current = null;
		setDragging(false);
	};
	return (
		<div className="canvas-editor__cover-position">
			<button
				type="button"
				className="canvas-editor__cover-position-preview"
				data-kanban-cover-position="true"
				aria-label={labels.hint}
				style={{ aspectRatio: ratio, cursor: dragging ? "grabbing" : "grab" }}
				onPointerDown={(event) => {
					if (event.button !== 0 || drag.current) return;
					event.preventDefault();
					event.currentTarget.focus({ preventScroll: true });
					drag.current = {
						id: event.pointerId,
						x: event.clientX,
						y: event.clientY,
						position,
						frame: event.currentTarget.getBoundingClientRect(),
					};
					event.currentTarget.setPointerCapture(event.pointerId);
					setDragging(true);
				}}
				onPointerMove={move}
				onPointerUp={(event) => {
					if (drag.current?.id !== event.pointerId) return;
					move(event);
					drag.current = null;
					setDragging(false);
					event.currentTarget.releasePointerCapture(event.pointerId);
				}}
				onPointerCancel={cancel}
				onLostPointerCapture={cancel}
				onKeyDown={(event) => {
					const step = event.shiftKey ? 10 : 1;
					const x =
						canMoveX && event.key === "ArrowLeft"
							? -step
							: canMoveX && event.key === "ArrowRight"
								? step
								: 0;
					const y =
						canMoveY && event.key === "ArrowUp"
							? -step
							: canMoveY && event.key === "ArrowDown"
								? step
								: 0;
					if (!x && !y) return;
					event.preventDefault();
					event.stopPropagation();
					onChange({
						x: Math.max(0, Math.min(100, position.x + x)),
						y: Math.max(0, Math.min(100, position.y + y)),
					});
				}}
			>
				<img
					src={src}
					alt={alt}
					draggable={false}
					onLoad={(event) =>
						setNaturalSize({
							width: event.currentTarget.naturalWidth,
							height: event.currentTarget.naturalHeight,
						})
					}
					style={{ objectPosition: `${position.x}% ${position.y}%` }}
				/>
			</button>
			<div className="canvas-editor__cover-position-controls">
				<p>{labels.hint}</p>
				{(["x", "y"] as const).map(
					(axis) =>
						(axis === "x" ? canMoveX : canMoveY) && (
							<label key={axis}>
								<span>
									{axis === "x" ? labels.horizontal : labels.vertical}
								</span>
								<input
									type="range"
									min={0}
									max={100}
									step={1}
									value={position[axis]}
									onChange={(event) =>
										onChange({
											...position,
											[axis]: Number(event.target.value),
										})
									}
								/>
							</label>
						),
				)}
				<button
					type="button"
					className="canvas-editor__cover-position-center"
					onClick={() => onChange({ x: 50, y: 50 })}
				>
					{labels.center}
				</button>
			</div>
		</div>
	);
}
