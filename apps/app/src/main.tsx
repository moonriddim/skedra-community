import {
	SkedraCanvas,
	type SkedraCanvasApi,
	type SkedraCanvasTheme,
	createSkedraFrameElement,
	createSkedraMindmapElements,
	createSkedraStickyNoteElement,
} from "@skedra/react";
import {
	Download,
	FolderOpen,
	Moon,
	RotateCcw,
	Sun,
	Upload,
} from "lucide-react";
import {
	type ChangeEvent,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import { createRoot } from "react-dom/client";
import "@skedra/react/style.css";
import "./styles.css";

const STORAGE_KEY = "skedra-core:elements";

function App() {
	const canvasApiRef = useRef<SkedraCanvasApi>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const initialElements = useMemo(loadInitialElements, []);
	const [elements, setElements] = useState(initialElements);
	const [theme, setTheme] = useState<SkedraCanvasTheme>(() =>
		window.matchMedia?.("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light",
	);

	const commitElements = useCallback((nextElements: typeof initialElements) => {
		setElements(nextElements);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(nextElements));
	}, []);

	const handleExport = useCallback(() => {
		const payload = {
			type: "skedra-core",
			version: 1,
			elements,
		};
		const blob = new Blob([JSON.stringify(payload, null, 2)], {
			type: "application/json",
		});
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = "skedra-core.skedra";
		link.click();
		URL.revokeObjectURL(link.href);
	}, [elements]);

	const handleImport = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			event.target.value = "";
			if (!file) return;

			const reader = new FileReader();
			reader.addEventListener("load", () => {
				try {
					const parsed = JSON.parse(String(reader.result));
					const nextElements = Array.isArray(parsed) ? parsed : parsed.elements;
					if (!Array.isArray(nextElements)) return;
					canvasApiRef.current?.setElements(nextElements);
					commitElements(nextElements);
				} catch {
					return;
				}
			});
			reader.readAsText(file);
		},
		[commitElements],
	);

	const handleReset = useCallback(() => {
		const nextElements = createWelcomeElements();
		canvasApiRef.current?.setElements(nextElements);
		commitElements(nextElements);
	}, [commitElements]);

	return (
		<div className="app-shell" data-theme={theme}>
			<header className="app-bar">
				<div className="app-brand">
					<span className="app-brand__mark" aria-hidden="true" />
					<span>Skedra Core</span>
				</div>
				<div className="app-actions">
					<button
						type="button"
						className="icon-button"
						onClick={() => fileInputRef.current?.click()}
						title="Open"
						aria-label="Open"
					>
						<FolderOpen size={18} />
					</button>
					<button
						type="button"
						className="icon-button"
						onClick={handleExport}
						title="Download"
						aria-label="Download"
					>
						<Download size={18} />
					</button>
					<button
						type="button"
						className="icon-button"
						onClick={handleReset}
						title="Reset"
						aria-label="Reset"
					>
						<RotateCcw size={18} />
					</button>
					<button
						type="button"
						className="icon-button"
						onClick={() =>
							setTheme((current) => (current === "dark" ? "light" : "dark"))
						}
						title={theme === "dark" ? "Light" : "Dark"}
						aria-label={theme === "dark" ? "Light" : "Dark"}
					>
						{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
					</button>
				</div>
				<input
					ref={fileInputRef}
					className="file-input"
					type="file"
					accept=".json,.skedra,application/json"
					onChange={handleImport}
				/>
			</header>
			<main className="canvas-wrap">
				<SkedraCanvas
					ref={canvasApiRef}
					defaultElements={initialElements}
					onChange={commitElements}
					theme={theme}
					showToolbar
				/>
			</main>
			<footer className="app-status">
				<span>{elements.length}</span>
				<Upload size={14} aria-hidden="true" />
			</footer>
		</div>
	);
}

function loadInitialElements() {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return createWelcomeElements();
		const parsed = JSON.parse(stored);
		return Array.isArray(parsed) ? parsed : createWelcomeElements();
	} catch {
		return createWelcomeElements();
	}
}

function createWelcomeElements() {
	return [
		createSkedraFrameElement({
			x: -360,
			y: -220,
			width: 720,
			height: 440,
			title: "Skedra Core",
			theme: "light",
		}),
		createSkedraStickyNoteElement({
			x: -280,
			y: -120,
			text: "Open canvas",
			color: "#fef3c7",
			theme: "light",
		}),
		createSkedraStickyNoteElement({
			x: 70,
			y: -120,
			text: "Local files",
			color: "#dbeafe",
			theme: "light",
		}),
		...createSkedraMindmapElements({
			x: -110,
			y: 100,
			text: "OSS editor",
			theme: "light",
		}),
	];
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
