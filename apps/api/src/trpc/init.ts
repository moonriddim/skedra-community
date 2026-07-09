import { initTRPC } from "@trpc/server";
import {
	appErrorCodes,
	createAppError,
	getAppErrorCode,
} from "../lib/app-errors";
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

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.user || !ctx.session) {
		throw createAppError({
			code: "UNAUTHORIZED",
			appErrorCode: appErrorCodes.unauthorized,
			message: "Nicht authentifiziert",
		});
	}

	return next({
		ctx: {
			...ctx,
			user: ctx.user,
			session: ctx.session,
		},
	});
});
