import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { whiteboardE2eeUpdates } from "@skedra/db";
import { and, asc, eq, lt, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import {
	canvasUpdateCursorTimestamp,
	canvasUpdateTimestamp,
	canvasUpdatesAfter,
} from "./canvas-update-cursor";

test("PostgreSQL cursors preserve microseconds across paging and compaction", async (t) => {
	const pg = new PGlite();
	t.after(() => pg.close());
	await pg.exec(`create table whiteboard_e2ee_updates (
		id uuid primary key, whiteboard_id uuid not null, client_id text not null,
		user_id text, "update" text not null, created_at timestamp not null
	)`);
	const db = drizzle(pg, { schema: { whiteboardE2eeUpdates } });
	const board = "00000000-0000-4000-8000-000000000001";
	const ids = [1, 2, 3, 4].map(
		(id) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
	);
	const times = ["123456", "123456", "123789", "124001"].map(
		(value) => `2026-09-19T12:00:00.${value}Z`,
	);
	for (let i = 0; i < ids.length; i++) {
		await db.insert(whiteboardE2eeUpdates).values({
			id: ids[i],
			whiteboardId: board,
			clientId: "test",
			update: "payload",
			createdAt: canvasUpdateTimestamp(times[i]),
		});
	}
	const list = (afterId?: string, afterCreatedAt?: string, limit = 1) =>
		db.query.whiteboardE2eeUpdates.findMany({
			where: canvasUpdatesAfter(board, afterId, afterCreatedAt),
			extras: {
				cursorCreatedAt: canvasUpdateCursorTimestamp.as("cursor_created_at"),
			},
			orderBy: [
				asc(whiteboardE2eeUpdates.createdAt),
				asc(whiteboardE2eeUpdates.id),
			],
			limit,
		});
	const seen: string[] = [];
	let cursor: { id: string; cursorCreatedAt: string } | undefined;
	for (let page = 0; page < 5; page++) {
		const rows = await list(cursor?.id, cursor?.cursorCreatedAt);
		if (!rows.length) break;
		cursor = rows[0];
		seen.push(cursor.id);
		assert.equal(cursor.cursorCreatedAt, times[seen.length - 1]);
	}
	assert.deepEqual(
		seen,
		ids,
		"paging must neither repeat nor skip rows within one millisecond",
	);
	assert.equal(
		(await list(ids[1], "2026-09-19T12:00:00.123Z"))[0].id,
		ids[2],
		"legacy millisecond cursors resolve their exact row in SQL",
	);

	const [cutoff] = await db
		.select({ createdAt: canvasUpdateCursorTimestamp })
		.from(whiteboardE2eeUpdates)
		.where(eq(whiteboardE2eeUpdates.id, ids[1]));
	await db
		.delete(whiteboardE2eeUpdates)
		.where(
			and(
				eq(whiteboardE2eeUpdates.whiteboardId, board),
				or(
					lt(
						whiteboardE2eeUpdates.createdAt,
						canvasUpdateTimestamp(cutoff.createdAt),
					),
					and(
						eq(
							whiteboardE2eeUpdates.createdAt,
							canvasUpdateTimestamp(cutoff.createdAt),
						),
						lte(whiteboardE2eeUpdates.id, ids[1]),
					),
				),
			),
		);
	assert.deepEqual(
		(await list(undefined, undefined, 10)).map((row) => row.id),
		ids.slice(2),
		"compaction removes its cutoff row but retains later updates",
	);
	assert.equal(
		(await list(ids[1], times[1]))[0].id,
		ids[2],
		"a deleted cursor still uses its exact timestamp",
	);
	await db.insert(whiteboardE2eeUpdates).values({
		id: "00000000-0000-4000-8000-000000000099",
		whiteboardId: "00000000-0000-4000-8000-000000000002",
		clientId: "test",
		update: "other board",
		createdAt: sql`now()`,
	});
	assert.equal(
		(await list(undefined, undefined, 10)).length,
		2,
		"cursor queries remain scoped to the requested board",
	);
});
