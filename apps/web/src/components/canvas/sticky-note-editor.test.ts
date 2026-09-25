import assert from "node:assert/strict";
import test from "node:test";
import type { CanvasEditorStickyNoteOverlayProps } from "@skedra/canvas-editor";
import { Window } from "happy-dom";

test("sticky editor preserves per-line sizes, drafts and checklist state through formatting", async () => {
	const browser = new Window({ url: "http://localhost" });
	const globals = {
		window: browser,
		document: browser.document,
		navigator: browser.navigator,
		HTMLElement: browser.HTMLElement,
		Element: browser.Element,
		Node: browser.Node,
		CustomEvent: browser.CustomEvent,
		Event: browser.Event,
		requestAnimationFrame: browser.requestAnimationFrame.bind(browser),
		cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser),
	};
	for (const [key, value] of Object.entries(globals))
		Object.defineProperty(globalThis, key, { configurable: true, value });
	const React = await import("react");
	// tsx loads workspace sources with their package's JSX-preserve configuration.
	Object.defineProperty(globalThis, "React", {
		configurable: true,
		value: React,
	});
	const { createElement } = React;
	const { createRoot } = await import("react-dom/client");
	const { flushSync } = await import("react-dom");
	const { CanvasEditorStickyNoteOverlay, applyActiveStickyFontSize } =
		await import("@skedra/canvas-editor");
	const container = document.createElement("div");
	document.body.append(container);
	const errors: unknown[] = [];
	const root = createRoot(container, {
		onUncaughtError: (error) => errors.push(error),
	});
	const saves: Parameters<
		CanvasEditorStickyNoteOverlayProps["onUpdateStickyNote"]
	>[] = [];
	let commit: (() => void) | null = null;
	const props: CanvasEditorStickyNoteOverlayProps = {
		editing: {
			id: "note",
			x: 0,
			y: 0,
			width: 200,
			height: 200,
			text: "firstsecond",
			stroke: "#111",
			fontSize: 20,
			fontFamily: "sans-serif",
			textAlign: "left",
			fontWeight: "normal",
			fontStyle: "normal",
			textDecoration: "none",
			variant: "sticky-note",
		},
		stickyNoteMode: "note",
		stickyChecklist: [],
		viewport: { x: 0, y: 0, zoom: 1 },
		svgRef: { current: null },
		onUpdateStickyNote: (...args) => saves.push(args),
		onClose: () => {},
		onRegisterCommit: (callback) => {
			commit = callback;
		},
	};
	const tick = () => new Promise((resolve) => setTimeout(resolve, 30));
	try {
		flushSync(() =>
			root.render(
				createElement(CanvasEditorStickyNoteOverlay, { ...props, key: "note" }),
			),
		);
		await tick();
		const first = container.querySelector("textarea");
		assert.deepEqual(errors, []);
		assert.ok(first);
		assert.equal(
			container.querySelector("dialog"),
			null,
			"editing must stay on the paper, not open a dialog",
		);
		assert.equal(
			container.querySelector(".canvas-editor__sticky-editor-header"),
			null,
		);
		const paper = container.querySelector<HTMLElement>(
			"[data-sticky-note-editor]",
		);
		assert.equal(paper?.style.width, "200px");
		assert.equal(paper?.style.transform, "scale(1) rotate(0deg)");
		first.setSelectionRange(5, 5);
		flushSync(() =>
			first.dispatchEvent(
				new browser.KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
				}) as unknown as Event,
			),
		);
		await tick();
		assert.equal(container.querySelectorAll("textarea").length, 2);
		flushSync(() => assert.equal(applyActiveStickyFontSize("note", 48), true));
		await tick();
		// Host formatting updates must not reset the draft or its newly inserted row.
		flushSync(() =>
			root.render(
				createElement(CanvasEditorStickyNoteOverlay, {
					...props,
					key: "note",
					editing: { ...props.editing, fontStyle: "italic" },
				}),
			),
		);
		await tick();
		assert.ok(commit);
		flushSync(() => commit?.());
		assert.equal(saves[0][2], "first\nsecond");
		assert.deepEqual(saves[0][4]?.textFontSizes, [20, 48]);
		flushSync(() =>
			root.render(
				createElement(CanvasEditorStickyNoteOverlay, {
					...props,
					key: "checklist",
					stickyNoteMode: "checklist",
					stickyChecklist: [
						{ id: "one", text: "Milk", completed: false, fontSize: 12 },
						{ id: "two", text: "Bread", completed: true, fontSize: 32 },
					],
				}),
			),
		);
		await tick();
		const toggle = container.querySelector<HTMLButtonElement>(
			".canvas-editor__sticky-checkbox",
		);
		assert.ok(toggle);
		flushSync(() => toggle.click());
		flushSync(() => assert.equal(applyActiveStickyFontSize("note", 8), true));
		await tick();
		flushSync(() => commit?.());
		assert.deepEqual(saves[1][3], [
			{ id: "one", text: "Milk", completed: true, fontSize: 8 },
			{ id: "two", text: "Bread", completed: true, fontSize: 32 },
		]);
		assert.deepEqual(errors, []);
		flushSync(() =>
			root.render(
				createElement(CanvasEditorStickyNoteOverlay, {
					...props,
					key: "targeted",
					initialFocus: "line:1",
					editing: { ...props.editing, text: "first\nsecond" },
				}),
			),
		);
		await tick();
		assert.equal(
			document.activeElement?.getAttribute("aria-label"),
			"Line 2",
			"targeted editing should focus the chosen line",
		);
		const { CanvasRenderer } = await import("@skedra/canvas-react");
		const { CanvasScene } = await import("@skedra/canvas-core");
		const scene = CanvasScene.from([
			{
				id: "paper",
				type: "rectangle",
				x: 0,
				y: 0,
				width: 200,
				height: 200,
				rotation: 0,
				fill: "#fff3bf",
				stroke: "#111",
				strokeWidth: 1,
				strokeStyle: "solid",
				opacity: 100,
				locked: false,
				groupId: null,
				flipX: false,
				flipY: false,
				text: "First\nSecond",
				customData: { skedraType: "sticky-note" },
			},
		]);
		const edits: Array<[string, string | undefined]> = [];
		let canvasPointerDowns = 0;
		for (const interactive of [true, false]) {
			flushSync(() =>
				root.render(
					createElement(
						"svg",
						{
							onPointerDown: () => {
								canvasPointerDowns++;
							},
						},
						createElement(CanvasRenderer, {
							scene,
							selectedIds: new Set<string>(),
							config: {
								interactive,
								actions: {
									editStickyNote: (id, target) => edits.push([id, target]),
								},
							},
						}),
					),
				),
			);
			const line = container.querySelector<HTMLElement>(
				'[data-sticky-edit-target="line:1"]',
			);
			assert.ok(line);
			const content = line.closest("foreignObject")?.firstElementChild;
			assert.ok(content);

			for (const type of ["pointerdown", "pointerup"])
				flushSync(() =>
					line.dispatchEvent(
						new browser.PointerEvent(type, {
							bubbles: true,
							isPrimary: true,
							button: 0,
							clientX: 10,
							clientY: 40,
							pointerId: 1,
						}) as unknown as Event,
					),
				);
			assert.equal(
				edits.length,
				interactive ? 0 : 1,
				"single clicks must only select the note",
			);
			flushSync(() =>
				line.dispatchEvent(
					new browser.MouseEvent("dblclick", {
						bubbles: true,
						button: 0,
					}) as unknown as Event,
				),
			);
		}
		assert.deepEqual(
			edits,
			[["paper", "line:1"]],
			"only editable notes should start inline editing",
		);
		assert.equal(
			canvasPointerDowns,
			2,
			"notes and placement previews must pass pointer events through for selection and dragging",
		);
	} finally {
		flushSync(() => root.unmount());
		await browser.happyDOM.close();
	}
});
