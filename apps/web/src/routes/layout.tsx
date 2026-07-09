import { authClient } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";
import { useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router";

export function AuthLayout() {
	const { data: session, isPending } = authClient.useSession();
	const hasResolved = useRef(false);
	const location = useLocation();
	const isBoardRoute = /^\/board\/[^/]+$/.test(location.pathname);

	if (!isPending) hasResolved.current = true;

	if (isPending && !hasResolved.current) {
		return (
			<div className="flex h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	if (!isPending && !session?.user) {
		const redirect = encodeURIComponent(
			`${location.pathname}${location.search}`,
		);
		return <Navigate to={`/login?redirect=${redirect}`} replace />;
	}

	return (
		<div className="flex h-screen overflow-hidden bg-background">
			<main
				className={`min-h-0 flex-1 ${isBoardRoute ? "overflow-hidden" : "overflow-y-auto"}`}
			>
				<Outlet />
			</main>
		</div>
	);
}
