/**
 * OpenAPI 3.1 Spec fuer die Skedra Public REST API.
 */

export const openApiDocument = {
	openapi: "3.1.0",
	info: {
		title: "Skedra Public API",
		version: "1.0.0",
		description:
			"REST API fuer Skedra Whiteboards. Authentifizierung via Bearer API Key (sked_…). Keys erben die Berechtigungen des erstellenden Users.",
	},
	servers: [{ url: "/api/v1", description: "Skedra API v1" }],
	security: [{ bearerAuth: [] }],
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				description: "API Key im Format sked_… (in den Einstellungen erstellt)",
			},
		},
		schemas: {
			Board: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					name: { type: "string" },
					encryptionMode: { type: "string", enum: ["server", "e2ee"] },
					ownerId: { type: "string" },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
					archivedAt: { type: "string", format: "date-time", nullable: true },
				},
			},
		},
	},
	paths: {
		"/me": {
			get: {
				summary: "Aktuellen API-User abfragen",
				tags: ["Auth"],
				responses: { "200": { description: "User-Profil" } },
			},
		},
		"/boards": {
			get: { summary: "Alle Boards auflisten", tags: ["Boards"] },
			post: {
				summary: "Neues Board erstellen",
				tags: ["Boards"],
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["name", "encryptionMode"],
								properties: {
									name: { type: "string", maxLength: 120 },
									encryptionMode: {
										type: "string",
										enum: ["server", "e2ee"],
										description:
											"server = serverseitige Verschlüsselung auf der Skedra-Instanz; e2ee = clientseitige Ende-zu-Ende-Verschlüsselung.",
									},
									e2eeKeyHash: {
										type: "string",
										pattern: "^[a-f0-9]{64}$",
										description:
											"Nur für encryptionMode=e2ee: SHA-256-Verifier für den clientseitigen Board-Key.",
									},
								},
							},
						},
					},
				},
			},
		},
		"/boards/archived": {
			get: { summary: "Archivierte Boards (Papierkorb)", tags: ["Boards"] },
		},
		"/boards/{id}": {
			get: { summary: "Board abrufen", tags: ["Boards"] },
			patch: {
				summary: "Board umbenennen",
				tags: ["Boards"],
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["name"],
								properties: { name: { type: "string" } },
							},
						},
					},
				},
			},
			delete: {
				summary: "Board endgueltig loeschen (nur aus Papierkorb)",
				tags: ["Boards"],
				description:
					"Erfordert Scope boards:delete. Board muss archiviert sein.",
			},
		},
		"/boards/{id}/archive": {
			post: { summary: "Board archivieren", tags: ["Boards"] },
		},
		"/boards/{id}/restore": {
			post: { summary: "Board wiederherstellen", tags: ["Boards"] },
		},
		"/boards/{id}/members": {
			get: { summary: "Mitglieder auflisten", tags: ["Members"] },
			post: {
				summary: "Mitglied per E-Mail einladen",
				tags: ["Members"],
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["email", "roleId"],
								properties: {
									email: { type: "string", format: "email" },
									roleId: { type: "string", format: "uuid" },
								},
							},
						},
					},
				},
			},
		},
		"/boards/{id}/team-roles": {
			get: {
				summary: "Team-Rollen fuer Board-Einladungen auflisten",
				tags: ["Members"],
			},
		},
		"/boards/{id}/activity": {
			get: { summary: "Board-Aktivitaeten", tags: ["Activity"] },
		},
		"/activity": {
			get: { summary: "Letzte Aktivitaeten (alle Boards)", tags: ["Activity"] },
		},
	},
} as const;
