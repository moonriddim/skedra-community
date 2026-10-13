import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("both internal API proxies allow sync payloads larger than NGINX's 1 MB default", async () => {
	for (const file of [
		"deploy/nginx/web.conf",
		"deploy/standalone/nginx.conf",
	]) {
		const config = await read(file);
		const apiLocation = config.match(/location \/api\/ \{([^}]+)\}/u)?.[1];
		assert.ok(apiLocation, `${file}: API location is missing`);
		assert.match(apiLocation, /client_max_body_size 100m;/u, file);
	}
});
