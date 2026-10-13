export function safeSignupRedirect(
	value: string | null,
	fallback = "/library",
) {
	return value?.startsWith("/") &&
		!value.startsWith("//") &&
		!value.includes("\\")
		? value
		: fallback;
}

export function buildEmailSignupPayload(input: {
	name: string;
	email: string;
	password: string;
	inviteToken?: string;
	callbackURL: string;
}) {
	return {
		name: input.name,
		email: input.email,
		password: input.password,
		inviteToken: input.inviteToken,
		callbackURL: input.callbackURL,
	};
}
