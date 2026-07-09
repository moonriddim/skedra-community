import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { getRuntimeConfigValue } from "./lib/runtime-config";
import { trpc } from "./lib/trpc";
import "./app.css";

function getTrpcUrl() {
	const api =
		getRuntimeConfigValue("API_URL") || import.meta.env.VITE_API_URL?.trim();
	if (api) return `${api.replace(/\/$/, "")}/api/trpc`;
	return "/api/trpc";
}

function Root() {
	const [queryClient] = useState(() => new QueryClient());
	const [trpcClient] = useState(() =>
		trpc.createClient({
			links: [
				httpBatchLink({
					url: getTrpcUrl(),
					fetch(url, options) {
						return fetch(url, { ...options, credentials: "omit" });
					},
				}),
			],
		}),
	);

	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>
				<App />
			</QueryClientProvider>
		</trpc.Provider>
	);
}

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Root element not found");
}

createRoot(rootElement).render(
	<StrictMode>
		<Root />
	</StrictMode>,
);
