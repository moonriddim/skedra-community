import { TRPCError } from "@trpc/server";

export const appErrorCodes = {
	unauthorized: "UNAUTHORIZED",
	whiteboardNotFound: "WHITEBOARD_NOT_FOUND",
	whiteboardAccessDenied: "WHITEBOARD_ACCESS_DENIED",
	whiteboardArchived: "WHITEBOARD_ARCHIVED",
	presentationShareUnavailable: "PRESENTATION_SHARE_NOT_FOUND",
	presentationShareInactive: "PRESENTATION_SHARE_INACTIVE",
	callsUnavailable: "CALLS_UNAVAILABLE",
} as const;

type AppErrorCode = (typeof appErrorCodes)[keyof typeof appErrorCodes];

export function createAppError(input: {
	code: "UNAUTHORIZED" | "NOT_FOUND" | "FORBIDDEN" | "BAD_REQUEST";
	appErrorCode: AppErrorCode;
	message: string;
}) {
	return new TRPCError({
		code: input.code,
		message: input.message,
		cause: { appErrorCode: input.appErrorCode },
	});
}

export function getAppErrorCode(error: unknown): AppErrorCode | undefined {
	if (
		error instanceof TRPCError &&
		error.cause &&
		typeof error.cause === "object" &&
		"appErrorCode" in error.cause
	) {
		return error.cause.appErrorCode as AppErrorCode;
	}
	return undefined;
}
