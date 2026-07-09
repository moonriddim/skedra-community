import * as Y from "yjs";

/** Y.Map oder Plain-Object in ein normales Record umwandeln */
export function readElementCustomData(
	customData: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
	if (!customData || typeof customData !== "object") {
		return {};
	}
	if (customData instanceof Y.Map) {
		const record: Record<string, unknown> = {};
		customData.forEach((value, key) => {
			record[String(key)] =
				value instanceof Y.Map ? readElementCustomData(value as never) : value;
		});
		return record;
	}
	return { ...(customData as Record<string, unknown>) };
}

export function mergeElementCustomData(
	customData: Record<string, unknown> | undefined | null,
	patch: Record<string, unknown>,
): Record<string, unknown> {
	return {
		...readElementCustomData(customData),
		...patch,
	};
}
