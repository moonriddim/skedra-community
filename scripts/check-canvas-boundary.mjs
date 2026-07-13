import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const webCanvasDir = path.join(repoRoot, "apps", "web", "src", "lib", "canvas");
const legacyWebRendererDir = path.join(
	repoRoot,
	"apps",
	"web",
	"src",
	"components",
	"canvas",
	"canvas-renderer",
);
const scanRoots = [
	path.join(repoRoot, "apps", "api", "src"),
	path.join(repoRoot, "apps", "web", "src"),
	path.join(repoRoot, "packages", "canvas-core", "src"),
	path.join(repoRoot, "packages", "canvas-react", "src"),
	path.join(repoRoot, "packages", "react", "src"),
	path.join(repoRoot, "packages", "shared", "src"),
];

const allowedWebCanvasFiles = new Set([
	"api-elements.ts",
	"asset-urls.ts",
	"canvas-adapter-parity.test.ts",
	"canvas-codecs.test.ts",
	"canvas-codecs.ts",
	"canvas-defaults.ts",
	"canvas-factory-defaults.ts",
	"canvas-history-storage.ts",
	"canvas-undo.ts",
	"canvas-viewport-storage.ts",
	"color-picker-utils.ts",
	"custom-data-utils.ts",
	"export-utils.ts",
	"image-utils.ts",
	"insert-image.ts",
	"kanban-due-status.ts",
	"kanban-options.ts",
	"laser-utils.ts",
	"library-import.ts",
	"library-install.ts",
	"library-item-prepare.ts",
	"library-site-url.ts",
	"library-utils.ts",
	"local-canvas-storage.ts",
	"preview.ts",
	"skedra-file-utils.ts",
	"sticky-checklist.ts",
	"sticky-display.ts",
	"sticky-note-utils.ts",
	"template-create.ts",
	"template-layout.ts",
	"template-meta.ts",
	"template-tool-utils.ts",
	"theme-element-sync.ts",
	"yjs-canvas-mutations.ts",
	"yjs-document-helpers.ts",
]);

const forbiddenStackIndexPatterns = [
	/\bstackIndex\s*:\s*Date\.now\s*\(/,
	/\bstackIndex\s*=\s*[^;\n]*Date\.now\s*\(/,
	/\bstackIndexStart\s*=\s*Date\.now\s*\(/,
	/\bbaseStackIndex\s*=\s*Date\.now\s*\(/,
];

const forbiddenStackIndexImplementationPatterns = [
	/\bSTACK_INDEX_(STEP|OFFSET|WIDTH)\b/,
	/\bfunction\s+formatStackIndex\b/,
	/\bfunction\s+readStackRank\b/,
	/\bfunction\s+parseBase36BigInt\b/,
];

const errors = [];

const legacyRendererFiles = listFiles(legacyWebRendererDir).filter((file) =>
	/\.[jt]sx?$/u.test(file),
);
if (legacyRendererFiles.length > 0) {
	errors.push(
		"Canvas renderer implementations must live in packages/canvas-react, not apps/web.",
	);
}

checkSharedRendererConsumer(
	"apps/web/src/components/canvas/canvas-renderer.tsx",
	/@skedra\/canvas-react/u,
	"The web app must consume the shared React canvas renderer.",
);
checkSharedRendererConsumer(
	"packages/react/src/skedra-canvas.tsx",
	/<CanvasElementRenderer/u,
	"The SDK must render elements through the shared React canvas renderer.",
);

const sdkCanvasSource = readRepoFile("packages/react/src/skedra-canvas.tsx");
if (/\bSdkElementShape\b/u.test(sdkCanvasSource)) {
	errors.push("The SDK must not contain its legacy element renderer.");
}

const centralizedMindmapPatterns = [
	/\bfunction\s+resolveAlternatingChildAxisPosition\b/u,
	/\bfunction\s+getMindmapSubtreeBounds\b/u,
];

const centralizedEditorPatterns = [
	/\bfunction\s+normalizeRect\b/u,
	/\bfunction\s+applyElementUpdates\b/u,
	/\bfunction\s+collectDeletedElementIds\b/u,
	/\bfunction\s+deleteRelatedElements\b/u,
	/\bfunction\s+moveElements\b/u,
	/\bfunction\s+shouldKeepDraft\b/u,
	/\bfunction\s+getNextTemplateStickyPosition\b/u,
	/\bfunction\s+buildTemplateSectionLayout\b/u,
];

for (const file of listFiles(webCanvasDir)) {
	if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
	const relative = toPosix(path.relative(webCanvasDir, file));
	if (!allowedWebCanvasFiles.has(relative)) {
		errors.push(
			`New canvas core file in apps/web/src/lib/canvas: ${relative}. Move core logic to packages/canvas-core or add an explicit boundary exception.`,
		);
	}
}

for (const root of scanRoots) {
	for (const file of listFiles(root)) {
		if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
		const source = fs.readFileSync(file, "utf8");
		if (forbiddenStackIndexPatterns.some((pattern) => pattern.test(source))) {
			errors.push(
				`Date.now() must not be used for stackIndex ordering: ${toPosix(path.relative(repoRoot, file))}`,
			);
		}
		const relative = toPosix(path.relative(repoRoot, file));
		if (
			relative !== "packages/canvas-core/src/mindmap.ts" &&
			centralizedMindmapPatterns.some((pattern) => pattern.test(source))
		) {
			errors.push(
				`Mindmap placement must stay centralized in packages/canvas-core/src/mindmap.ts: ${relative}`,
			);
		}
		if (
			relative !== "packages/canvas-core/src/editor-operations.ts" &&
			relative !== "packages/canvas-core/src/templates.ts" &&
			centralizedEditorPatterns.some((pattern) => pattern.test(source))
		) {
			errors.push(
				`SDK-scoped editor operations must stay centralized in canvas-core: ${relative}`,
			);
		}
		if (
			relative !== "packages/canvas-core/src/ordering.ts" &&
			forbiddenStackIndexImplementationPatterns.some((pattern) =>
				pattern.test(source),
			)
		) {
			errors.push(
				`Stack ordering implementation must stay centralized in packages/canvas-core/src/ordering.ts: ${relative}`,
			);
		}
	}
}

for (const relative of [
	"apps/web/src/lib/templates/flowchart.ts",
	"apps/web/src/lib/templates/mindmap.ts",
	"apps/web/src/lib/templates/retrospective.ts",
	"apps/web/src/lib/templates/swot.ts",
	"packages/react/src/factories.ts",
]) {
	if (!/createCanvasTemplateElements/u.test(readRepoFile(relative))) {
		errors.push(
			`Template consumer must use canvas-core shared factory: ${relative}`,
		);
	}
}

for (const relative of [
	"apps/web/src/lib/canvas/template-create.ts",
	"apps/web/src/lib/canvas/template-layout.ts",
	"apps/web/src/lib/canvas/template-meta.ts",
]) {
	if (!/@skedra\/canvas-core/u.test(readRepoFile(relative))) {
		errors.push(
			`Template canvas helpers must delegate to canvas-core: ${relative}`,
		);
	}
}

function checkSharedRendererConsumer(relative, pattern, message) {
	const source = readRepoFile(relative);
	if (!pattern.test(source)) errors.push(message);
}

function readRepoFile(relative) {
	const file = path.join(repoRoot, ...relative.split("/"));
	return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

if (errors.length > 0) {
	console.error(errors.join("\n"));
	process.exit(1);
}

function listFiles(dir) {
	if (!fs.existsSync(dir)) return [];
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...listFiles(fullPath));
		} else {
			files.push(fullPath);
		}
	}
	return files;
}

function toPosix(value) {
	return value.split(path.sep).join("/");
}
