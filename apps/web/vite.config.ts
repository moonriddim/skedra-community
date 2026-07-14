import { createSkedraAppViteConfig } from "../../tooling/vite/create-app-config";

export default createSkedraAppViteConfig({
	appRoot: import.meta.dirname,
	// livekit-client ships as one pre-bundled ESM module (~508 kB minified).
	// The call UI and its styles still remain lazy and separately cached.
	chunkSizeWarningLimit: 550,
	port: 5174,
	proxy: {
		"/api": { target: "http://localhost:3001", changeOrigin: true },
	},
});
