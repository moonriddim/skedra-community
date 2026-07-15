import { getCombinedBBox } from "./geometry";
import type { CanvasElement } from "./types";

export type AlignEdge =
	| "top"
	| "bottom"
	| "left"
	| "right"
	| "horizontal-center"
	| "vertical-center";

export type DistributionAxis = "horizontal" | "vertical";

interface CanvasLayoutItem {
	elements: CanvasElement[];
	box: NonNullable<ReturnType<typeof getCombinedBBox>>;
}

function getCanvasLayoutKey(element: CanvasElement): string {
	return element.groupId ? `group:${element.groupId}` : `element:${element.id}`;
}

function getCanvasLayoutItems(elements: CanvasElement[]): CanvasLayoutItem[] {
	const groups = new Map<string, CanvasElement[]>();
	for (const element of elements) {
		const key = getCanvasLayoutKey(element);
		const group = groups.get(key);
		if (group) group.push(element);
		else groups.set(key, [element]);
	}

	return Array.from(groups.values(), (group) => ({
		elements: group,
		box: getCombinedBBox(group) as NonNullable<
			ReturnType<typeof getCombinedBBox>
		>,
	}));
}

export function getCanvasLayoutItemCount(elements: CanvasElement[]): number {
	return new Set(elements.map(getCanvasLayoutKey)).size;
}

export function getAlignmentUpdates(
	elements: CanvasElement[],
	edge: AlignEdge,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const items = getCanvasLayoutItems(elements);
	if (items.length < 2) return [];
	const selectionBox = getCombinedBBox(elements);
	if (!selectionBox) return [];

	let target = 0;
	switch (edge) {
		case "top":
			target = selectionBox.y;
			return items.flatMap(({ elements: group, box }) =>
				group.map((element) => ({
					id: element.id,
					changes: { y: element.y + (target - box.y) },
				})),
			);
		case "bottom":
			target = selectionBox.y + selectionBox.height;
			return items.flatMap(({ elements: group, box }) =>
				group.map((element) => ({
					id: element.id,
					changes: {
						y: element.y + (target - (box.y + box.height)),
					},
				})),
			);
		case "left":
			target = selectionBox.x;
			return items.flatMap(({ elements: group, box }) =>
				group.map((element) => ({
					id: element.id,
					changes: { x: element.x + (target - box.x) },
				})),
			);
		case "right":
			target = selectionBox.x + selectionBox.width;
			return items.flatMap(({ elements: group, box }) =>
				group.map((element) => ({
					id: element.id,
					changes: {
						x: element.x + (target - (box.x + box.width)),
					},
				})),
			);
		case "horizontal-center":
			target = selectionBox.x + selectionBox.width / 2;
			return items.flatMap(({ elements: group, box }) =>
				group.map((element) => ({
					id: element.id,
					changes: {
						x: element.x + (target - (box.x + box.width / 2)),
					},
				})),
			);
		case "vertical-center":
			target = selectionBox.y + selectionBox.height / 2;
			return items.flatMap(({ elements: group, box }) =>
				group.map((element) => ({
					id: element.id,
					changes: {
						y: element.y + (target - (box.y + box.height / 2)),
					},
				})),
			);
	}
}

/** Distributes three or more elements with equal gaps while preserving the outer pair. */
export function getDistributionUpdates(
	elements: CanvasElement[],
	axis: DistributionAxis,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const layoutItems = getCanvasLayoutItems(elements);
	if (layoutItems.length < 3) return [];
	const horizontal = axis === "horizontal";
	const items = layoutItems.sort((left, right) =>
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

	return items.flatMap(({ elements: group, box }, index) => {
		if (index === 0 || index === items.length - 1) {
			cursor += (horizontal ? box.width : box.height) + gap;
			return group.map((element) => ({ id: element.id, changes: {} }));
		}
		const delta = cursor - (horizontal ? box.x : box.y);
		cursor += (horizontal ? box.width : box.height) + gap;
		return group.map((element) => ({
			id: element.id,
			changes: horizontal ? { x: element.x + delta } : { y: element.y + delta },
		}));
	});
}
