type TranslateFn = (
	key: string,
	params?: Record<string, string | number | boolean | undefined>,
) => string;

const genericTrpcErrorKeys: Record<string, string> = {
	BAD_REQUEST: "apiErrors.common.badRequest",
	UNAUTHORIZED: "apiErrors.auth.unauthorized",
	FORBIDDEN: "apiErrors.common.forbidden",
	NOT_FOUND: "apiErrors.common.notFound",
	INTERNAL_SERVER_ERROR: "apiErrors.common.internalServerError",
};

function readErrorData(error: unknown) {
	if (!error || typeof error !== "object" || !("data" in error)) {
		return null;
	}

	const { data } = error;
	return data && typeof data === "object" ? data : null;
}

function getTrpcAppErrorCode(error: unknown) {
	const data = readErrorData(error);
	const appErrorCode =
		data && "appErrorCode" in data ? data.appErrorCode : undefined;

	return typeof appErrorCode === "string" ? appErrorCode : undefined;
}

export function getTrpcErrorMessage(options: {
	error: unknown;
	t: TranslateFn;
	fallbackKey: string;
	overrides?: Record<string, string>;
}) {
	const { error, t, fallbackKey, overrides } = options;
	const appErrorCode = getTrpcAppErrorCode(error);

	if (appErrorCode) {
		const key = overrides?.[appErrorCode] ?? `apiErrors.${appErrorCode}`;
		return t(key);
	}

	const data = readErrorData(error);
	const trpcCode = data && "code" in data ? data.code : undefined;
	if (typeof trpcCode === "string" && genericTrpcErrorKeys[trpcCode]) {
		return t(genericTrpcErrorKeys[trpcCode]);
	}

	return t(fallbackKey);
}
