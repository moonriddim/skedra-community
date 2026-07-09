/** Liest process.env in Node/Bun — ohne harte Abhaengigkeit von @types/node in jedem App-Paket. */
export function readProcessEnv(): Record<string, string | undefined> {
	if (typeof globalThis === "object" && "process" in globalThis) {
		return (
			(globalThis as { process?: { env?: Record<string, string | undefined> } })
				.process?.env ?? {}
		);
	}
	return {};
}
