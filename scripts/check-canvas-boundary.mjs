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
	path.join(repoRoot, "packages", "canvas-editor", "src"),
	path.join(repoRoot, "packages", "canvas-io", "src"),
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
	"canvas-undo.test.ts",
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

const editorHosts = [
	"apps/web/src/components/canvas/skedra-canvas.tsx",
	"packages/react/src/skedra-canvas.tsx",
];

for (const file of editorHosts) {
	const source = readRepoFile(file);
	for (const requirement of [
		{ pattern: /<CanvasEditor\b/u, label: "render the shared <CanvasEditor>" },
		{ pattern: /documentAdapter=\{/u, label: "provide a document adapter" },
		{ pattern: /collaboration=\{/u, label: "declare collaboration services" },
	]) {
		if (!requirement.pattern.test(source)) {
			errors.push(`${file} must ${requirement.label}.`);
		}
	}
}

for (const file of [
	"apps/web/src/components/canvas/canvas-stage.tsx",
	"packages/react/src/skedra-canvas.tsx",
]) {
	if (!/worldDataAttribute=["']true["']/u.test(readRepoFile(file))) {
		errors.push(
			`Every host must mark the exportable CanvasEditorSurface world layer: ${file}.`,
		);
	}
}

const sharedInteractionConsumers = [
	[
		"apps/web/src/hooks/use-community-canvas-pointer-adapter.ts",
		"useCanvasEditorPointer",
	],
	["packages/react/src/skedra-canvas.tsx", "useCanvasEditorPointer"],
	[
		"apps/web/src/hooks/use-community-canvas-keyboard-adapter.ts",
		"useCanvasEditorKeyboard",
	],
	["packages/react/src/skedra-canvas.tsx", "useCanvasEditorKeyboard"],
	["apps/web/src/components/canvas/canvas-toolbar.tsx", "CanvasEditorToolbar"],
	["packages/react/src/skedra-canvas.tsx", "CanvasEditorToolbar"],
	["apps/web/src/components/canvas/canvas-stage.tsx", "CanvasEditorSurface"],
	["packages/react/src/skedra-canvas.tsx", "CanvasEditorSurface"],
	[
		"apps/web/src/components/canvas/canvas-stage.tsx",
		"CanvasEditorSelectionOverlay",
	],
	["packages/react/src/skedra-canvas.tsx", "CanvasEditorSelectionOverlay"],
	[
		"apps/web/src/components/canvas/canvas-stage.tsx",
		"CanvasEditorSelectionGestureOverlay",
	],
	[
		"packages/react/src/skedra-canvas.tsx",
		"CanvasEditorSelectionGestureOverlay",
	],
	[
		"apps/web/src/components/canvas/canvas-stage.tsx",
		"CanvasEditorGridOverlay",
	],
	["packages/react/src/skedra-canvas.tsx", "CanvasEditorGridOverlay"],
	[
		"apps/web/src/components/canvas/properties-panel.tsx",
		"CanvasEditorPropertiesPanel",
	],
	["packages/react/src/properties-panel.tsx", "CanvasEditorPropertiesPanel"],
];

// Hosts may wire storage/product services into the shared runtime, but the
// event routers themselves must remain single implementations in canvas-editor.
for (const [file, contract] of sharedInteractionConsumers) {
	if (!new RegExp(`\\b${contract}\\b`, "u").test(readRepoFile(file))) {
		errors.push(
			`${file} must consume the shared @skedra/canvas-editor contract ${contract}.`,
		);
	}
}

const sharedPropertiesConsumer = readRepoFile(
	"apps/web/src/components/canvas/properties-panel.tsx",
);
for (const contract of [
	"canvasBackground",
	"flowchartInsertKind",
	"onAddFlowchartNodeOnSide",
	"onSetFlowchartConnectorLabel",
	"onSetGeometryWidth",
	"onSetGeometryHeight",
	"onSetEllipseDiameter",
	"onPlaceDefaultElement",
]) {
	if (!new RegExp(`\\b${contract}\\b`, "u").test(sharedPropertiesConsumer)) {
		errors.push(`The Community properties adapter must preserve ${contract}.`);
	}
}

for (const relative of [
	"packages/canvas-editor/src/canvas-editor-properties-panel.tsx",
	"packages/canvas-editor/src/canvas-editor-tool-strip.tsx",
	"packages/canvas-editor/src/canvas-editor-toolbar.tsx",
]) {
	const source = readRepoFile(relative);
	if (/(?<!=)>[\t ]*[A-Za-z][^<{\r\n]*[\t ]*</u.test(source)) {
		errors.push(
			`Visible shared editor text must use the translation adapter: ${relative}`,
		);
	}
	if (/(?:aria-label|title|placeholder)="[A-Za-z]/u.test(source)) {
		errors.push(
			`Shared editor accessibility text must be translated: ${relative}`,
		);
	}
}

const stickyOverlaySource = readRepoFile(
	"packages/canvas-editor/src/canvas-editor-sticky-note-overlay.tsx",
);
if (
	!stickyOverlaySource.includes("☑") ||
	!stickyOverlaySource.includes("☐") ||
	stickyOverlaySource.includes("â˜")
) {
	errors.push("Sticky checklist glyphs must remain valid UTF-8 characters.");
}

for (const [file, requirements] of [
	[
		"packages/canvas-editor/src/use-canvas-editor-pointer.ts",
		[
			/\bconst\s+onPointerDown\b/u,
			/\bconst\s+onPointerMove\b/u,
			/\bconst\s+onPointerUp\b/u,
		],
	],
	[
		"packages/canvas-editor/src/use-canvas-editor-keyboard.ts",
		[
			/window\.addEventListener\(\s*["']keydown["']/u,
			/\bresolveCanvasEditorKeyboardAction\b/u,
		],
	],
]) {
	const source = readRepoFile(file);
	if (requirements.some((pattern) => !pattern.test(source))) {
		errors.push(`${file} must own the complete shared interaction pipeline.`);
	}
}

if (
	!/SkedraCanvas\s+as\s+CanvasEditor/u.test(
		readRepoFile("packages/react/src/index.ts"),
	)
) {
	errors.push(
		"@skedra/react must expose the bundled shared CanvasEditor entry point.",
	);
}

const forbiddenGenericHostFiles = [
	"apps/web/src/hooks/use-canvas-pointer.ts",
	"apps/web/src/hooks/use-canvas-keyboard.ts",
	"apps/web/src/hooks/use-canvas-keyboard/clipboard-layer.ts",
	"apps/web/src/hooks/use-canvas-keyboard/flowchart-viewport.ts",
	"apps/web/src/hooks/use-canvas-keyboard/handle-keydown.ts",
	"apps/web/src/hooks/use-canvas-keyboard/history-delete.ts",
	"apps/web/src/hooks/use-canvas-keyboard/tools-enter.ts",
	"apps/web/src/hooks/use-canvas-keyboard/ui-shortcuts.ts",
	"apps/web/src/hooks/use-canvas-pointer/pointer-draw-down.ts",
	"apps/web/src/hooks/use-canvas-pointer/pointer-draw-finish.ts",
	"apps/web/src/hooks/use-canvas-pointer/pointer-draw-move.ts",
	"apps/web/src/hooks/use-canvas-pointer/pointer-move-gesture.ts",
	"apps/web/src/hooks/use-canvas-pointer/pointer-selection.ts",
	"apps/web/src/hooks/use-canvas-pointer/pointer-tools.ts",
	"apps/web/src/components/canvas/image-crop-overlay.tsx",
	"apps/web/src/components/canvas/sticky-note-editor.tsx",
	"apps/web/src/components/canvas/text-editor.tsx",
	"apps/web/src/components/canvas/selection-handles.tsx",
	"apps/web/src/components/canvas/grid-overlay.tsx",
];

for (const relative of forbiddenGenericHostFiles) {
	if (readRepoFile(relative)) {
		errors.push(
			`Generic canvas interaction/UI must live in packages/canvas-editor: ${relative}`,
		);
	}
}

const sdkCanvasSource = readRepoFile("packages/react/src/skedra-canvas.tsx");
for (const pattern of [
	/\bconst\s+handlePointer(?:Down|Move|Up|Cancel)\b/u,
	/window\.addEventListener\(\s*["']key(?:down|up)["']/u,
	/\bresolveCanvasEditorPointerDown\b/u,
	/\bresolveCanvasEditorSelectPointerDown\b/u,
	/\bresolveCanvasEditorKeyboardAction\b/u,
	/\buseCanvasPathEditor\b/u,
]) {
	if (pattern.test(sdkCanvasSource)) {
		errors.push(
			"packages/react must not own a generic pointer or keyboard pipeline.",
		);
	}
}

if (
	!sdkCanvasSource.includes("handleSkedraSdkKeyboardAction(action") ||
	!sdkCanvasSource.includes("SkedraSdkKeyboardActionHandlers")
) {
	errors.push(
		"The SDK host must exhaustively dispatch every shared keyboard action.",
	);
}

const communityPointerAdapterSource = readRepoFile(
	"apps/web/src/hooks/use-community-canvas-pointer-adapter.ts",
);
for (const historyBoundary of [
	"finishHistory: stopUndoCapture",
	"cancelHistory: stopUndoCapture",
]) {
	if (!communityPointerAdapterSource.includes(historyBoundary)) {
		errors.push(
			`The Community pointer adapter must close the undo transaction on ${historyBoundary.split(":")[0]}.`,
		);
	}
}

const hostToolbarSources = [
	"apps/web/src/components/canvas/canvas-toolbar.tsx",
	"packages/react/src/skedra-canvas.tsx",
];

for (const relative of [
	"apps/web/src/components/canvas/canvas-toolbar.tsx",
	"apps/web/src/routes/guest.tsx",
]) {
	if (/\.skedra-canvas\s+svg/u.test(readRepoFile(relative))) {
		errors.push(
			`Visual export must use the mounted canvas ref, not the first descendant SVG: ${relative}`,
		);
	}
}

for (const relative of [
	"apps/web/src/lib/canvas/export-utils.ts",
	"packages/react/src/exporters.ts",
]) {
	if (!/@skedra\/canvas-io\/exporters/u.test(readRepoFile(relative))) {
		errors.push(
			`Visual export must delegate to @skedra/canvas-io: ${relative}`,
		);
	}
}

for (const relative of [
	"apps/web/src/lib/canvas/skedra-file-utils.ts",
	"packages/react/src/io.ts",
]) {
	if (!/@skedra\/canvas-io\/file/u.test(readRepoFile(relative))) {
		errors.push(
			`Skedra file IO must delegate to @skedra/canvas-io: ${relative}`,
		);
	}
}

const serverSyncSource = readRepoFile(
	"apps/web/src/hooks/use-server-canvas-sync.ts",
);
for (const durableQueueContract of [
	"enqueuePendingServerUpdate",
	"listPendingServerUpdates",
	"deletePendingServerUpdates",
	"PENDING_SERVER_ORIGIN",
]) {
	if (!serverSyncSource.includes(durableQueueContract)) {
		errors.push(
			`Server canvas sync must preserve its durable offline queue contract: ${durableQueueContract}.`,
		);
	}
}

const communityExportSource = readRepoFile(
	".github/scripts/export-community.mjs",
);
if (communityExportSource) {
	for (const relative of [
		".github/scripts/export-community.mjs",
		".github/workflows/sync-community.yml",
		".github/workflows/canvas-sdk.yml",
		".github/workflows/npm-sdk-release.yml",
	]) {
		if (!readRepoFile(relative).includes("packages/canvas-io")) {
			errors.push(
				`The shared IO source must be exported and covered by SDK automation: ${relative}.`,
			);
		}
	}
}
for (const relative of hostToolbarSources) {
	const source = readRepoFile(relative);
	if (
		relative.startsWith("apps/web/") &&
		/(?:<(?:button|input|select)\b|\b(?:DropdownMenu|Tooltip)(?:Content|Item|Provider|Trigger)?\b)/u.test(
			source,
		)
	) {
		errors.push(
			`The Community toolbar adapter must not render its own controls: ${relative}`,
		);
	}
	for (const pattern of [
		/<CanvasEditorToolStrip\b/u,
		/<div\s+className=["']skedra-sdk__toolbar["']/u,
		/<(?:button|input|select)\b[^>]*(?:canvas\.toolbar|skedra-sdk__(?:__tool|__color|__clear-fill))/u,
	]) {
		if (pattern.test(source)) {
			errors.push(
				`Generic toolbar markup must live in packages/canvas-editor: ${relative}`,
			);
		}
	}
}

for (const relative of [
	"apps/web/src/components/canvas/properties-panel.tsx",
	"packages/react/src/properties-panel.tsx",
]) {
	if (/<(?:button|input|select|textarea)\b/u.test(readRepoFile(relative))) {
		errors.push(
			`Generic properties markup must live in packages/canvas-editor: ${relative}`,
		);
	}
}

for (const relative of [
	"apps/web/src/components/canvas/canvas-stage.tsx",
	"packages/react/src/skedra-canvas.tsx",
]) {
	const source = readRepoFile(relative);
	for (const pattern of [
		/<svg\b[\s\S]{0,500}\bonPointerDown=/u,
		/\b(?:SDK_RESIZE_HANDLES|getHandlePosition)\b/u,
		/key=\{`resize-/u,
		/className=["']skedra-sdk__(?:selection|lasso)["']/u,
	]) {
		if (pattern.test(source)) {
			errors.push(
				`Generic canvas surface and selection UI must live in packages/canvas-editor: ${relative}`,
			);
		}
	}
}

const interactionConsumerRoots = [
	path.join(repoRoot, "apps", "web", "src", "components", "canvas"),
	path.join(repoRoot, "apps", "web", "src", "hooks"),
	path.join(repoRoot, "packages", "react", "src"),
];
const allowedPointerRouterFiles = new Set([
	"apps/web/src/components/canvas/hooks/use-skedra-canvas-pointer-bridge.ts",
]);
const allowedGlobalInputListeners = new Map([
	[
		"apps/web/src/components/canvas/context-menu.tsx",
		new Set(["keydown:handleKey"]),
	],
	[
		"apps/web/src/components/canvas/skedra-canvas.tsx",
		new Set(["keydown:handlePresenterKeyDown"]),
	],
]);
const genericInteractionImplementationPatterns = [
	/\bresolveCanvasEditorPointerDown\b/u,
	/\bresolveCanvasEditorSelectPointerDown\b/u,
	/\bresolveCanvasEditorKeyboardAction\b/u,
	/\buseCanvasPathEditor\b/u,
];
const rawPointerRouterPattern =
	/\b(?:const|function)\s+(?:handle|on)Pointer(?:Down|Move|Up|Cancel)\b/u;
const globalInputListenerPattern =
	/(?:window|document)\.addEventListener\(\s*["'](key(?:down|up)|pointer(?:down|move|up|cancel)|wheel)["']\s*,\s*([^,\r\n)]+)/gu;

for (const root of interactionConsumerRoots) {
	for (const file of listFiles(root)) {
		if (!/\.[jt]sx?$/u.test(file)) continue;
		const relative = toPosix(path.relative(repoRoot, file));
		const source = fs.readFileSync(file, "utf8");
		if (
			genericInteractionImplementationPatterns.some((pattern) =>
				pattern.test(source),
			)
		) {
			errors.push(
				`Consumer adapters must not import or implement generic canvas event resolvers: ${relative}`,
			);
		}
		if (
			rawPointerRouterPattern.test(source) &&
			!allowedPointerRouterFiles.has(relative)
		) {
			errors.push(
				`Generic pointer routing must live in packages/canvas-editor: ${relative}`,
			);
		}
		for (const match of source.matchAll(globalInputListenerPattern)) {
			const listener = `${match[1]}:${match[2].trim()}`;
			if (allowedGlobalInputListeners.get(relative)?.has(listener)) continue;
			errors.push(
				`Global canvas input routing must live in packages/canvas-editor: ${relative} (${listener})`,
			);
		}
	}
}

const webPointerBridge = readRepoFile(
	"apps/web/src/components/canvas/hooks/use-skedra-canvas-pointer-bridge.ts",
);
for (const handler of [
	"onPointerDown",
	"onPointerMove",
	"onPointerUp",
	"onPointerCancel",
	"onLostPointerCapture",
]) {
	if (
		!new RegExp(`pointerHandlers\\.${handler}\\b`, "u").test(webPointerBridge)
	) {
		errors.push(`The Community pointer bridge must delegate ${handler}.`);
	}
}

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
	/\bfunction\s+buildCanvasMoveUpdates\b/u,
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
