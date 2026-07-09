import { z } from "zod";
import { appErrorCodes, getAppErrorCode } from "../lib/app-errors";

type JsonResponder = {
	json: (body: unknown, status: number) => Response;
};

/** Zentrale Fehlerbehandlung fuer REST v1 Board-Routen. */
export function handleRestRouteError(c: JsonResponder, error: unknown) {
	const appCode = getAppErrorCode(error);
	if (
		appCode === appErrorCodes.whiteboardNotFound ||
		appCode === appErrorCodes.whiteboardArchived
	) {
		return c.json({ error: "Board nicht gefunden" }, 404);
	}
	if (appCode === appErrorCodes.whiteboardAccessDenied) {
		return c.json({ error: "Kein Zugriff auf dieses Board" }, 403);
	}
	if (appCode === appErrorCodes.unauthorized) {
		return c.json({ error: "Nicht authentifiziert" }, 401);
	}
	return c.json(
		{ error: error instanceof Error ? error.message : "Interner Fehler" },
		500,
	);
}

/** Zod-Validierung oder generischer REST-Fehler. */
export function handleRestRouteErrorWithZod(c: JsonResponder, error: unknown) {
	if (error instanceof z.ZodError) {
		return c.json(
			{ error: "Ungueltige Anfrage", details: error.flatten() },
			400,
		);
	}
	return handleRestRouteError(c, error);
}
