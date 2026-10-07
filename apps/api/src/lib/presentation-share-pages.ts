import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Hono } from "hono";
import type { getPresentationShareAccess } from "./presentation";
import {
	decodePresentationPreview,
	renderPresentationSharePage,
} from "./presentation-preview";

export async function loadPresentationPageShell() {
	// Release containers receive the matching web build, including hashed assets.
	for (const path of [
		resolve("web-index.html"),
		resolve("apps/web/dist/index.html"),
		resolve("../web/dist/index.html"),
	]) {
		try {
			return await readFile(path, "utf8");
		} catch {
			/* Try the next installation layout. */
		}
	}
	throw new Error("Web page shell unavailable");
}

export function createPresentationSharePages(options: {
	appUrl: string;
	getAccess: (token: string) => ReturnType<typeof getPresentationShareAccess>;
	loadPreview: (whiteboardId: string) => Promise<string | null>;
	loadShell?: () => Promise<string>;
}) {
	const app = new Hono();
	app.use("*", async (c, next) => {
		c.header("Cache-Control", "no-store");
		c.header("X-Robots-Tag", "noindex, nofollow, noarchive");
		await next();
	});
	app.get("/:shareToken/page", async (c) => {
		const token = c.req.param("shareToken");
		const shell = await (options.loadShell ?? loadPresentationPageShell)();
		try {
			const access = await options.getAccess(token);
			const url = new URL(
				`/present/${encodeURIComponent(token)}`,
				options.appUrl,
			);
			if (
				access.shareSettings.accessMode === "always" &&
				access.whiteboard.presentationPreviewVersion
			) {
				url.searchParams.set("v", access.whiteboard.presentationPreviewVersion);
			}
			const previewUrl =
				access.shareSettings.accessMode === "always" &&
				access.whiteboard.presentationPreviewVersion
					? new URL(
							`/api/presentations/${encodeURIComponent(token)}/preview.png?v=${access.whiteboard.presentationPreviewVersion}`,
							options.appUrl,
						).toString()
					: null;
			return c.html(
				renderPresentationSharePage(shell, {
					name: access.whiteboard.name,
					url: url.toString(),
					previewUrl,
				}),
			);
		} catch {
			return c.html(
				renderPresentationSharePage(shell, {
					name: "Präsentation nicht verfügbar",
					url: new URL("/", options.appUrl).toString(),
					previewUrl: null,
				}),
				404,
			);
		}
	});
	app.get("/:shareToken/preview.png", async (c) => {
		try {
			// Always reauthorize, including requests for an old image version.
			const access = await options.getAccess(c.req.param("shareToken"));
			if (access.shareSettings.accessMode !== "always") return c.notFound();
			const preview = await options.loadPreview(access.whiteboard.id);
			if (!preview) return c.notFound();
			const bytes = decodePresentationPreview(preview);
			c.header("Content-Type", "image/png");
			c.header("X-Content-Type-Options", "nosniff");
			return c.body(new Uint8Array(bytes));
		} catch {
			return c.notFound();
		}
	});
	return app;
}
