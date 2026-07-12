import { Presentation } from "lucide-react";

interface WhiteboardCardPreviewProps {
	emptyLabel: string;
}

export function WhiteboardCardPreview({
	emptyLabel,
}: WhiteboardCardPreviewProps) {
	return (
		<div className="relative overflow-hidden rounded-[22px] border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.16),transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.72))]">
			<div className="flex h-48 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
				<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background/70 shadow-sm">
					<Presentation className="h-5 w-5" />
				</div>
				<p className="text-sm font-medium">{emptyLabel}</p>
			</div>
		</div>
	);
}
