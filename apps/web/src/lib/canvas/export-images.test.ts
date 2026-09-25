import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

test("visual exports embed image sources so rasterized SVGs keep their images", async (t) => {
	const browser = new Window({ url: "http://localhost" });
	t.after(() => browser.happyDOM.close());
	// Stellvertretend für eine blob:-URL eines entschlüsselten Assets.
	t.mock.method(globalThis, "fetch", async (url: string) =>
		url === "http://localhost/decrypted.png"
			? new Response(new Uint8Array([1, 2, 3]), {
					headers: { "Content-Type": "image/png" },
				})
			: new Response(null, { status: 404 }),
	);
	const { embedSvgImages } = await import("@skedra/canvas-io/exporters");
	const svg = browser.document.createElementNS(
		"http://www.w3.org/2000/svg",
		"svg",
	) as unknown as SVGSVGElement;
	svg.innerHTML =
		'<image id="asset" href="http://localhost/decrypted.png"/>' +
		'<image id="inline" href="data:image/gif;base64,R0lGOD"/>' +
		'<image id="missing" href="http://localhost/missing.png"/>';
	await embedSvgImages(svg);
	const href = (id: string) =>
		svg.querySelector(`#${id}`)?.getAttribute("href") ?? "";
	assert.match(href("asset"), /^data:image\/png;base64,AQID$/);
	assert.equal(href("inline"), "data:image/gif;base64,R0lGOD");
	// Nicht ladbare Bilder bleiben unverändert statt zu verschwinden.
	assert.equal(href("missing"), "http://localhost/missing.png");
});
