import {
	type Database,
	complimentaryAccessGrants,
	userSubscriptions,
} from "@skedra/db";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { env } from "../env";
import { subscriptionGrantsProductAccess } from "./access-policy";

export async function getUserSubscriptionEntitlement(
	db: Database,
	userId: string,
) {
	const now = new Date();
	const [subscription, complimentaryAccess] = await Promise.all([
		db.query.userSubscriptions.findFirst({
			where: eq(userSubscriptions.userId, userId),
		}),
		db.query.complimentaryAccessGrants.findFirst({
			where: and(
				eq(complimentaryAccessGrants.userId, userId),
				isNull(complimentaryAccessGrants.revokedAt),
				or(
					isNull(complimentaryAccessGrants.expiresAt),
					gt(complimentaryAccessGrants.expiresAt, now),
				),
			),
			orderBy: desc(complimentaryAccessGrants.createdAt),
		}),
	]);
	const subscriptionActive = subscriptionGrantsProductAccess(
		subscription?.status ?? null,
	);

	return {
		subscription: subscription ?? null,
		complimentaryAccess: complimentaryAccess ?? null,
		accessSource: subscriptionActive
			? ("subscription" as const)
			: complimentaryAccess
				? ("complimentary" as const)
				: ("none" as const),
		accessGranted: subscriptionActive || Boolean(complimentaryAccess),
	};
}

export async function userHasProductAccess(db: Database, userId: string) {
	if (env.SKEDRA_DEPLOYMENT_MODE !== "managed") return true;
	return (await getUserSubscriptionEntitlement(db, userId)).accessGranted;
}
