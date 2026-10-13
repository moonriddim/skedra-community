export function guestCanWriteCollabShare(
	_deploymentMode: "selfhost",
	accessLevel: "view" | "edit",
) {
	return accessLevel === "edit";
}
