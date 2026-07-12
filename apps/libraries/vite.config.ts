import path from "node:path";
import { createSkedraAppViteConfig } from "../../tooling/vite/create-app-config";

export default createSkedraAppViteConfig({
	appRoot: import.meta.dirname,
	port: 5175,
	publicDir: path.resolve(import.meta.dirname, "../web/public"),
	proxy: {
		"/api": { target: "http://localhost:3001", changeOrigin: true },
	},
});
