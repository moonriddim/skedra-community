import {
	type BBox,
	bboxInRect,
	getBBox,
	getCombinedBBox,
	isElementVisibleInViewport,
} from "./geometry-bbox";
import { type HitTestOptions, hitTest } from "./hit-test";
import {
	getHitTestOrderedElements,
	isKanbanCard,
	isKanbanList,
} from "./kanban";
import { type MindmapDirection, getMindmapNodeMeta } from "./mindmap";
import {
	compareCanvasElementStackOrder,
	normalizeCanvasElementStackIndexes,
	sortCanvasElements,
} from "./ordering";
import { elementMatchesLasso } from "./selection";
import type { CanvasElement } from "./types";

const VISIBLE_ELEMENTS_CACHE_LIMIT = 32;

export class CanvasScene {
	private readonly elements: Map<string, CanvasElement>;
	private readonly sortedElements: CanvasElement[];
	private readonly bboxCache = new Map<string, BBox>();
	private readonly selectedElementsCache = new Map<string, CanvasElement[]>();
	private readonly visibleElementsCache = new Map<string, CanvasElement[]>();
	private readonly mindmapChildrenCache = new Map<string, CanvasElement[]>();
	private hitTestOrderedElements: CanvasElement[] | null = null;
	private kanbanLists: CanvasElement[] | null = null;
	private kanbanCardsByList: Map<string, CanvasElement[]> | null = null;

	private constructor(
		elements: Iterable<CanvasElement> | Map<string, CanvasElement>,
		preparedSortedElements?: CanvasElement[],
	) {
		if (preparedSortedElements) {
			this.elements =
				elements instanceof Map
					? elements
					: new Map(
							Array.from(elements, (element) => [element.id, element] as const),
						);
			this.sortedElements = preparedSortedElements;
			return;
		}
		const normalized = normalizeCanvasElementStackIndexes(
			elements instanceof Map ? elements.values() : elements,
		);
		this.elements = new Map(normalized.map((element) => [element.id, element]));
		// normalizeCanvasElementStackIndexes already returns stack-sorted elements.
		this.sortedElements = normalized;
	}

	static empty() {
		return new CanvasScene([]);
	}

	static from(elements: Iterable<CanvasElement> | Map<string, CanvasElement>) {
		return new CanvasScene(elements);
	}

	/**
	 * Applies a small Y.js change set while preserving references for untouched
	 * elements. Geometry-only updates keep the existing stack order and avoid a
	 * full scene normalize/sort pass.
	 */
	withElementChanges(
		changes: ReadonlyMap<string, CanvasElement | null>,
	): CanvasScene {
		if (changes.size === 0) return this;

		const nextElements = new Map(this.elements);
		let requiresResort = false;
		let changed = false;
		for (const [id, next] of changes) {
			const previous = this.elements.get(id) ?? null;
			if (previous === next) continue;
			if (!previous && !next) continue;
			changed = true;
			if (!previous || !next || previous.stackIndex !== next.stackIndex) {
				requiresResort = true;
			}
			if (next) nextElements.set(id, next);
			else nextElements.delete(id);
		}
		if (!changed) return this;
		if (requiresResort) return new CanvasScene(nextElements);

		const nextSortedElements = this.sortedElements.map(
			(element) => changes.get(element.id) ?? element,
		);
		return new CanvasScene(nextElements, nextSortedElements);
	}

	get size() {
		return this.elements.size;
	}

	getElement(id: string) {
		return this.elements.get(id) ?? null;
	}

	getElementsMap() {
		return this.elements;
	}

	getSortedElements() {
		return this.sortedElements;
	}

	getSelectedElements(selectedIds: Set<string>) {
		const key = idsCacheKey(selectedIds);
		const cached = this.selectedElementsCache.get(key);
		if (cached) return cached;
		const selected = Array.from(selectedIds)
			.map((id) => this.elements.get(id))
			.filter((element): element is CanvasElement => element != null);
		this.selectedElementsCache.set(key, selected);
		return selected;
	}

	getElementBBox(element: CanvasElement) {
		const cached = this.bboxCache.get(element.id);
		if (cached) return cached;
		const bbox = getBBox(element);
		this.bboxCache.set(element.id, bbox);
		return bbox;
	}

	getCombinedBBox(elements: Iterable<CanvasElement>) {
		return getCombinedBBox(Array.from(elements));
	}

	getVisibleElements(visibleBounds: BBox, selectedIds: Set<string>) {
		const key = `${visibleBounds.x}:${visibleBounds.y}:${visibleBounds.width}:${visibleBounds.height}:${idsCacheKey(selectedIds)}`;
		const cached = this.visibleElementsCache.get(key);
		if (cached) return cached;
		const visible = this.sortedElements.filter((element) =>
			isElementVisibleInViewport(element, visibleBounds, selectedIds),
		);
		if (this.visibleElementsCache.size >= VISIBLE_ELEMENTS_CACHE_LIMIT) {
			const oldestKey = this.visibleElementsCache.keys().next().value;
			if (oldestKey !== undefined) this.visibleElementsCache.delete(oldestKey);
		}
		this.visibleElementsCache.set(key, visible);
		return visible;
	}

	getHitTestOrderedElements() {
		this.hitTestOrderedElements ??= getHitTestOrderedElements(
			this.sortedElements,
		);
		return this.hitTestOrderedElements;
	}

	getElementAtPosition(x: number, y: number, options: HitTestOptions = {}) {
		for (const element of this.getHitTestOrderedElements()) {
			if (element.locked) continue;
			if (hitTest(element, x, y, options)) return element;
		}
		return null;
	}

	getElementsToEraseAtPosition(
		x: number,
		y: number,
		radius: number,
		alreadyErased: Set<string>,
	) {
		const matches: CanvasElement[] = [];
		for (const element of this.getHitTestOrderedElements()) {
			if (element.locked || alreadyErased.has(element.id)) continue;
			if (hitTest(element, x, y, radius)) matches.push(element);
		}
		return matches;
	}

	getElementsInRect(box: {
		startX: number;
		startY: number;
		endX: number;
		endY: number;
	}) {
		const rx = Math.min(box.startX, box.endX);
		const ry = Math.min(box.startY, box.endY);
		const rw = Math.abs(box.endX - box.startX);
		const rh = Math.abs(box.endY - box.startY);
		if (rw <= 3 && rh <= 3) return [];

		return this.sortedElements.filter((element) =>
			bboxInRect(this.getElementBBox(element), rx, ry, rw, rh),
		);
	}

	getElementsInLassoPath(path: [number, number][]) {
		return this.sortedElements.filter((element) =>
			elementMatchesLasso(this.getElementBBox(element), path),
		);
	}

	getKanbanLists() {
		this.kanbanLists ??= this.sortedElements.filter(isKanbanList);
		return this.kanbanLists;
	}

	getKanbanListAtPosition(x: number, y: number) {
		let hit: CanvasElement | null = null;
		for (const element of this.getKanbanLists()) {
			if (
				x < element.x ||
				x > element.x + element.width ||
				y < element.y ||
				y > element.y + element.height
			) {
				continue;
			}
			if (!hit || compareCanvasElementStackOrder(element, hit) >= 0) {
				hit = element;
			}
		}
		return hit;
	}

	getKanbanCardsForList(listId: string) {
		if (!this.kanbanCardsByList) {
			const byList = new Map<string, CanvasElement[]>();
			for (const element of this.sortedElements) {
				if (!isKanbanCard(element) || !element.frameId) continue;
				const cards = byList.get(element.frameId) ?? [];
				cards.push(element);
				byList.set(element.frameId, cards);
			}
			for (const cards of byList.values()) {
				cards.sort((left, right) => {
					if (left.y !== right.y) return left.y - right.y;
					return left.x - right.x;
				});
			}
			this.kanbanCardsByList = byList;
		}
		return this.kanbanCardsByList.get(listId) ?? [];
	}

	getMindmapChildNodes(parentId: string | null, direction: MindmapDirection) {
		const key = `${parentId ?? "__root__"}:${direction}`;
		const cached = this.mindmapChildrenCache.get(key);
		if (cached) return cached;
		const children = this.sortedElements
			.filter((element) => {
				const meta = getMindmapNodeMeta(element);
				return (
					meta?.mindmapParentId === parentId &&
					meta.mindmapDirection === direction
				);
			})
			.sort((left, right) =>
				direction === "left" || direction === "right"
					? left.y - right.y
					: left.x - right.x,
			);
		this.mindmapChildrenCache.set(key, children);
		return children;
	}
}

function idsCacheKey(ids: Set<string>) {
	return Array.from(ids).sort().join(",");
}
