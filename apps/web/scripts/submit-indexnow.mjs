import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const host = process.env.INDEXNOW_HOST ?? "skedra.xyz";
const key = process.env.INDEXNOW_KEY ?? "4bc52d60c9b7a65641a20aa990525ceb";
const keyLocation = `https://${host}/${key}.txt`;
const sitemap = await readFile(
	path.join(appDirectory, "public/sitemap.xml"),
	"utf8",
);
const urlList = Array.from(sitemap.matchAll(/<loc>(.*?)<\/loc>/g), (match) =>
	match[1].trim(),
).filter((url) => new URL(url).host === host);

if (urlList.length === 0) {
	throw new Error("No same-host URLs found in the Skedra sitemap");
}

const response = await fetch("https://api.indexnow.org/indexnow", {
	method: "POST",
	headers: { "Content-Type": "application/json; charset=utf-8" },
	body: JSON.stringify({ host, key, keyLocation, urlList }),
});

if (!response.ok) {
	const responseBody = await response.text();
	throw new Error(
		`IndexNow submission failed (${response.status}): ${responseBody}`,
	);
}

console.log(`Submitted ${urlList.length} Skedra URLs to IndexNow.`);
