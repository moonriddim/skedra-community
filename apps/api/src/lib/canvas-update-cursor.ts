import { whiteboardE2eeUpdates } from "@skedra/db";
import { and, eq, gt, or, sql } from "drizzle-orm";

// JS Date loses PostgreSQL's microseconds. Keep cursor values as SQL/string
// until the comparison, while retaining createdAt's existing wire format.
export const canvasUpdateCursorTimestamp = sql<string>`to_char(${whiteboardE2eeUpdates.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

export function canvasUpdateTimestamp(value: string) {
	return sql`${value}::timestamp`;
}

export function canvasUpdatesAfter(
	whiteboardId: string,
	afterId?: string,
	afterCreatedAt?: string,
) {
	const board = eq(whiteboardE2eeUpdates.whiteboardId, whiteboardId);
	if (!afterId || !afterCreatedAt) return board;
	// Resolve existing cursor rows in SQL, also supporting older clients that
	// send millisecond dates. The exact wire cursor survives deleted/compacted rows.
	const timestamp = sql`coalesce((select created_at from ${whiteboardE2eeUpdates} where whiteboard_id = ${whiteboardId} and id = ${afterId}), ${canvasUpdateTimestamp(afterCreatedAt)})`;
	return and(
		board,
		or(
			gt(whiteboardE2eeUpdates.createdAt, timestamp),
			and(
				eq(whiteboardE2eeUpdates.createdAt, timestamp),
				gt(whiteboardE2eeUpdates.id, afterId),
			),
		),
	);
}
