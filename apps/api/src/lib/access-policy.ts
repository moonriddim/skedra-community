export const userAccessSubscriptionStatuses = new Set(["active", "trialing"]);

export function subscriptionGrantsProductAccess(status: string | null) {
	return Boolean(status && userAccessSubscriptionStatuses.has(status));
}

export function guestCanWriteCollabShare(
	deploymentMode: "selfhost" | "managed",
	accessLevel: "view" | "edit",
) {
	return deploymentMode === "selfhost" && accessLevel === "edit";
}
