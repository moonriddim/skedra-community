import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { type UserConfig, defineConfig } from "vite";

function createManualChunk(id: string): string | undefined {
	const normalizedId = id.replaceAll("\\", "/");
	if (normalizedId.includes("/src/components/canvas/canvas-renderer/")) {
		return "canvas-renderer";
	}
	if (normalizedId.includes("/src/components/canvas/properties-panel/")) {
		return "canvas-properties";
	}
	if (normalizedId.includes("/src/hooks/use-canvas-pointer/")) {
		return "canvas-pointer";
	}
	if (normalizedId.includes("/src/lib/templates/")) {
		return "canvas-domain";
	}
	if (
		normalizedId.includes("/src/lib/canvas/flowchart") ||
		normalizedId.includes("/src/lib/canvas/mindmap") ||
		normalizedId.includes("/src/lib/canvas/template-tool") ||
		normalizedId.includes("/src/lib/canvas/kanban")
	) {
		return "canvas-domain";
	}
	if (!normalizedId.includes("node_modules")) return undefined;
	if (
		normalizedId.includes("/react/") ||
		normalizedId.includes("/react-dom/")
	) {
		return "vendor-react";
	}
	if (normalizedId.includes("@radix-ui")) return "vendor-radix";
	if (normalizedId.includes("/yjs/") || normalizedId.includes("lib0")) {
		return "vendor-collaboration";
	}
	if (
		normalizedId.includes("roughjs") ||
		normalizedId.includes("@excalidraw") ||
		normalizedId.includes("perfect-freehand")
	) {
		return "vendor-canvas";
	}
	if (normalizedId.includes("lucide-react")) return "vendor-icons";
	return undefined;
}

/** Gemeinsame Vite-Basis fuer Skedra-Frontend-Apps (React + Tailwind + @-Alias). */
export function createSkedraAppViteConfig(options: {
	/** Verzeichnis der vite.config.ts (üblicherweise `import.meta.dirname`). */
	appRoot: string;
	port: number;
	publicDir?: UserConfig["publicDir"];
	proxy?: UserConfig["server"] extends { proxy?: infer P } ? P : never;
}): UserConfig {
	return defineConfig({
		base: process.env.VITE_BASE_PATH || "/",
		publicDir: options.publicDir,
		plugins: [react(), tailwindcss()],
		resolve: {
			alias: {
				"@": path.resolve(options.appRoot, "src"),
			},
		},
		server: {
			port: options.port,
			proxy: options.proxy,
		},
		build: {
			rollupOptions: {
				output: {
					manualChunks: createManualChunk,
				},
			},
		},
	});
}
