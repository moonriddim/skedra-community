import { SeoManager } from "@/components/public/seo-manager";
import { getApiUrl } from "@/lib/api-url";
import { I18nProvider } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { AuthLayout } from "@/routes/layout";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { Loader2 } from "lucide-react";
import {
	Component,
	type ErrorInfo,
	type ReactNode,
	Suspense,
	lazy,
	useState,
} from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

const GuestCanvasPage = lazy(() =>
	import("@/routes/guest").then((m) => ({ default: m.GuestCanvasPage })),
);
const LoginPage = lazy(() =>
	import("@/routes/login").then((m) => ({ default: m.LoginPage })),
);
const TwoFactorPage = lazy(() =>
	import("@/routes/two-factor").then((m) => ({ default: m.TwoFactorPage })),
);
const RegisterPage = lazy(() =>
	import("@/routes/register").then((m) => ({ default: m.RegisterPage })),
);
const SubscribePage = lazy(() =>
	import("@/routes/subscribe").then((m) => ({ default: m.SubscribePage })),
);
const PricingPage = lazy(() =>
	import("@/routes/pricing").then((m) => ({ default: m.PricingPage })),
);
const WhiteboardPage = lazy(() =>
	import("@/routes/whiteboard").then((m) => ({ default: m.WhiteboardPage })),
);
const PrivacyPage = lazy(() =>
	import("@/routes/privacy").then((m) => ({ default: m.PrivacyPage })),
);
const TermsPage = lazy(() =>
	import("@/routes/terms").then((m) => ({ default: m.TermsPage })),
);
const ImprintPage = lazy(() =>
	import("@/routes/imprint").then((m) => ({ default: m.ImprintPage })),
);
const ForgotPasswordPage = lazy(() =>
	import("@/routes/forgot-password").then((m) => ({
		default: m.ForgotPasswordPage,
	})),
);
const ResetPasswordPage = lazy(() =>
	import("@/routes/reset-password").then((m) => ({
		default: m.ResetPasswordPage,
	})),
);
const PresentationPage = lazy(() =>
	import("@/routes/presentation").then((m) => ({
		default: m.PresentationPage,
	})),
);
const CollabPage = lazy(() =>
	import("@/routes/collab").then((m) => ({ default: m.CollabPage })),
);
const EmbedPage = lazy(() =>
	import("@/routes/embed").then((m) => ({ default: m.EmbedPage })),
);
const HomePage = lazy(() =>
	import("@/routes/home").then((m) => ({ default: m.HomePage })),
);
const ApiKeysSettingsPage = lazy(() =>
	import("@/routes/settings").then((m) => ({ default: m.ApiKeysSettingsPage })),
);
const BoardPage = lazy(() =>
	import("@/routes/board").then((m) => ({ default: m.BoardPage })),
);
function PageLoader() {
	return (
		<div className="flex h-full items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}

function RootPage() {
	return <GuestCanvasPage />;
}

class AppErrorBoundary extends Component<
	{ children: ReactNode },
	{ failed: boolean }
> {
	state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("Skedra rendering failed", error, info);
	}

	render() {
		if (!this.state.failed) return this.props.children;
		return (
			<main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
				<div className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-lg">
					<h1 className="text-xl font-semibold">
						Skedra konnte nicht geladen werden
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Die Seite ist möglicherweise noch mit einer älteren App-Version
						geöffnet.
					</p>
					<button
						type="button"
						className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
						onClick={() => window.location.reload()}
					>
						Neu laden
					</button>
				</div>
			</main>
		);
	}
}

export function App() {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: { staleTime: 1000 * 60, retry: 1 },
				},
			}),
	);

	const [trpcClient] = useState(() =>
		trpc.createClient({
			links: [
				httpBatchLink({
					url: getApiUrl("/api/trpc"),
					fetch(url, options) {
						return fetch(url, { ...options, credentials: "include" });
					},
				}),
			],
		}),
	);

	const app = (
		<I18nProvider>
			<trpc.Provider client={trpcClient} queryClient={queryClient}>
				<QueryClientProvider client={queryClient}>
					<BrowserRouter>
						<SeoManager />
						<Routes>
							<Route
								path="/login"
								element={
									<Suspense fallback={<PageLoader />}>
										<LoginPage />
									</Suspense>
								}
							/>
							<Route
								path="/register"
								element={
									<Suspense fallback={<PageLoader />}>
										<RegisterPage />
									</Suspense>
								}
							/>
							<Route
								path="/two-factor"
								element={
									<Suspense fallback={<PageLoader />}>
										<TwoFactorPage />
									</Suspense>
								}
							/>
							<Route
								path="/subscribe"
								element={
									<Suspense fallback={<PageLoader />}>
										<SubscribePage />
									</Suspense>
								}
							/>
							<Route
								path="/whiteboard"
								element={
									<Suspense fallback={<PageLoader />}>
										<WhiteboardPage />
									</Suspense>
								}
							/>
							<Route
								path="/pricing"
								element={
									<Suspense fallback={<PageLoader />}>
										<PricingPage />
									</Suspense>
								}
							/>
							<Route
								path="/privacy"
								element={
									<Suspense fallback={<PageLoader />}>
										<PrivacyPage />
									</Suspense>
								}
							/>
							<Route
								path="/terms"
								element={
									<Suspense fallback={<PageLoader />}>
										<TermsPage />
									</Suspense>
								}
							/>
							<Route
								path="/imprint"
								element={
									<Suspense fallback={<PageLoader />}>
										<ImprintPage />
									</Suspense>
								}
							/>
							<Route
								path="/forgot-password"
								element={
									<Suspense fallback={<PageLoader />}>
										<ForgotPasswordPage />
									</Suspense>
								}
							/>
							<Route
								path="/reset-password"
								element={
									<Suspense fallback={<PageLoader />}>
										<ResetPasswordPage />
									</Suspense>
								}
							/>
							<Route
								path="/present/:shareToken"
								element={
									<Suspense fallback={<PageLoader />}>
										<PresentationPage />
									</Suspense>
								}
							/>
							<Route
								path="/collab/:shareToken"
								element={
									<Suspense fallback={<PageLoader />}>
										<CollabPage />
									</Suspense>
								}
							/>
							<Route
								path="/embed/:shareToken"
								element={
									<Suspense fallback={<PageLoader />}>
										<EmbedPage />
									</Suspense>
								}
							/>
							<Route
								path="/"
								element={
									<Suspense fallback={<PageLoader />}>
										<RootPage />
									</Suspense>
								}
							/>

							<Route element={<AuthLayout />}>
								<Route
									path="/library"
									element={
										<Suspense fallback={<PageLoader />}>
											<HomePage />
										</Suspense>
									}
								/>
								<Route
									path="/settings"
									element={
										<Suspense fallback={<PageLoader />}>
											<ApiKeysSettingsPage />
										</Suspense>
									}
								/>
								<Route
									path="/board/:boardId"
									element={
										<Suspense fallback={<PageLoader />}>
											<BoardPage />
										</Suspense>
									}
								/>
							</Route>

							<Route path="*" element={<Navigate to="/" replace />} />
						</Routes>
					</BrowserRouter>
				</QueryClientProvider>
			</trpc.Provider>
		</I18nProvider>
	);

	return <AppErrorBoundary>{app}</AppErrorBoundary>;
}
