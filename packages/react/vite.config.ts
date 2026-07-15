import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
	plugins: [react()],
	build: {
		emptyOutDir: mode !== "sdk-watch",
		lib: {
			entry: {
				commands: "src/commands.ts",
				"editor-panels": "src/editor-panels.tsx",
				exporters: "src/exporters.ts",
				index: "src/index.ts",
				factories: "src/factories.ts",
				io: "src/io.ts",
				"keyboard-actions": "src/keyboard-actions.ts",
				"workspace-hooks": "src/workspace-hooks.ts",
			},
			formats: ["es"],
			fileName: (_format, entryName) => `${entryName}.js`,
			cssFileName: "style",
		},
		rollupOptions: {
			external: ["react", "react/jsx-runtime", "react-dom"],
		},
	},
}));
