import { pathToFileURL } from "node:url";

const STABLE_RELEASE_TAG_PATTERN =
	/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

function parseVersionParts(version, pattern, label) {
	const match = pattern.exec(version);
	if (!match) {
		throw new Error(
			`${label} must use stable semantic versioning without leading zeroes.`,
		);
	}
	return match.slice(1).map(Number);
}

export function releaseVersionFromTag(tag) {
	if (typeof tag !== "string") {
		throw new TypeError("Release tag must be a string.");
	}
	const normalizedTag = tag.trim();
	const [major, minor, patch] = parseVersionParts(
		normalizedTag,
		STABLE_RELEASE_TAG_PATTERN,
		"Release tag",
	);
	return `${major}.${minor}.${patch}`;
}

export function compareStableVersions(left, right) {
	const leftParts = parseVersionParts(
		left,
		STABLE_VERSION_PATTERN,
		"Release version",
	);
	const rightParts = parseVersionParts(
		right,
		STABLE_VERSION_PATTERN,
		"Published version",
	);
	for (let index = 0; index < leftParts.length; index += 1) {
		const difference = leftParts[index] - rightParts[index];
		if (difference !== 0) return Math.sign(difference);
	}
	return 0;
}

function runCli() {
	const [tag, option, publishedVersion] = process.argv.slice(2);
	const releaseVersion = releaseVersionFromTag(tag);
	if (option !== undefined) {
		if (option !== "--newer-than" || publishedVersion === undefined) {
			throw new Error(
				"Usage: node scripts/release-version.mjs <vX.Y.Z> [--newer-than <X.Y.Z>]",
			);
		}
		if (compareStableVersions(releaseVersion, publishedVersion) <= 0) {
			throw new Error(
				`Release ${releaseVersion} must be newer than published version ${publishedVersion}.`,
			);
		}
	}
	process.stdout.write(`${releaseVersion}\n`);
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	try {
		runCli();
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}
