/**
 * Installiert eine Community-Bibliothek aus ?library=slug (z. B. vom Katalog verlinkt).
 */

import { useCanvasStore } from "@/hooks/use-canvas-store";
import {
	LibraryImportError,
	installPublicLibraryBySlug,
} from "@/lib/canvas/library-utils";
import { useCanvasLibraryStore } from "@/stores/canvas-library-store";
import { normalizeLibrarySlug } from "@skedra/shared";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

export function useLibraryDeepLink() {
	const [searchParams, setSearchParams] = useSearchParams();
	const installLibrary = useCanvasLibraryStore((s) => s.installLibrary);
	const setActivePanel = useCanvasStore((s) => s.setActivePanel);
	const handledSlug = useRef<string | null>(null);

	useEffect(() => {
		const slug = searchParams.get("library");
		if (!slug) return;
		const normalized = normalizeLibrarySlug(slug);
		if (!normalized || handledSlug.current === normalized) return;

		handledSlug.current = normalized;
		const next = new URLSearchParams(searchParams);
		next.delete("library");
		next.delete("referrer");
		setSearchParams(next, { replace: true });

		void (async () => {
			try {
				const lib = await installPublicLibraryBySlug(normalized);
				installLibrary(lib);
				setActivePanel("library");
			} catch (error) {
				if (!(error instanceof LibraryImportError)) {
					console.warn("[Skedra] library deep link failed", error);
				}
			}
		})();
	}, [installLibrary, searchParams, setActivePanel, setSearchParams]);
}
