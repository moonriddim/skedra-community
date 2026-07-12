import {
	type AssetAccessTokens,
	getLocalEncryptedAssetPreview,
	parseEncryptedAssetReference,
	withAssetAccessParams,
} from "@/lib/canvas/asset-urls";
import { type CanvasElement, decryptImageAsset } from "@skedra/canvas-core";
import { useEffect, useMemo, useRef, useState } from "react";

const TRANSPARENT_PIXEL =
	"data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

function collectEncryptedAssetSources(elements: Map<string, CanvasElement>) {
	const sources = new Set<string>();
	const seen = new WeakSet<object>();
	const visit = (value: unknown) => {
		if (typeof value === "string") {
			if (parseEncryptedAssetReference(value)) sources.add(value);
			return;
		}
		if (!value || typeof value !== "object" || seen.has(value)) return;
		seen.add(value);
		if (Array.isArray(value)) {
			for (const item of value) visit(item);
			return;
		}
		for (const item of Object.values(value)) visit(item);
	};
	for (const element of elements.values()) visit(element);
	return [...sources].sort();
}

export function useEncryptedAssetUrls(input: {
	elements: Map<string, CanvasElement>;
	whiteboardId?: string;
	e2eeKey?: string | null;
	tokens?: AssetAccessTokens;
}) {
	const { elements, whiteboardId, e2eeKey, tokens } = input;
	const collectedSources = useMemo(
		() => collectEncryptedAssetSources(elements),
		[elements],
	);
	const sourcesKey = collectedSources.join("\n");
	const sources = useMemo(
		() => (sourcesKey ? sourcesKey.split("\n") : []),
		[sourcesKey],
	);
	const objectUrlsRef = useRef(new Map<string, string>());
	const loadingRef = useRef(new Map<string, symbol>());
	const failedRef = useRef(new Set<string>());
	const [revision, setRevision] = useState(0);
	const assetScope = `${whiteboardId ?? ""}:${e2eeKey ?? ""}`;

	useEffect(() => {
		void assetScope;
		const objectUrls = objectUrlsRef.current;
		const loading = loadingRef.current;
		const failed = failedRef.current;
		for (const objectUrl of objectUrls.values()) URL.revokeObjectURL(objectUrl);
		objectUrls.clear();
		loading.clear();
		failed.clear();
		setRevision((value) => value + 1);
		return () => {
			for (const objectUrl of objectUrls.values()) {
				URL.revokeObjectURL(objectUrl);
			}
			objectUrls.clear();
			loading.clear();
			failed.clear();
		};
	}, [assetScope]);

	useEffect(() => {
		if (!whiteboardId) return;
		let cancelled = false;
		const activeRequests = new Map<
			string,
			{ id: symbol; abort: AbortController }
		>();
		const desired = new Set(sources);

		for (const [source, objectUrl] of objectUrlsRef.current) {
			if (desired.has(source)) continue;
			URL.revokeObjectURL(objectUrl);
			objectUrlsRef.current.delete(source);
			failedRef.current.delete(source);
		}

		for (const source of sources) {
			if (
				objectUrlsRef.current.has(source) ||
				loadingRef.current.has(source) ||
				failedRef.current.has(source)
			) {
				continue;
			}
			const parsed = parseEncryptedAssetReference(source);
			if (!parsed) continue;
			if (!e2eeKey && !parsed.reference.key) continue;
			if (getLocalEncryptedAssetPreview(source)) continue;
			const requestId = Symbol(source);
			const abort = new AbortController();
			loadingRef.current.set(source, requestId);
			activeRequests.set(source, { id: requestId, abort });
			const requestUrl = withAssetAccessParams(parsed.url, tokens);
			void fetch(requestUrl, {
				credentials: "include",
				signal: abort.signal,
			})
				.then(async (response) => {
					if (!response.ok)
						throw new Error(`Asset request failed: ${response.status}`);
					const plaintext = await decryptImageAsset({
						ciphertext: await response.arrayBuffer(),
						boardKey: e2eeKey,
						whiteboardId,
						reference: parsed.reference,
					});
					if (cancelled) return;
					const objectUrl = URL.createObjectURL(
						new Blob([plaintext], { type: parsed.reference.mimeType }),
					);
					objectUrlsRef.current.set(source, objectUrl);
					setRevision((value) => value + 1);
				})
				.catch((error) => {
					if (cancelled || abort.signal.aborted) return;
					failedRef.current.add(source);
					console.error("Encrypted asset could not be loaded", error);
				})
				.finally(() => {
					if (loadingRef.current.get(source) === requestId) {
						loadingRef.current.delete(source);
					}
				});
		}
		return () => {
			cancelled = true;
			for (const [source, request] of activeRequests) {
				request.abort.abort();
				if (loadingRef.current.get(source) === request.id) {
					loadingRef.current.delete(source);
				}
			}
		};
	}, [e2eeKey, sources, tokens, whiteboardId]);

	return useMemo(() => {
		void revision;
		return (src: string) => {
			if (parseEncryptedAssetReference(src)) {
				return (
					getLocalEncryptedAssetPreview(src) ??
					objectUrlsRef.current.get(src) ??
					TRANSPARENT_PIXEL
				);
			}
			return withAssetAccessParams(src, tokens);
		};
	}, [revision, tokens]);
}
