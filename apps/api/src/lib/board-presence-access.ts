import { type Database, sessions } from "@skedra/db";
import { and, eq, gt } from "drizzle-orm";
import { userHasProductAccess } from "./billing-entitlement";
import { getBoardAccess } from "./permissions";

/** Query durable state, not the authentication cookie cache. */
export async function hasBoardPresenceAccess(
	db: Database,
	user: { id: string; name: string; email: string; image?: string | null },
	sessionId: string,
	boardId: string,
) {
	const session = await db.query.sessions.findFirst({
		where: and(
			eq(sessions.id, sessionId),
			eq(sessions.userId, user.id),
			gt(sessions.expiresAt, new Date()),
		),
		columns: { id: true },
	});
	if (!session || !(await userHasProductAccess(db, user.id))) return false;
	try {
		await getBoardAccess({ db, user }, boardId);
		return true;
	} catch {
		return false;
	}
}
