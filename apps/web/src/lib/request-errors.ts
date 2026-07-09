type TranslateFn = (
	key: string,
	params?: Record<string, string | number | boolean | undefined>,
) => string;

function readRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: null;
}

function readString(value: unknown, key: string) {
	return typeof value === "object" &&
		value &&
		typeof (value as Record<string, unknown>)[key] === "string"
		? ((value as Record<string, unknown>)[key] as string)
		: undefined;
}

function readNumber(value: unknown, key: string) {
	return typeof value === "object" &&
		value &&
		typeof (value as Record<string, unknown>)[key] === "number"
		? ((value as Record<string, unknown>)[key] as number)
		: undefined;
}

function readNestedError(value: unknown) {
	const record = readRecord(value);
	return record ? readRecord(record.error) : null;
}

export class HttpRequestError extends Error {
	code?: string;
	status: number;

	constructor(options: { message: string; code?: string; status: number }) {
		super(options.message);
		this.name = "HttpRequestError";
		this.code = options.code;
		this.status = options.status;
	}
}

export function createHttpRequestError(
	status: number,
	payload: unknown,
	fallbackMessage = "Request failed",
) {
	const record = readRecord(payload);
	const message =
		readString(record, "message") ??
		readString(record, "error") ??
		fallbackMessage;
	const code = readString(record, "code");

	return new HttpRequestError({ message, code, status });
}

function getRequestErrorCode(error: unknown) {
	return (
		readString(error, "code") ?? readString(readNestedError(error), "code")
	);
}

function getRequestErrorStatus(error: unknown) {
	return (
		readNumber(error, "status") ?? readNumber(readNestedError(error), "status")
	);
}

const statusFallbackKeys: Record<number, string> = {
	400: "apiErrors.common.badRequest",
	401: "apiErrors.auth.unauthorized",
	403: "apiErrors.common.forbidden",
	404: "apiErrors.common.notFound",
	500: "apiErrors.common.internalServerError",
};

export function getRequestErrorMessage(options: {
	error: unknown;
	t: TranslateFn;
	fallbackKey: string;
	namespace?: string;
	overrides?: Record<string, string>;
}) {
	const { error, t, fallbackKey, namespace, overrides } = options;
	const code = getRequestErrorCode(error);

	if (code) {
		const key =
			overrides?.[code] ?? (namespace ? `${namespace}.${code}` : undefined);
		if (key) {
			const translated = t(key);
			if (translated !== key) {
				return translated;
			}
		}
	}

	const status = getRequestErrorStatus(error);
	if (status && statusFallbackKeys[status]) {
		return t(statusFallbackKeys[status]);
	}

	if (!code && !status && error instanceof Error && error.message) {
		return error.message;
	}

	return t(fallbackKey);
}
