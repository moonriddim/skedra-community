import { router } from "./init";
import { accountRouter } from "./routers/account";
import { aiRouter } from "./routers/ai";
import { apiKeyRouter } from "./routers/api-key";
import { assetsRouter } from "./routers/assets";
import { billingRouter } from "./routers/billing";
import { callsRouter } from "./routers/calls";
import { instanceRouter } from "./routers/instance";
import { integrationsRouter } from "./routers/integrations";
import { shapeLibraryRouter } from "./routers/shape-library";
import { teamRouter } from "./routers/team";
import { userE2eeRouter } from "./routers/user-e2ee";
import { userPreferencesRouter } from "./routers/user-preferences";
import { whiteboardRouter } from "./routers/whiteboard";

export { createContext } from "./context";

export const appRouter = router({
	account: accountRouter,
	whiteboard: whiteboardRouter,
	apiKey: apiKeyRouter,
	assets: assetsRouter,
	billing: billingRouter,
	calls: callsRouter,
	ai: aiRouter,
	integrations: integrationsRouter,
	team: teamRouter,
	instance: instanceRouter,
	userE2ee: userE2eeRouter,
	userPreferences: userPreferencesRouter,
	shapeLibrary: shapeLibraryRouter,
});

export type AppRouter = typeof appRouter;
