import { auth } from "../lib/auth";
import { db } from "../lib/db";

export async function createContext({ req }: { req: Request }) {
	const sessionData = await auth.api.getSession({
		headers: req.headers,
	});

	return {
		db,
		user: sessionData?.user ?? null,
		session: sessionData?.session ?? null,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
