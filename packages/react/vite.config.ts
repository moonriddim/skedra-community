import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	build: {
		lib: {
			entry: {
				index: "src/index.ts",
				factories: "src/factories.ts",
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
});
