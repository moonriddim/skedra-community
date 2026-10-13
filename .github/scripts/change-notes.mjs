import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function git(root, ...args) {
	return execFileSync("git", ["-C", root, ...args], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

function commits(root, revision, paths = []) {
	return git(
		root,
		"log",
		"--reverse",
		"--format=%H%x00%s%x00%b%x00%x1e",
		revision,
		"--",
		...paths,
	)
		.split("\x1e")
		.map((entry) => entry.trim().split("\0"))
		.filter(([sha]) => /^[a-f0-9]{40}$/u.test(sha))
		.map(([sha, subject, body]) => ({ sha, subject, body: body.trim() }));
}

function describe(entries, includeBody = true) {
	return entries
		.map(({ sha, subject, body }) => {
			const details = body.replace(/^Source-Commit:.*$/gmu, "").trim();
			return `- ${subject} (${sha.slice(0, 8)})${
				includeBody && details
					? `\n${details
							.split("\n")
							.map((line) => `  ${line}`)
							.join("\n")}`
					: ""
			}`;
		})
		.join("\n\n");
}

export function releaseChanges(root, tag) {
	if (!/^v\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.-]+)?$/u.test(tag))
		throw new Error("Invalid release tag.");
	git(root, "rev-parse", "--verify", `${tag}^{commit}`);
	let previous;
	try {
		previous = git(
			root,
			"tag",
			"--merged",
			`${tag}^`,
			"--sort=-version:refname",
		)
			.split("\n")
			.find((candidate) => /^v\d+\.\d+\.\d+$/u.test(candidate));
	} catch {
		// The first release may point at the repository's initial commit.
	}
	const entries = commits(root, previous ? `${previous}..${tag}` : tag);
	return `## Changes${previous ? ` since ${previous}` : ""}\n\n${describe(entries) || "No additional source changes."}\n\n`;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
	const [mode, root, argument, output] = process.argv.slice(2);
	if (!root || !argument || !output || mode !== "release") {
		throw new Error(
			"Usage: change-notes.mjs release <repository-root> <tag> <output-file>",
		);
	}
	writeFileSync(output, releaseChanges(root, argument));
}
