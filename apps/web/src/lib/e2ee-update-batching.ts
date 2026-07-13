import { decryptYjsUpdate, encryptYjsUpdate } from "@/lib/e2ee";
import type { PendingE2eeUpdate } from "@/lib/e2ee-update-queue";
import * as Y from "yjs";

export const E2EE_UPDATE_BATCH_DELAY_MS = 150;

// Base64url and the JSON envelope add roughly 34% overhead. Keeping the raw
// batch below 2.5 MB leaves enough room for the API's 4 MB envelope limit.
export const E2EE_UPDATE_BATCH_MAX_RAW_BYTES = 2_500_000;

export interface PendingE2eeUpdateBatch {
	records: PendingE2eeUpdate[];
	update: string;
	rawBytes: number;
}

/**
 * Decrypts only the client's durable local queue, merges compatible Yjs
 * updates, and encrypts the result again for transport. Plaintext never leaves
 * the browser and the original records stay queued until the append succeeds.
 */
export async function createPendingE2eeUpdateBatch(
	pending: PendingE2eeUpdate[],
	key: string,
	maxRawBytes = E2EE_UPDATE_BATCH_MAX_RAW_BYTES,
): Promise<PendingE2eeUpdateBatch | null> {
	const first = pending[0];
	if (!first) return null;

	const records: PendingE2eeUpdate[] = [];
	const updates: Uint8Array[] = [];
	let rawBytes = 0;

	for (const record of pending) {
		// A key rotation should never combine records authorized by two different
		// key verifiers. The next flush can handle the following group separately.
		if (record.keyHash !== first.keyHash) break;
		const decrypted = await decryptYjsUpdate(record.update, key);
		if (updates.length > 0 && rawBytes + decrypted.byteLength > maxRawBytes) {
			break;
		}
		records.push(record);
		updates.push(decrypted);
		rawBytes += decrypted.byteLength;
	}

	const merged = updates.length === 1 ? updates[0] : Y.mergeUpdates(updates);
	return {
		records,
		update: await encryptYjsUpdate(merged, key),
		rawBytes,
	};
}
