/**
 * Passwort-Reset über Better-Auth HTTP-API (Self-Hosting / eigener SMTP).
 */

async function postAuth(path: string, body: Record<string, unknown>) {
	const response = await fetch(`/api/auth${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		credentials: "include",
	});

	let payload: { message?: string; error?: { message?: string } } | null = null;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}

	if (!response.ok) {
		const message =
			payload?.error?.message ?? payload?.message ?? "Anfrage fehlgeschlagen";
		return { error: { message } };
	}

	return { error: null as null };
}

/** Fordert einen Passwort-Reset per E-Mail an. */
export async function requestPasswordReset(email: string) {
	const redirectTo = `${window.location.origin}/reset-password`;
	return postAuth("/request-password-reset", { email, redirectTo });
}

/** Setzt ein neues Passwort mit Token aus der Reset-E-Mail. */
export async function resetPasswordWithToken(
	token: string,
	newPassword: string,
) {
	return postAuth("/reset-password", { token, newPassword });
}
