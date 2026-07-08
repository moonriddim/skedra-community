import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: [
			{
				find: "@skedra/react/style.css",
				replacement: fileURLToPath(
					new URL("../../packages/react/src/style.css", import.meta.url),
				),
			},
			{
				find: "@skedra/react",
				replacement: fileURLToPath(
					new URL("../../packages/react/src/index.ts", import.meta.url),
				),
			},
		],
	},
});
