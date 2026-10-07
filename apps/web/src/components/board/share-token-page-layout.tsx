/**
 * Gemeinsames Layout fuer Collab- und Praesentations-Share-Links.
 */

import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { savePendingTemplateStateBase64 } from "@/lib/canvas/local-canvas-storage";
import { trackGrowthEvent } from "@/lib/growth-analytics";
import { useI18n } from "@/lib/i18n";
import { localizePublicPath } from "@/lib/public-path";
import { ArrowLeft, CopyPlus, Loader2 } from "lucide-react";
import {
	type MutableRefObject,
	type ReactNode,
	Suspense,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
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

export function ShareTokenCanvasFrame({
	children,
	templateStateRef,
}: {
	children: ReactNode;
	templateStateRef?: MutableRefObject<(() => string | null) | null>;
}) {
	return (
		<div className="skedra-public-board relative h-dvh overflow-hidden bg-background">
			<Suspense
				fallback={
					<div className="flex h-full items-center justify-center">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
					</div>
				}
			>
				{children}
			</Suspense>
			<PublicBoardAttribution templateStateRef={templateStateRef} />
		</div>
	);
}

function PublicBoardAttribution({
	templateStateRef,
}: {
	templateStateRef?: MutableRefObject<(() => string | null) | null>;
}) {
	const { locale } = useI18n();
	const [copyUnavailable, setCopyUnavailable] = useState(false);
	const attributionRef = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const element = attributionRef.current;
		const frame = element?.closest<HTMLElement>(".skedra-public-board");
		if (!element || !frame) return;
		const measure = () =>
			frame.style.setProperty(
				"--skedra-public-footer-inset",
				`${element.offsetHeight + 24}px`,
			);
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		measure();
		return () => {
			observer.disconnect();
			frame.style.removeProperty("--skedra-public-footer-inset");
		};
	}, []);
	const homePath = localizePublicPath("/", locale);
	const useTemplate = () => {
		const state = templateStateRef?.current?.();
		if (!state) {
			setCopyUnavailable(true);
			setTimeout(() => setCopyUnavailable(false), 2500);
			return;
		}
		savePendingTemplateStateBase64(state);
		trackGrowthEvent("template_used", { context: "public_board" });
		window.location.assign(
			`${homePath}?utm_source=public_board&utm_medium=product`,
		);
	};

	return (
		<div
			ref={attributionRef}
			data-skedra-ui="public-attribution"
			className="absolute bottom-3 right-3 z-50 flex max-w-[calc(100%-1.5rem)] items-center gap-1 rounded-xl border border-border bg-background/92 p-1 shadow-lg backdrop-blur"
		>
			<Button asChild variant="ghost" size="sm" className="h-8 px-2.5">
				<Link to={`${homePath}?utm_source=public_board&utm_medium=product`}>
					<BrandLogo showWordmark={false} markClassName="h-5 w-5" />
					<span className="hidden sm:inline">Made with Skedra</span>
				</Link>
			</Button>
			{templateStateRef ? (
				<Button
					variant="secondary"
					size="sm"
					className="h-8 px-2.5"
					aria-label={
						locale === "en" ? "Use as template" : "Als Vorlage verwenden"
					}
					onClick={useTemplate}
				>
					{copyUnavailable ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<CopyPlus className="h-3.5 w-3.5" />
					)}
					<span className="hidden sm:inline">
						{copyUnavailable
							? locale === "en"
								? "Board is still loading"
								: "Board lädt noch"
							: locale === "en"
								? "Use as template"
								: "Als Vorlage verwenden"}
					</span>
				</Button>
			) : null}
		</div>
	);
}
