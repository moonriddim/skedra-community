import { getBBox } from "./geometry";
import type { CanvasElement } from "./types";

export type AlignEdge =
	| "top"
	| "bottom"
	| "left"
	| "right"
	| "horizontal-center"
	| "vertical-center";

export type DistributionAxis = "horizontal" | "vertical";

export function getAlignmentUpdates(
	elements: CanvasElement[],
	edge: AlignEdge,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	if (elements.length < 2) return [];

	const items = elements.map((el) => ({ el, box: getBBox(el) }));

	let target = 0;
	switch (edge) {
		case "top":
			target = Math.min(...items.map((item) => item.box.y));
			return items.map(({ el, box }) => ({
				id: el.id,
				changes: { y: el.y + (target - box.y) },
			}));
		case "bottom":
			target = Math.max(...items.map((item) => item.box.y + item.box.height));
			return items.map(({ el, box }) => ({
				id: el.id,
				changes: { y: el.y + (target - (box.y + box.height)) },
			}));
		case "left":
			target = Math.min(...items.map((item) => item.box.x));
			return items.map(({ el, box }) => ({
				id: el.id,
				changes: { x: el.x + (target - box.x) },
			}));
		case "right":
			target = Math.max(...items.map((item) => item.box.x + item.box.width));
			return items.map(({ el, box }) => ({
				id: el.id,
				changes: { x: el.x + (target - (box.x + box.width)) },
			}));
		case "horizontal-center":
			target =
				items.reduce((sum, item) => sum + item.box.x + item.box.width / 2, 0) /
				items.length;
			return items.map(({ el, box }) => ({
				id: el.id,
				changes: { x: el.x + (target - (box.x + box.width / 2)) },
			}));
		case "vertical-center":
			target =
				items.reduce((sum, item) => sum + item.box.y + item.box.height / 2, 0) /
				items.length;
			return items.map(({ el, box }) => ({
				id: el.id,
				changes: { y: el.y + (target - (box.y + box.height / 2)) },
			}));
	}
}

/** Distributes three or more elements with equal gaps while preserving the outer pair. */
export function getDistributionUpdates(
	elements: CanvasElement[],
	axis: DistributionAxis,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	if (elements.length < 3) return [];
	const horizontal = axis === "horizontal";
	const items = elements
		.map((el) => ({ el, box: getBBox(el) }))
		.sort((left, right) =>
			horizontal
				? left.box.x - right.box.x || left.box.y - right.box.y
				: left.box.y - right.box.y || left.box.x - right.box.x,
		);
	const first = items[0];
	const last = items[items.length - 1];
	const occupied = items.reduce(
		(sum, item) => sum + (horizontal ? item.box.width : item.box.height),
		0,
	);
	const span = horizontal
		? last.box.x + last.box.width - first.box.x
		: last.box.y + last.box.height - first.box.y;
	const gap = (span - occupied) / (items.length - 1);
	let cursor = horizontal ? first.box.x : first.box.y;

	return items.map(({ el, box }, index) => {
		if (index === 0 || index === items.length - 1) {
			cursor += (horizontal ? box.width : box.height) + gap;
			return { id: el.id, changes: {} };
		}
		const delta = cursor - (horizontal ? box.x : box.y);
		cursor += (horizontal ? box.width : box.height) + gap;
		return {
			id: el.id,
			changes: horizontal ? { x: el.x + delta } : { y: el.y + delta },
		};
	});
}
