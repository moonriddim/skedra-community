/** Coalesce flush requests without making unrelated boards wait for each other. */
export function createCanvasUpdateFlusher() {
	let running: Promise<void> | null = null;
	let requested = false;
	return (flush: () => Promise<void>): Promise<void> => {
		requested = true;
		if (running) return running;
		running = Promise.resolve().then(async () => {
			try {
				do {
					requested = false;
					await flush();
				} while (requested);
			} finally {
				running = null;
			}
		});
		return running;
	};
}
