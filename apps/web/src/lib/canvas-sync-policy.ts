export const CANVAS_UPDATE_COMPACT_AFTER_COUNT = 500;
export const CANVAS_UPDATE_COMPACT_AFTER_BYTES = 1_500_000;

// Frequent live notifications must not repeatedly cancel a slow proxy response.
export const CANVAS_LIVE_REFETCH_OPTIONS = { cancelRefetch: false } as const;

export interface CanvasUpdateLogSize {
	updateCount: number;
	compactableBytes: number;
}

/**
 * `compactableBytes` excludes the first base/snapshot row. A large board state is
 * therefore not compacted after every subsequent edit; only the accumulated
 * delta log is compared with the byte threshold.
 */
export function shouldCompactCanvasUpdateLog({
	updateCount,
	compactableBytes,
}: CanvasUpdateLogSize) {
	return (
		updateCount >= CANVAS_UPDATE_COMPACT_AFTER_COUNT ||
		compactableBytes >= CANVAS_UPDATE_COMPACT_AFTER_BYTES
	);
}
