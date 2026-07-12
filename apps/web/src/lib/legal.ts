export const legalIdentity = {
	operator: "Simon Hediger (Skedra)",
	address: "Hohlenweg 41, 5072 Oeschgen, Schweiz",
	email: "support@skedra.xyz",
	uid: "Kein Handelsregistereintrag vorhanden.",
};

export const legalDraft = Object.values(legalIdentity).some((value) =>
	value.startsWith("["),
);

export const legalLastUpdated = "12. Juli 2026";
