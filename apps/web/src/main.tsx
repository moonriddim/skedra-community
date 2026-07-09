import { useCanvasStore } from "@/hooks/use-canvas-store";
import { loadI18nMessages } from "@/lib/i18n";
import { getCurrentLocale, initLocale } from "@/stores/locale";
import { initTheme } from "@/stores/theme";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@livekit/components-styles";
import "./app.css";

initLocale();
initTheme();
useCanvasStore.getState().syncTheme();

async function bootstrap() {
	await loadI18nMessages(getCurrentLocale());

	const rootElement = document.getElementById("root");
	if (!rootElement) {
		throw new Error("Root element not found");
	}

	createRoot(rootElement).render(<App />);
}

void bootstrap();
