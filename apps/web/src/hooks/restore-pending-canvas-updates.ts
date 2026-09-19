import * as Y from "yjs";

/** Keep asynchronous queue reads and decryption bound to their original board. */
export async function restorePendingCanvasUpdates<T extends { id: string }>({
	ydoc,
	isCurrent,
	load,
	decode,
	appliedIds,
	origin,
	onRestored,
}: {
	ydoc: Y.Doc;
	isCurrent: () => boolean;
	load: () => Promise<T[]>;
	decode: (record: T) => Uint8Array | Promise<Uint8Array>;
	appliedIds: Set<string>;
	origin: string;
	onRestored: () => void;
}) {
	const active = () => !ydoc.isDestroyed && isCurrent();
	try {
		const pending = await load();
		if (!active()) return;
		for (const queued of pending) {
			if (appliedIds.has(queued.id)) continue;
			const update = await decode(queued);
			if (!active()) return;
			// Another restore can finish while this one is decoding.
			if (appliedIds.has(queued.id)) continue;
			Y.applyUpdate(ydoc, update, origin);
			appliedIds.add(queued.id);
		}
		if (pending.length > 0) onRestored();
	} catch (error) {
		if (active()) throw error;
	}
}
