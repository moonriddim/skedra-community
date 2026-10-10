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

export function communityCommitMessage(sourceRoot, communityRoot) {
	const head = git(sourceRoot, "rev-parse", "HEAD");
	const files = git(communityRoot, "diff", "--cached", "--name-only", "-z")
		.split("\0")
		.filter(Boolean);
	if (!files.length) throw new Error("No staged Community changes.");
	const previousMessage = git(communityRoot, "log", "-1", "--format=%B");
	const previous = previousMessage.match(
		/(?:^Source-Commit: |sync community from )([a-f0-9]{40})/mu,
	)?.[1];
	let revision = `${head}^!`;
	if (previous) {
		try {
			git(sourceRoot, "merge-base", "--is-ancestor", previous, head);
			revision = `${previous}..${head}`;
		} catch {
			// Older source history may be unavailable after a history rewrite.
		}
	}
	// Limit history to files actually changed by this export. A SaaS-only commit
	// must not become public merely because it shares this source repository.
	const entries = commits(sourceRoot, revision, files);
	const title = entries.length
		? `${entries.at(-1).subject}${entries.length > 1 ? ` (+${entries.length - 1} earlier changes)` : ""}`
		: "chore: update exported Community files";
	return `${title}\n\n${describe(entries) || "- Update exported Community files."}\n\nChanged files:\n${files.map((file) => `- ${file}`).join("\n")}\n\nSource-Commit: ${head}\n`;
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
	if (!root || !argument || !output || !["sync", "release"].includes(mode)) {
		throw new Error(
			"Usage: change-notes.mjs <sync|release> <source-root> <community-root|tag> <output-file>",
		);
	}
	writeFileSync(
		output,
		mode === "sync"
			? communityCommitMessage(root, argument)
			: releaseChanges(root, argument),
	);
}
