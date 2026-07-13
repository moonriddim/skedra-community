import { useCanvasStore } from "@/hooks/use-canvas-store";
import {
	installChunkLoadRecovery,
	markChunkLoadingHealthy,
} from "@/lib/chunk-recovery";
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
installChunkLoadRecovery();

async function bootstrap() {
	await loadI18nMessages(getCurrentLocale());

	const rootElement = document.getElementById("root");
	if (!rootElement) {
		throw new Error("Root element not found");
	}

	createRoot(rootElement).render(<App />);
	markChunkLoadingHealthy();
}

function renderBootstrapError(error: unknown) {
	console.error("Skedra bootstrap failed", error);
	const rootElement = document.getElementById("root");
	if (!rootElement) return;
	const container = document.createElement("main");
	container.className =
		"flex min-h-screen items-center justify-center bg-background p-6 text-foreground";
	const message = document.createElement("p");
	message.textContent =
		"Skedra konnte nicht geladen werden. Bitte lade die Seite neu.";
	const reload = document.createElement("button");
	reload.type = "button";
	reload.className =
		"ml-4 rounded-md bg-primary px-4 py-2 text-primary-foreground";
	reload.textContent = "Neu laden";
	reload.addEventListener("click", () => window.location.reload());
	container.append(message, reload);
	rootElement.replaceChildren(container);
}

void bootstrap().catch(renderBootstrapError);
