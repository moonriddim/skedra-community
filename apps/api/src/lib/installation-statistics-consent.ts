import {
	type Database,
	installationStatisticsConsent,
	instanceSettings,
} from "@skedra/db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

async function isStatisticsAdmin(db: Database, userId: string) {
	const [instance] = await db
		.select({ adminUserId: instanceSettings.adminUserId })
		.from(instanceSettings)
		.where(eq(instanceSettings.id, "default"));
	// A missing admin is not permission for arbitrary signed-in members.
	return instance?.adminUserId === userId;
}

export async function getInstallationStatisticsStatus(
	db: Database,
	userId: string,
	mode: "managed" | "selfhost",
) {
	if (mode !== "selfhost")
		return { viewerId: userId, available: false, isAdmin: false, choice: null };
	if (!(await isStatisticsAdmin(db, userId)))
		return { viewerId: userId, available: true, isAdmin: false, choice: null };
	const [consent] = await db
		.select({ enabled: installationStatisticsConsent.enabled })
		.from(installationStatisticsConsent)
		.where(eq(installationStatisticsConsent.id, "default"));
	return {
		viewerId: userId,
		available: true,
		isAdmin: true,
		choice: consent?.enabled ?? null,
	};
}

export async function saveInstallationStatisticsChoice(
	db: Database,
	userId: string,
	mode: "managed" | "selfhost",
	enabled: boolean,
	initialSetup: boolean,
) {
	if (mode !== "selfhost" || !(await isStatisticsAdmin(db, userId))) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Nur der Instanz-Admin kann die Installationsstatistik ändern.",
		});
	}
	const insert = db
		.insert(installationStatisticsConsent)
		.values({ id: "default", enabled, decidedAt: new Date() });
	if (initialSetup) {
		// A stale setup tab must not override a decision saved in another tab.
		await insert.onConflictDoNothing();
	} else {
		await insert.onConflictDoUpdate({
			target: installationStatisticsConsent.id,
			set: { enabled, decidedAt: new Date() },
		});
	}
	return getInstallationStatisticsStatus(db, userId, mode);
}
