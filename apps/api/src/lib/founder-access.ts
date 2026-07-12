export function hasFounderAccess(input: {
	deploymentMode: "selfhost" | "managed";
	founderEmail?: string | null;
	accountEmail?: string | null;
}) {
	if (input.deploymentMode !== "managed") return false;
	const founderEmail = input.founderEmail?.trim().toLowerCase();
	const accountEmail = input.accountEmail?.trim().toLowerCase();
	return !!founderEmail && !!accountEmail && accountEmail === founderEmail;
}
