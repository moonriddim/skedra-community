const CHUNK_RELOAD_MARKER = "skedra:chunk-reload-at";
const CHUNK_RELOAD_COOLDOWN_MS = 60_000;

export function shouldAttemptChunkReload(
	lastAttempt: string | null,
	now = Date.now(),
) {
	if (!lastAttempt) return true;
	const timestamp = Number(lastAttempt);
	return (
		!Number.isFinite(timestamp) || now - timestamp > CHUNK_RELOAD_COOLDOWN_MS
	);
}

export function installChunkLoadRecovery() {
	window.addEventListener("vite:preloadError", (event) => {
		try {
			const now = Date.now();
			if (
				!shouldAttemptChunkReload(
					window.sessionStorage.getItem(CHUNK_RELOAD_MARKER),
					now,
				)
			)
				return;
			window.sessionStorage.setItem(CHUNK_RELOAD_MARKER, String(now));
			event.preventDefault();
			window.location.reload();
		} catch {
			// If session storage is unavailable, let the error boundary render instead
			// of risking an infinite reload loop.
		}
	});
}

export function markChunkLoadingHealthy() {
	window.setTimeout(() => {
		try {
			window.sessionStorage.removeItem(CHUNK_RELOAD_MARKER);
		} catch {
			// Storage may be disabled by browser privacy settings.
		}
	}, 10_000);
}
