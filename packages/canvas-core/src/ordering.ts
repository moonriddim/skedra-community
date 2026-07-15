import type { CanvasElement } from "./types";

const STACK_INDEX_STEP = 1n << 64n;
const STACK_INDEX_OFFSET = 1n << 128n;
const STACK_INDEX_WIDTH = 26;
const STACK_INDEX_TIE_SEPARATOR = ":";

function formatStackRank(rank: bigint, tieBreaker?: string): string {
	const normalized = rank + STACK_INDEX_OFFSET;
	const rankKey = (normalized > 0n ? normalized : 0n)
		.toString(36)
		.padStart(STACK_INDEX_WIDTH, "0");
	const suffix = formatStackTieBreaker(tieBreaker);
	return suffix ? `${rankKey}${STACK_INDEX_TIE_SEPARATOR}${suffix}` : rankKey;
}

function formatStackTieBreaker(tieBreaker: string | undefined): string {
	if (!tieBreaker) return "";
	return tieBreaker.replace(/[^0-9A-Za-z_-]/g, "_").slice(0, 64);
}

function readStackRankKey(stackIndex: string | undefined): string | null {
	if (!stackIndex) return null;
	const [rankKey] = stackIndex.split(STACK_INDEX_TIE_SEPARATOR);
	return rankKey.length > 0 ? rankKey : null;
}

function parseBase36BigInt(value: string): bigint | null {
	let parsed = 0n;
	for (const char of value.toLowerCase()) {
		const digit = Number.parseInt(char, 36);
		if (!Number.isFinite(digit) || digit < 0 || digit >= 36) return null;
		parsed = parsed * 36n + BigInt(digit);
	}
	return parsed;
}

function parseStackRank(stackIndex: string | undefined): bigint | null {
	const rankKey = readStackRankKey(stackIndex);
	if (!rankKey) return null;
	const parsed = parseBase36BigInt(rankKey);
	if (parsed == null) return null;
	return parsed - STACK_INDEX_OFFSET;
}

function compareStackRanks(left: bigint, right: bigint): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

export function compareCanvasElementStackOrder(
	left: CanvasElement,
	right: CanvasElement,
): number {
	const leftRank = parseStackRank(left.stackIndex);
	const rightRank = parseStackRank(right.stackIndex);

	if (leftRank != null && rightRank != null) {
		const rankOrder = compareStackRanks(leftRank, rightRank);
		if (rankOrder !== 0) return rankOrder;
		const tieOrder = (left.stackIndex ?? "").localeCompare(
			right.stackIndex ?? "",
		);
		if (tieOrder !== 0) return tieOrder;
	}

	if (leftRank != null && rightRank == null) return 1;
	if (leftRank == null && rightRank != null) return -1;

	return left.id.localeCompare(right.id);
}

export function sortCanvasElements(
	elements: Iterable<CanvasElement>,
): CanvasElement[] {
	return Array.from(elements).sort(compareCanvasElementStackOrder);
}

export function normalizeCanvasElementStackIndexes(
	elements: Iterable<CanvasElement>,
): CanvasElement[] {
	return sortCanvasElements(elements).map((element, index) => {
		if (element.stackIndex) return element;
		return {
			...element,
			stackIndex: formatStackRank(BigInt(index) * STACK_INDEX_STEP, element.id),
		};
	});
}

export function createStackIndexAfter(
	elements: Iterable<CanvasElement>,
	tieBreaker?: string,
): string {
	const sorted = normalizeCanvasElementStackIndexes(elements);
	const last = sorted[sorted.length - 1];
	const lastRank = parseStackRank(last?.stackIndex) ?? -STACK_INDEX_STEP;
	return formatStackRank(lastRank + STACK_INDEX_STEP, tieBreaker);
}

export function createStackIndexBefore(
	elements: Iterable<CanvasElement>,
	tieBreaker?: string,
): string {
	const sorted = normalizeCanvasElementStackIndexes(elements);
	const first = sorted[0];
	const firstRank = parseStackRank(first?.stackIndex) ?? STACK_INDEX_STEP;
	return formatStackRank(firstRank - STACK_INDEX_STEP, tieBreaker);
}

export function createStackIndexBetween(
	previous: CanvasElement | null | undefined,
	next: CanvasElement | null | undefined,
	tieBreaker?: string,
): string {
	const previousRank = parseStackRank(previous?.stackIndex);
	const nextRank = parseStackRank(next?.stackIndex);

	if (previousRank != null && nextRank != null) {
		const gap = nextRank - previousRank;
		if (gap > 1n) {
			return formatStackRank(previousRank + gap / 2n, tieBreaker);
		}
		return formatStackRank(previousRank, tieBreaker);
	}
	if (previousRank != null)
		return formatStackRank(previousRank + STACK_INDEX_STEP, tieBreaker);
	if (nextRank != null)
		return formatStackRank(nextRank - STACK_INDEX_STEP, tieBreaker);
	return formatStackRank(0n, tieBreaker);
}

export function createStackIndexBeforeElement(
	elements: Iterable<CanvasElement>,
	elementId: string,
	tieBreaker?: string,
): string {
	const sorted = normalizeCanvasElementStackIndexes(elements);
	const index = sorted.findIndex((element) => element.id === elementId);
	if (index < 0) return createStackIndexAfter(sorted, tieBreaker);
	return createStackIndexBetween(sorted[index - 1], sorted[index], tieBreaker);
}

export function createStackIndexAfterElement(
	elements: Iterable<CanvasElement>,
	elementId: string,
	tieBreaker?: string,
): string {
	const sorted = normalizeCanvasElementStackIndexes(elements);
	const index = sorted.findIndex((element) => element.id === elementId);
	if (index < 0) return createStackIndexAfter(sorted, tieBreaker);
	return createStackIndexBetween(sorted[index], sorted[index + 1], tieBreaker);
}

export function buildBringForwardUpdates(
	elements: Iterable<CanvasElement>,
	selectedIds: Set<string>,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const sorted = normalizeCanvasElementStackIndexes(elements);
	const target = [...sorted];
	for (let index = sorted.length - 2; index >= 0; index--) {
		const current = target[index];
		const next = target[index + 1];
		if (!selectedIds.has(current.id) || selectedIds.has(next.id)) continue;
		target[index] = next;
		target[index + 1] = current;
	}
	return buildSelectedStackIndexUpdates(target, selectedIds);
}

export function buildSendBackwardUpdates(
	elements: Iterable<CanvasElement>,
	selectedIds: Set<string>,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const sorted = normalizeCanvasElementStackIndexes(elements);
	const target = [...sorted];
	for (let index = 1; index < sorted.length; index++) {
		const current = target[index];
		const previous = target[index - 1];
		if (!selectedIds.has(current.id) || selectedIds.has(previous.id)) continue;
		target[index] = previous;
		target[index - 1] = current;
	}
	return buildSelectedStackIndexUpdates(target, selectedIds);
}

export function buildBringToFrontUpdates(
	elements: Iterable<CanvasElement>,
	selectedIds: Set<string>,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const sorted = normalizeCanvasElementStackIndexes(elements);
	const selected = sorted.filter((element) => selectedIds.has(element.id));
	const rest = sorted.filter((element) => !selectedIds.has(element.id));
	return buildSelectedStackIndexUpdates([...rest, ...selected], selectedIds);
}

export function buildSendToBackUpdates(
	elements: Iterable<CanvasElement>,
	selectedIds: Set<string>,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const sorted = normalizeCanvasElementStackIndexes(elements);
	const selected = sorted.filter((element) => selectedIds.has(element.id));
	const rest = sorted.filter((element) => !selectedIds.has(element.id));
	return buildSelectedStackIndexUpdates([...selected, ...rest], selectedIds);
}

/**
 * Verschiebt ein Element in der Stapel-Reihenfolge direkt ueber oder unter
 * ein Ziel-Element (fuer Drag-und-Drop im Layer-Panel).
 */
export function buildLayerReorderUpdates(
	elements: Iterable<CanvasElement>,
	movedId: string,
	targetId: string,
	position: "above" | "below",
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	if (movedId === targetId) return [];
	const sorted = normalizeCanvasElementStackIndexes(elements);
	const withoutMoved = sorted.filter((element) => element.id !== movedId);
	const moved = sorted.find((element) => element.id === movedId);
	const targetIndex = withoutMoved.findIndex(
		(element) => element.id === targetId,
	);
	if (!moved || targetIndex < 0) return [];

	/* "above" = weiter oben im Stapel = NACH dem Ziel in sortierter Liste. */
	const insertIndex = position === "above" ? targetIndex + 1 : targetIndex;
	const previous = withoutMoved[insertIndex - 1] ?? null;
	const next = withoutMoved[insertIndex] ?? null;
	const stackIndex = createStackIndexBetween(previous, next, movedId);
	if (moved.stackIndex === stackIndex) return [];
	return [{ id: movedId, changes: { stackIndex } }];
}

function buildSelectedStackIndexUpdates(
	target: CanvasElement[],
	selectedIds: Set<string>,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];
	const assigned = [...target];
	for (let index = 0; index < target.length; index++) {
		const element = assigned[index];
		if (!selectedIds.has(element.id)) continue;
		const previous = assigned[index - 1] ?? null;
		const next = findNextUnselectedElement(assigned, selectedIds, index + 1);
		const nextStackIndex = createStackIndexBetween(previous, next, element.id);
		if (element.stackIndex === nextStackIndex) continue;
		assigned[index] = { ...element, stackIndex: nextStackIndex };
		updates.push({
			id: element.id,
			changes: {
				stackIndex: nextStackIndex,
			},
		});
	}
	return updates;
}

function findNextUnselectedElement(
	elements: CanvasElement[],
	selectedIds: Set<string>,
	startIndex: number,
) {
	for (let index = startIndex; index < elements.length; index++) {
		const element = elements[index];
		if (!selectedIds.has(element.id)) return element;
	}
	return null;
}
