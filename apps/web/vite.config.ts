import { createSkedraAppViteConfig } from "../../tooling/vite/create-app-config";

export default createSkedraAppViteConfig({
	appRoot: import.meta.dirname,
	port: 5174,
	proxy: {
		"/api": { target: "http://localhost:3001", changeOrigin: true },
		"/realtime": {
			target: "ws://localhost:1235",
			changeOrigin: true,
			ws: true,
		},
	},
});
