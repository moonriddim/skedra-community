import { initTRPC } from "@trpc/server";
import { env } from "../env";
import {
	appErrorCodes,
	createAppError,
	getAppErrorCode,
} from "../lib/app-errors";
import { userHasProductAccess } from "../lib/billing-entitlement";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				appErrorCode: getAppErrorCode(error),
			},
		};
	},
});

export const router = t.router;
export const publicProcedure = t.procedure;

const subscriptionGateAllowlist = ["billing.", "userE2ee."];

export const protectedProcedure = t.procedure.use(
	async ({ ctx, next, path }) => {
		if (!ctx.user || !ctx.session) {
			throw createAppError({
				code: "UNAUTHORIZED",
				appErrorCode: appErrorCodes.unauthorized,
				message: "Nicht authentifiziert",
			});
		}

		if (
			env.SKEDRA_DEPLOYMENT_MODE === "managed" &&
			!subscriptionGateAllowlist.some((prefix) => path.startsWith(prefix))
		) {
			if (!(await userHasProductAccess(ctx.db, ctx.user.id))) {
				throw createAppError({
					code: "FORBIDDEN",
					appErrorCode: appErrorCodes.subscriptionRequired,
					message: "Ein aktives Skedra-Cloud-Abo ist erforderlich.",
				});
			}
		}

		return next({
			ctx: {
				...ctx,
				user: ctx.user,
				session: ctx.session,
			},
		});
	},
);
