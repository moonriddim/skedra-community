import { type Database, whiteboardE2eeUpdates } from "@skedra/db";
import { and, asc, eq, gt, or, sql } from "drizzle-orm";

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

export interface CanvasUpdatePageInput {
	whiteboardId: string;
	afterId?: string;
	afterCreatedAt?: string;
	/** Maximale Zeilenzahl der Seite. */
	limit: number;
	/**
	 * Zeichenbudget für die gespeicherten Payloads einer Seite. Die erste Zeile
	 * wird immer geliefert, auch wenn sie allein größer ist; sonst käme der
	 * Client an dieser Stelle nie weiter.
	 */
	maxChars: number;
}

/**
 * Lädt eine Seite des Update-Logs, begrenzt nach Zeilen UND Größe.
 *
 * Ohne Größenbudget konnte eine Seite mit 500 Zeilen bei einem nicht
 * komprimierten Log viele MB groß werden. Über langsame Verbindungen oder
 * Proxys lief ihr Download dann in den Client-Timeout, und das Board lud nie.
 *
 * Ablauf: Zuerst werden nur IDs und Payload-Längen gelesen (billig), daraus
 * wird bestimmt, wie viele Zeilen ins Budget passen. Danach werden genau diese
 * Zeilen vollständig geladen. `hasMore` sagt dem Client, ob er weiterblättern
 * muss, bevor das Board als vollständig geladen gilt.
 */
export async function listCanvasUpdatePage(
	db: Database,
	input: CanvasUpdatePageInput,
) {
	const where = canvasUpdatesAfter(
		input.whiteboardId,
		input.afterId,
		input.afterCreatedAt,
	);
	const order = [
		asc(whiteboardE2eeUpdates.createdAt),
		asc(whiteboardE2eeUpdates.id),
	];

	// Eine Zeile mehr als nötig lesen, um `hasMore` ohne zweite Zählung zu kennen.
	const sizes = await db
		.select({
			length: sql<number>`length(${whiteboardE2eeUpdates.update})`.mapWith(
				Number,
			),
		})
		.from(whiteboardE2eeUpdates)
		.where(where)
		.orderBy(...order)
		.limit(input.limit + 1);

	let count = 0;
	let chars = 0;
	for (const { length } of sizes.slice(0, input.limit)) {
		if (count > 0 && chars + length > input.maxChars) break;
		chars += length;
		count++;
	}

	const updates =
		count === 0
			? []
			: await db.query.whiteboardE2eeUpdates.findMany({
					where,
					extras: {
						cursorCreatedAt:
							canvasUpdateCursorTimestamp.as("cursor_created_at"),
					},
					orderBy: order,
					limit: count,
					columns: {
						id: true,
						clientId: true,
						update: true,
						createdAt: true,
					},
				});

	return { updates, hasMore: sizes.length > count };
}
