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
								required: ["name"],
								properties: { name: { type: "string", maxLength: 120 } },
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
		"/boards/{id}/elements": {
			get: { summary: "Canvas-Elemente lesen", tags: ["Elements"] },
			post: {
				summary: "Canvas-Elemente hinzufuegen",
				tags: ["Elements"],
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["elements"],
								properties: {
									elements: {
										type: "array",
										items: {
											type: "object",
											required: ["type", "x", "y", "width", "height"],
											properties: {
												type: { type: "string" },
												x: { type: "number" },
												y: { type: "number" },
												width: { type: "number" },
												height: { type: "number" },
												text: { type: "string" },
												fill: { type: "string" },
												stroke: { type: "string" },
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		"/boards/{id}/elements/{elementId}": {
			patch: {
				summary: "Canvas-Element aktualisieren",
				tags: ["Elements"],
				description: "Erfordert Scope boards:write",
			},
			delete: {
				summary: "Canvas-Element loeschen",
				tags: ["Elements"],
				description: "Erfordert Scope boards:write",
			},
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
								required: ["email"],
								properties: { email: { type: "string", format: "email" } },
							},
						},
					},
				},
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
