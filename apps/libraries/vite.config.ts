import { createSkedraAppViteConfig } from "../../tooling/vite/create-app-config";

export default createSkedraAppViteConfig({
	appRoot: import.meta.dirname,
	port: 5175,
	proxy: {
		"/api": { target: "http://localhost:3001", changeOrigin: true },
	},
});
