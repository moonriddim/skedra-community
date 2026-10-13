import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./dist/", import.meta.url));
const types = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".png": "image/png",
	".xml": "application/xml",
	".txt": "text/plain; charset=utf-8",
};
createServer(async (request, response) => {
	try {
		const pathname = decodeURIComponent(
			new URL(request.url, "http://localhost").pathname,
		);
		let file = path.resolve(root, `.${pathname}`);
		if (
			file !== path.resolve(root) &&
			!file.startsWith(`${path.resolve(root)}${path.sep}`)
		) {
			response.writeHead(403).end();
			return;
		}
		try {
			if ((await stat(file)).isDirectory())
				file = path.join(file, "index.html");
		} catch {
			response.writeHead(404, { "Content-Type": types[".html"] });
			response.end(await readFile(path.join(root, "404.html")));
			return;
		}
		response.writeHead(200, {
			"Content-Type": types[path.extname(file)] ?? "application/octet-stream",
			"Cache-Control": "no-store",
		});
		response.end(await readFile(file));
	} catch {
		response.writeHead(400).end();
	}
}).listen(Number(process.env.SKEDRA_DOCS_PORT ?? 5176), "127.0.0.1", () =>
	console.log(
		`Skedra documentation: http://localhost:${process.env.SKEDRA_DOCS_PORT ?? 5176}`,
	),
);
