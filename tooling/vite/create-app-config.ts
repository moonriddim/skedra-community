import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { type UserConfig, defineConfig } from "vite";

interface ManualChunkRule {
	name: string;
	pathFragments: readonly string[];
}

const SOURCE_CHUNK_RULES: readonly ManualChunkRule[] = [
	{
		name: "canvas-renderer",
		pathFragments: [
			"/src/components/canvas/canvas-renderer/",
			"/src/components/canvas/canvas-renderer.tsx",
		],
	},
	{
		name: "canvas-domain",
		pathFragments: [
			"/src/components/canvas/properties-panel/",
			"/src/hooks/use-canvas-pointer/",
			"/src/lib/templates/",
			"/src/lib/canvas/flowchart",
			"/src/lib/canvas/mindmap",
			"/src/lib/canvas/template-tool",
			"/src/lib/canvas/kanban",
		],
	},
];

const VENDOR_CHUNK_RULES: readonly ManualChunkRule[] = [
	{
		name: "vendor-livekit-client",
		pathFragments: ["/node_modules/livekit-client/"],
	},
	{
		name: "vendor-livekit-react",
		pathFragments: ["/node_modules/@livekit/components-react/"],
	},
	{
		name: "vendor-react",
		pathFragments: ["/react/", "/react-dom/"],
	},
	{
		name: "vendor-radix",
		pathFragments: ["@radix-ui"],
	},
	{
		name: "vendor-collaboration",
		pathFragments: ["/yjs/", "lib0"],
	},
	{
		name: "vendor-canvas",
		pathFragments: ["roughjs", "@excalidraw", "perfect-freehand"],
	},
	{
		name: "vendor-icons",
		pathFragments: ["lucide-react"],
	},
];

function matchManualChunk(
	id: string,
	rules: readonly ManualChunkRule[],
): string | undefined {
	return rules.find((rule) =>
		rule.pathFragments.some((fragment) => id.includes(fragment)),
	)?.name;
}

function createManualChunk(id: string): string | undefined {
	const normalizedId = id.replaceAll("\\", "/");
	const sourceChunk = matchManualChunk(normalizedId, SOURCE_CHUNK_RULES);
	if (sourceChunk) return sourceChunk;
	if (!normalizedId.includes("node_modules")) return undefined;
	return matchManualChunk(normalizedId, VENDOR_CHUNK_RULES);
}

/** Gemeinsame Vite-Basis fuer Skedra-Frontend-Apps (React + Tailwind + @-Alias). */
export function createSkedraAppViteConfig(options: {
	/** Verzeichnis der vite.config.ts (üblicherweise `import.meta.dirname`). */
	appRoot: string;
	chunkSizeWarningLimit?: number;
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
			chunkSizeWarningLimit: options.chunkSizeWarningLimit,
			rollupOptions: {
				output: {
					manualChunks: createManualChunk,
				},
			},
		},
	});
}
