export const userAccessSubscriptionStatuses = new Set(["active", "trialing"]);

export function subscriptionGrantsProductAccess(status: string | null) {
	return Boolean(status && userAccessSubscriptionStatuses.has(status));
}

export function complimentaryGrantIsActive(input: {
	revokedAt?: Date | null;
	expiresAt?: Date | null;
	now?: Date;
}) {
	if (input.revokedAt) return false;
	return !input.expiresAt || input.expiresAt > (input.now ?? new Date());
}

export function guestCanWriteCollabShare(
	deploymentMode: "selfhost" | "managed",
	accessLevel: "view" | "edit",
) {
	return deploymentMode === "selfhost" && accessLevel === "edit";
}
