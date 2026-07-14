const DB_NAME = "skedra-e2ee-update-queue";
const DB_VERSION = 1;
const STORE_NAME = "pending-updates";
const WHITEBOARD_INDEX = "whiteboardId";

export interface PendingE2eeUpdate {
	id: string;
	whiteboardId: string;
	clientId: string;
	/** Missing on records written before the shared queue supported server mode. */
	mode?: "e2ee";
	keyHash: string;
	update: string;
	createdAt: number;
}

export interface PendingServerUpdate {
	id: string;
	whiteboardId: string;
	clientId: string;
	mode: "server";
	update: string;
	createdAt: number;
}

type PendingCanvasUpdate = PendingE2eeUpdate | PendingServerUpdate;

function createPendingId() {
	if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function requestToPromise<T>(request: IDBRequest<T>) {
	return new Promise<T>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("IndexedDB request failed"));
	});
}

function transactionDone(transaction: IDBTransaction) {
	return new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () =>
			reject(transaction.error ?? new Error("IndexedDB transaction failed"));
		transaction.onabort = () =>
			reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
	});
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openQueueDb() {
	if (!("indexedDB" in globalThis)) {
		return Promise.reject(new Error("IndexedDB is not available"));
	}

	dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = () => {
			const db = request.result;
			const store = db.objectStoreNames.contains(STORE_NAME)
				? request.transaction?.objectStore(STORE_NAME)
				: db.createObjectStore(STORE_NAME, { keyPath: "id" });

			if (store && !store.indexNames.contains(WHITEBOARD_INDEX)) {
				store.createIndex(WHITEBOARD_INDEX, "whiteboardId", {
					unique: false,
				});
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => {
			dbPromise = null;
			reject(request.error ?? new Error("IndexedDB open failed"));
		};
		request.onblocked = () => {
			dbPromise = null;
			reject(new Error("IndexedDB open was blocked"));
		};
	});

	return dbPromise;
}

export async function enqueuePendingE2eeUpdate(
	input: Omit<PendingE2eeUpdate, "id" | "createdAt" | "mode">,
) {
	const db = await openQueueDb();
	const record: PendingE2eeUpdate = {
		...input,
		id: createPendingId(),
		mode: "e2ee",
		createdAt: Date.now(),
	};
	const transaction = db.transaction(STORE_NAME, "readwrite");
	transaction.objectStore(STORE_NAME).add(record);
	await transactionDone(transaction);
	return record;
}

export async function listPendingE2eeUpdates(whiteboardId: string) {
	const db = await openQueueDb();
	const transaction = db.transaction(STORE_NAME, "readonly");
	const store = transaction.objectStore(STORE_NAME);
	const request = store.index(WHITEBOARD_INDEX).getAll(whiteboardId);
	const records = (await requestToPromise(request)) as PendingCanvasUpdate[];
	await transactionDone(transaction);
	return records
		.filter(
			(record): record is PendingE2eeUpdate =>
				record.mode == null || record.mode === "e2ee",
		)
		.sort((left, right) => left.createdAt - right.createdAt);
}

export async function enqueuePendingServerUpdate(
	input: Omit<PendingServerUpdate, "id" | "createdAt" | "mode">,
) {
	const db = await openQueueDb();
	const record: PendingServerUpdate = {
		...input,
		id: createPendingId(),
		mode: "server",
		createdAt: Date.now(),
	};
	const transaction = db.transaction(STORE_NAME, "readwrite");
	transaction.objectStore(STORE_NAME).add(record);
	await transactionDone(transaction);
	return record;
}

export async function listPendingServerUpdates(whiteboardId: string) {
	const db = await openQueueDb();
	const transaction = db.transaction(STORE_NAME, "readonly");
	const store = transaction.objectStore(STORE_NAME);
	const request = store.index(WHITEBOARD_INDEX).getAll(whiteboardId);
	const records = (await requestToPromise(request)) as PendingCanvasUpdate[];
	await transactionDone(transaction);
	return records
		.filter((record): record is PendingServerUpdate => record.mode === "server")
		.sort((left, right) => left.createdAt - right.createdAt);
}

export async function deletePendingE2eeUpdate(id: string) {
	return deletePendingE2eeUpdates([id]);
}

/** Deletes a successfully persisted network batch in one IndexedDB commit. */
export async function deletePendingE2eeUpdates(ids: string[]) {
	if (ids.length === 0) return;
	const db = await openQueueDb();
	const transaction = db.transaction(STORE_NAME, "readwrite");
	const store = transaction.objectStore(STORE_NAME);
	for (const id of ids) store.delete(id);
	await transactionDone(transaction);
}

export const deletePendingServerUpdates = deletePendingE2eeUpdates;

/** Closes and removes the complete offline queue when a user deletes the account. */
export async function deletePendingE2eeUpdateDatabase() {
	if (!("indexedDB" in globalThis)) return;

	const openDb = dbPromise ? await dbPromise.catch(() => null) : null;
	openDb?.close();
	dbPromise = null;

	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase(DB_NAME);
		request.onsuccess = () => resolve();
		request.onerror = () =>
			reject(request.error ?? new Error("IndexedDB delete failed"));
		request.onblocked = () =>
			reject(new Error("IndexedDB delete was blocked by another tab"));
	});
}
