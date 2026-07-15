/** Laedt den Board-State erst bei Sichtbarkeit, um die Bibliothek leicht zu halten. */

import {
	type WhiteboardPreviewState,
	readWhiteboardPreviewState,
} from "@/lib/canvas/preview";
import { readStoredE2eeKey } from "@/lib/e2ee";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { WhiteboardCardPreview } from "./board-card-preview";

interface LazyBoardCardPreviewProps {
	boardId: string;
	emptyLabel: string;
}

export function LazyBoardCardPreview({
	boardId,
	emptyLabel,
}: LazyBoardCardPreviewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);
	const [preview, setPreview] = useState<WhiteboardPreviewState | null>(null);
	const [isReading, setIsReading] = useState(false);

	useEffect(() => {
		const node = containerRef.current;
		if (!node) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting) return;
				setIsVisible(true);
				observer.disconnect();
			},
			{ rootMargin: "120px" },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	const { data, isLoading } = trpc.whiteboard.getPreviewState.useQuery(
		{ id: boardId },
		{
			enabled: isVisible,
			staleTime: 1000 * 60 * 5,
			refetchOnWindowFocus: false,
		},
	);

	useEffect(() => {
		if (!data) return;
		let cancelled = false;
		setIsReading(true);
		void readWhiteboardPreviewState({
			updates: data.updates,
			encryptionMode: data.encryptionMode,
			e2eeKey:
				data.encryptionMode === "e2ee" ? readStoredE2eeKey(boardId) : null,
		})
			.then((next) => {
				if (!cancelled) setPreview(next);
			})
			.catch(() => {
				if (!cancelled) setPreview({ elements: new Map(), canvasBg: "" });
			})
			.finally(() => {
				if (!cancelled) setIsReading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [boardId, data]);

	const showSkeleton = !isVisible || isLoading || isReading || !preview;

	return (
		<div ref={containerRef}>
			{showSkeleton ? (
				<div className="flex h-48 items-center justify-center rounded-[22px] border border-border/70 bg-background">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			) : (
				<WhiteboardCardPreview
					boardId={boardId}
					elements={preview.elements}
					canvasBg={preview.canvasBg}
					emptyLabel={emptyLabel}
				/>
			)}
		</div>
	);
}
