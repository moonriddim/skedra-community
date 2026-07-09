import { router } from "./init";
import { aiRouter } from "./routers/ai";
import { apiKeyRouter } from "./routers/api-key";
import { callsRouter } from "./routers/calls";
import { instanceRouter } from "./routers/instance";
import { integrationsRouter } from "./routers/integrations";
import { shapeLibraryRouter } from "./routers/shape-library";
import { teamRouter } from "./routers/team";
import { userPreferencesRouter } from "./routers/user-preferences";
import { whiteboardRouter } from "./routers/whiteboard";

export { createContext } from "./context";

export const appRouter = router({
	whiteboard: whiteboardRouter,
	apiKey: apiKeyRouter,
	calls: callsRouter,
	ai: aiRouter,
	integrations: integrationsRouter,
	team: teamRouter,
	instance: instanceRouter,
	userPreferences: userPreferencesRouter,
	shapeLibrary: shapeLibraryRouter,
});

export type AppRouter = typeof appRouter;
