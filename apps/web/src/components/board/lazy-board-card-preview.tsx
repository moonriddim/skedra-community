/**
 * Laedt Y.js-State erst bei Sichtbarkeit — spart Bandbreite in der Library-Liste.
 */

import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { WhiteboardCardPreview } from "./board-card-preview";

interface LazyBoardCardPreviewProps {
	boardId: string;
	emptyLabel: string;
}

function PreviewSkeleton() {
	return (
		<div className="flex h-48 items-center justify-center rounded-[22px] border border-border/70 bg-muted/30">
			<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
		</div>
	);
}

export function LazyBoardCardPreview({
	boardId,
	emptyLabel,
}: LazyBoardCardPreviewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);

	// Preview-State nur laden wenn die Karte im Viewport ist
	useEffect(() => {
		const node = containerRef.current;
		if (!node) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					setIsVisible(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "120px" },
		);

		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	const { data, isLoading } = trpc.whiteboard.getPreviewState.useQuery(
		{ id: boardId },
		{ enabled: isVisible, staleTime: 1000 * 60 * 5 },
	);

	return (
		<div ref={containerRef}>
			{!isVisible || isLoading ? (
				<PreviewSkeleton />
			) : (
				<WhiteboardCardPreview
					yjsState={data?.yjsState ?? null}
					emptyLabel={emptyLabel}
				/>
			)}
		</div>
	);
}
