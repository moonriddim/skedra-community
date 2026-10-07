import { createHash } from "node:crypto";
import { decryptText, encryptText } from "@skedra/shared/server-crypto";
import { z } from "zod";
import { getYjsEncryptionOptions } from "./yjs-encryption";

// Only a bounded raster image may be published, never SVG/HTML or the board key.
export const presentationPreviewPngSchema = z
	.string()
	.max(5_400_000)
	.refine((value) => {
		if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
		const bytes = Buffer.from(value, "base64");
		return (
			bytes.length >= 24 &&
			bytes.length <= 4_000_000 &&
			bytes
				.subarray(0, 8)
				.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
			bytes.toString("ascii", 12, 16) === "IHDR" &&
			bytes.readUInt32BE(16) === 1200 &&
			bytes.readUInt32BE(20) === 630
		);
	}, "Expected a 1200 × 630 PNG preview");

export function encodePresentationPreview(png: string) {
	presentationPreviewPngSchema.parse(png);
	return {
		presentationPreviewPng: encryptText(png, getYjsEncryptionOptions()),
		presentationPreviewVersion: createHash("sha256")
			.update(png)
			.digest("hex")
			.slice(0, 24),
	};
}

export function decodePresentationPreview(value: string) {
	return Buffer.from(decryptText(value, getYjsEncryptionOptions()), "base64");
}

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("'", "&#39;");
}

/** Inject metadata into the actual SPA shell so crawlers and people get one URL. */
export function renderPresentationSharePage(
	shell: string,
	input: {
		name: string;
		url: string;
		previewUrl: string | null;
	},
) {
	const title = `${input.name} | Skedra`;
	const description =
		"Geteiltes Board – schreibgeschützt ansehen, ohne Account.";
	const meta = (attribute: "name" | "property", key: string, value: string) =>
		`<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`;
	const tags = [
		`<title>${escapeHtml(title)}</title>`,
		meta("name", "description", description),
		meta("name", "robots", "noindex, nofollow, noarchive"),
		meta("property", "og:title", title),
		meta("property", "og:description", description),
		meta("property", "og:type", "website"),
		meta("property", "og:site_name", "Skedra"),
		meta("property", "og:url", input.url),
		meta(
			"name",
			"twitter:card",
			input.previewUrl ? "summary_large_image" : "summary",
		),
		meta("name", "twitter:title", title),
		meta("name", "twitter:description", description),
	];
	if (input.previewUrl)
		tags.push(
			meta("property", "og:image", input.previewUrl),
			meta("property", "og:image:type", "image/png"),
			meta("property", "og:image:width", "1200"),
			meta("property", "og:image:height", "630"),
			meta("property", "og:image:alt", input.name),
			meta("name", "twitter:image", input.previewUrl),
		);
	return shell
		.replace(/<title>[\s\S]*?<\/title>/gi, "")
		.replace(
			/<meta\b[^>]*(?:name|property)=["'](?:description|robots|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi,
			"",
		)
		.replace(/<link\b[^>]*\brel=["'](?:canonical|alternate)["'][^>]*>/gi, "")
		.replace(
			/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
			"",
		)
		.replace("</head>", `${tags.join("\n")}\n</head>`);
}
