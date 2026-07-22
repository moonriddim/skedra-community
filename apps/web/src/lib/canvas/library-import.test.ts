import assert from "node:assert/strict";
import test from "node:test";
import { LibraryImportError, parseLibraryFileContents } from "./library-import";

test("parses a local .skedralib package for later editing and submission", () => {
	const result = parseLibraryFileContents(
		JSON.stringify({
			type: "skedralib",
			version: 1,
			name: "Architecture",
			description: "Reusable architecture shapes",
			items: [
				{
					id: "service",
					name: "Service",
					elements: [{ id: "shape-1", type: "rectangle" }],
				},
			],
		}),
		"architecture.skedralib",
	);

	assert.equal(result.format, "skedralib");
	assert.equal(result.file.name, "Architecture");
	assert.equal(result.file.items.length, 1);
});

test("rejects an empty .skedralib package", () => {
	assert.throws(
		() =>
			parseLibraryFileContents(
				JSON.stringify({
					type: "skedralib",
					version: 1,
					items: [],
				}),
				"empty.skedralib",
			),
		(error) =>
			error instanceof LibraryImportError && error.message === "emptyLibrary",
	);
});
