/**
 * Rendert Board-Karten ohne serverseitige Canvas-Preview.
 */

import { WhiteboardCardPreview } from "./board-card-preview";

interface LazyBoardCardPreviewProps {
	boardId: string;
	emptyLabel: string;
}

export function LazyBoardCardPreview({
	boardId: _boardId,
	emptyLabel,
}: LazyBoardCardPreviewProps) {
	return (
		<div>
			<WhiteboardCardPreview emptyLabel={emptyLabel} />
		</div>
	);
}
