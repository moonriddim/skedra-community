import { base64ToBytes, bytesToBase64 } from "@/lib/e2ee";
import type { PendingServerUpdate } from "@/lib/e2ee-update-queue";
import * as Y from "yjs";

export const SERVER_UPDATE_BATCH_DELAY_MS = 150;

// Base64 adds roughly 34% overhead. Keeping the raw batch below 2.5 MB leaves
// enough room for the API's 4 MB input limit and its transport envelope.
export const SERVER_UPDATE_BATCH_MAX_RAW_BYTES = 2_500_000;

export interface PendingServerUpdateBatch {
	records: PendingServerUpdate[];
	update: string;
	rawBytes: number;
}

/**
 * Merges one client's durable local records for transport. Records remain in
 * IndexedDB until the append succeeds, so a reload cannot drop the batch.
 */
export function createPendingServerUpdateBatch(
	pending: PendingServerUpdate[],
	maxRawBytes = SERVER_UPDATE_BATCH_MAX_RAW_BYTES,
): PendingServerUpdateBatch | null {
	const first = pending[0];
	if (!first) return null;

	const records: PendingServerUpdate[] = [];
	const updates: Uint8Array[] = [];
	let rawBytes = 0;

	for (const record of pending) {
		if (record.clientId !== first.clientId) break;
		const decoded = base64ToBytes(record.update);
		if (updates.length > 0 && rawBytes + decoded.byteLength > maxRawBytes) {
			break;
		}
		records.push(record);
		updates.push(decoded);
		rawBytes += decoded.byteLength;
	}

	const merged = updates.length === 1 ? updates[0] : Y.mergeUpdates(updates);
	return {
		records,
		update: bytesToBase64(merged),
		rawBytes,
	};
}
