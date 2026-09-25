import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
	CANVAS_LIVE_REFETCH_OPTIONS,
	CANVAS_UPDATE_COMPACT_AFTER_BYTES,
	CANVAS_UPDATE_COMPACT_AFTER_COUNT,
	shouldCompactCanvasUpdateLog,
} from "./canvas-sync-policy";

test("live notifications do not starve an in-flight response over a slow proxy", async () => {
	const client = new QueryClient();
	let deliver!: (value: string[]) => void;
	const response = new Promise<string[]>((resolve) => {
		deliver = resolve;
	});
	let requests = 0;
	let aborted = 0;
	const observer = new QueryObserver(client, {
		queryKey: ["board-updates"],
		initialData: [] as string[],
		staleTime: Number.POSITIVE_INFINITY,
		queryFn: ({ signal }) => {
			requests++;
			signal.addEventListener("abort", () => {
				aborted++;
			});
			return response;
		},
	});
	const unsubscribe = observer.subscribe(() => {});
	try {
		const pending = Array.from({ length: 20 }, () =>
			observer.refetch(CANVAS_LIVE_REFETCH_OPTIONS),
		);
		assert.equal(requests, 1);
		assert.equal(aborted, 0);
		deliver(["remote edit"]);
		await Promise.all(pending);
		assert.deepEqual(observer.getCurrentResult().data, ["remote edit"]);
	} finally {
		unsubscribe();
		client.clear();
	}
});

test("compacts at the update-count threshold", () => {
	assert.equal(
		shouldCompactCanvasUpdateLog({
			updateCount: CANVAS_UPDATE_COMPACT_AFTER_COUNT,
			compactableBytes: 1,
		}),
		true,
	);
});

test("compacts a multi-row log at the payload threshold", () => {
	assert.equal(
		shouldCompactCanvasUpdateLog({
			updateCount: 2,
			compactableBytes: CANVAS_UPDATE_COMPACT_AFTER_BYTES,
		}),
		true,
	);
});

test("does not repeatedly compact a large snapshot without new delta bytes", () => {
	assert.equal(
		shouldCompactCanvasUpdateLog({
			updateCount: 2,
			compactableBytes: 100,
		}),
		false,
	);
});

test("failed compactions back off exponentially up to the maximum", async () => {
	const {
		CANVAS_COMPACTION_RETRY_BASE_MS,
		CANVAS_COMPACTION_RETRY_MAX_MS,
		getCompactionRetryDelayMs,
	} = await import("./canvas-sync-policy");
	assert.equal(getCompactionRetryDelayMs(1), CANVAS_COMPACTION_RETRY_BASE_MS);
	assert.equal(
		getCompactionRetryDelayMs(2),
		CANVAS_COMPACTION_RETRY_BASE_MS * 2,
	);
	assert.equal(getCompactionRetryDelayMs(20), CANVAS_COMPACTION_RETRY_MAX_MS);
	assert.equal(
		getCompactionRetryDelayMs(Number.POSITIVE_INFINITY),
		CANVAS_COMPACTION_RETRY_MAX_MS,
	);
});

test("hidden tabs without a live channel poll less often", async () => {
	const {
		CANVAS_UPDATE_POLL_HIDDEN_MS,
		CANVAS_UPDATE_POLL_LIVE_MS,
		CANVAS_UPDATE_POLL_MS,
		getCanvasUpdatePollInterval,
	} = await import("./canvas-sync-policy");
	assert.equal(
		getCanvasUpdatePollInterval({ liveConnected: true, hidden: false }),
		CANVAS_UPDATE_POLL_LIVE_MS,
	);
	assert.equal(
		getCanvasUpdatePollInterval({ liveConnected: false, hidden: false }),
		CANVAS_UPDATE_POLL_MS,
	);
	assert.equal(
		getCanvasUpdatePollInterval({ liveConnected: false, hidden: true }),
		CANVAS_UPDATE_POLL_HIDDEN_MS,
	);
});
