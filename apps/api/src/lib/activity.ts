/**
 * Activity-Logging fuer Board-Aenderungen (Activity Feed).
 */

import {
	type Database,
	whiteboardActivities,
	whiteboardMembers,
	whiteboards,
} from "@skedra/db";
import type {
	WhiteboardActivityMetadata,
	WhiteboardActivityType,
} from "@skedra/shared";
import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

/** Schreibt einen Activity-Eintrag in die Datenbank. */
export async function logWhiteboardActivity(
	db: Database,
	input: {
		whiteboardId: string;
		userId: string;
		type: WhiteboardActivityType;
		metadata?: WhiteboardActivityMetadata;
	},
) {
	await db.insert(whiteboardActivities).values({
		whiteboardId: input.whiteboardId,
		userId: input.userId,
		type: input.type,
		metadata: input.metadata ? JSON.stringify(input.metadata) : null,
	});
}

/** Board-IDs, deren Aktivitaeten der User sehen darf. */
async function findBoardIdsForActivityFeed(db: Database, userId: string) {
	const owned = await db
		.select({ id: whiteboards.id })
		.from(whiteboards)
		.where(eq(whiteboards.ownerId, userId));

	const memberEntries = await db.query.whiteboardMembers.findMany({
		where: eq(whiteboardMembers.userId, userId),
		with: {
			whiteboard: {
				columns: { id: true, archivedAt: true },
			},
		},
	});

	const ids = new Set<string>();
	for (const board of owned) ids.add(board.id);
	for (const entry of memberEntries) {
		if (entry.whiteboard && !entry.whiteboard.archivedAt) {
			ids.add(entry.whiteboard.id);
		}
	}

	return [...ids];
}

export async function listRecentActivities(
	db: Database,
	userId: string,
	limit = 30,
) {
	const boardIds = await findBoardIdsForActivityFeed(db, userId);

	const orphanClause = and(
		isNull(whiteboardActivities.whiteboardId),
		eq(whiteboardActivities.userId, userId),
	);

	const whereClause =
		boardIds.length > 0
			? or(inArray(whiteboardActivities.whiteboardId, boardIds), orphanClause)
			: orphanClause;

	const rows = await db.query.whiteboardActivities.findMany({
		where: whereClause,
		orderBy: desc(whiteboardActivities.createdAt),
		limit,
		with: {
			user: { columns: { id: true, name: true, image: true } },
			whiteboard: { columns: { id: true, name: true, archivedAt: true } },
		},
	});

	return rows.map((row) => ({
		id: row.id,
		type: row.type,
		createdAt: row.createdAt,
		metadata: parseActivityMetadata(row.metadata),
		user: row.user,
		whiteboard: row.whiteboard
			? row.whiteboard
			: {
					id: "",
					name: parseActivityMetadata(row.metadata)?.name ?? "Board",
					archivedAt: null,
				},
	}));
}

export async function listBoardActivities(
	db: Database,
	whiteboardId: string,
	limit = 50,
) {
	const rows = await db.query.whiteboardActivities.findMany({
		where: eq(whiteboardActivities.whiteboardId, whiteboardId),
		orderBy: desc(whiteboardActivities.createdAt),
		limit,
		with: {
			user: { columns: { id: true, name: true, image: true } },
		},
	});

	return rows.map((row) => ({
		id: row.id,
		type: row.type,
		createdAt: row.createdAt,
		metadata: parseActivityMetadata(row.metadata),
		user: row.user,
	}));
}

function parseActivityMetadata(
	raw: string | null,
): WhiteboardActivityMetadata | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as WhiteboardActivityMetadata;
	} catch {
		return null;
	}
}

/** Archivierte Boards des Owners (Papierkorb). */
export async function findArchivedBoardsForUser(db: Database, userId: string) {
	return db.query.whiteboards.findMany({
		where: and(
			eq(whiteboards.ownerId, userId),
			isNotNull(whiteboards.archivedAt),
		),
		columns: {
			id: true,
			name: true,
			ownerId: true,
			presentationShareEnabled: true,
			archivedAt: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy: desc(whiteboards.archivedAt),
	});
}

/** Prueft ob ein Board archiviert ist. */
export function isBoardArchived(whiteboard: { archivedAt: Date | null }) {
	return whiteboard.archivedAt !== null;
}
