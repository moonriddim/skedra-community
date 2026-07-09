/**
 * Gemeinsames Layout fuer Collab- und Praesentations-Share-Links.
 */

import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { type ReactNode, Suspense } from "react";
import { Link } from "react-router";

export function ShareTokenLoadingScreen() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<div className="flex flex-col items-center gap-4">
				<BrandLogo showWordmark={false} markClassName="h-14 w-14" />
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		</div>
	);
}

interface ShareTokenUnavailableCardProps {
	icon: ReactNode;
	title: string;
	description: string;
	backToLoginLabel: string;
}

export function ShareTokenUnavailableCard({
	icon,
	title,
	description,
	backToLoginLabel,
}: ShareTokenUnavailableCardProps) {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
				<BrandLogo className="justify-center" />
				<div className="mx-auto flex justify-center">{icon}</div>
				<h1 className="text-xl font-semibold">{title}</h1>
				<p className="text-sm text-muted-foreground">{description}</p>
				<Button asChild variant="outline">
					<Link to="/login">
						<ArrowLeft className="mr-2 h-4 w-4" />
						{backToLoginLabel}
					</Link>
				</Button>
			</div>
		</div>
	);
}

export function ShareTokenCanvasFrame({ children }: { children: ReactNode }) {
	return (
		<div className="relative h-screen overflow-hidden bg-background">
			<Suspense
				fallback={
					<div className="flex h-full items-center justify-center">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
					</div>
				}
			>
				{children}
			</Suspense>
		</div>
	);
}
