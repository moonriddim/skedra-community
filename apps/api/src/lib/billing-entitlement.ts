import { type Database, userSubscriptions } from "@skedra/db";
import { eq } from "drizzle-orm";
import { env } from "../env";
import { subscriptionGrantsProductAccess } from "./access-policy";

export async function getUserSubscriptionEntitlement(
	db: Database,
	userId: string,
) {
	const subscription = await db.query.userSubscriptions.findFirst({
		where: eq(userSubscriptions.userId, userId),
	});

	return {
		subscription: subscription ?? null,
		accessGranted: subscriptionGrantsProductAccess(
			subscription?.status ?? null,
		),
	};
}

export async function userHasProductAccess(db: Database, userId: string) {
	if (env.SKEDRA_DEPLOYMENT_MODE !== "managed") return true;
	return (await getUserSubscriptionEntitlement(db, userId)).accessGranted;
}
