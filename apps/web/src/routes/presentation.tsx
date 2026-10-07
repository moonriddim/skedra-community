import {
	ShareTokenCanvasFrame,
	ShareTokenLoadingScreen,
	ShareTokenUnavailableCard,
} from "@/components/board/share-token-page-layout";
import { getAbsoluteApiBaseUrl } from "@/lib/api-url";
import { getKnownE2eeKey } from "@/lib/e2ee";
import { trackGrowthEventOnce } from "@/lib/growth-analytics";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { getTrpcErrorMessage } from "@/lib/trpc-errors";
import { Presentation } from "lucide-react";
import { lazy, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

const SkedraCanvas = lazy(() =>
	import("@/components/canvas/skedra-canvas").then((m) => ({
		default: m.SkedraCanvas,
	})),
);

export function PresentationPage() {
	const { shareToken } = useParams();
	const { t } = useI18n();
	const [e2eeKey, setE2eeKey] = useState<string | null>(null);
	const templateStateRef = useRef<(() => string | null) | null>(null);

	const { data, error, isLoading } =
		trpc.whiteboard.getPresentationAccess.useQuery(
			{ shareToken: shareToken ?? "" },
			{ enabled: !!shareToken, refetchInterval: 15_000 },
		);

	useEffect(() => {
		if (!data?.whiteboardId || data.encryptionMode !== "e2ee") return;
		setE2eeKey(getKnownE2eeKey(data.whiteboardId));
	}, [data?.encryptionMode, data?.whiteboardId]);

	useEffect(() => {
		if (data) {
			trackGrowthEventOnce("share_viewed", { context: "presentation" });
		}
	}, [data]);

	useEffect(() => {
		const title = data ? `${data.whiteboardName} | Skedra` : "Skedra";
		const description = t("whiteboardPage.share.description");
		const url = new URL(
			`/present/${encodeURIComponent(shareToken ?? "")}`,
			window.location.origin,
		);
		if (data?.previewVersion) url.searchParams.set("v", data.previewVersion);
		const image = data?.previewVersion
			? `${getAbsoluteApiBaseUrl()}/api/presentations/${encodeURIComponent(shareToken ?? "")}/preview.png?v=${data.previewVersion}`
			: null;
		document.title = title;
		for (const [attribute, key, value] of [
			["name", "description", description],
			["name", "robots", "noindex, nofollow, noarchive"],
			["property", "og:title", title],
			["property", "og:description", description],
			["property", "og:url", url.toString()],
			["property", "og:image", image],
			["property", "og:image:alt", data?.whiteboardName ?? null],
			["name", "twitter:title", title],
			["name", "twitter:description", description],
			["name", "twitter:image", image],
			["name", "twitter:card", image ? "summary_large_image" : "summary"],
		]) {
			let meta = document.head.querySelector<HTMLMetaElement>(
				`meta[${attribute}="${key}"]`,
			);
			if (value == null) {
				meta?.remove();
				continue;
			}
			if (!meta) {
				meta = document.createElement("meta");
				meta.setAttribute(attribute as string, key as string);
				document.head.append(meta);
			}
			meta.content = value;
		}
		for (const element of document.head.querySelectorAll(
			'link[rel="canonical"], link[data-skedra-alternate], script[type="application/ld+json"]',
		))
			element.remove();
	}, [data, shareToken, t]);

	if (!shareToken) return null;
	if (isLoading) return <ShareTokenLoadingScreen />;

	if (!data) {
		return (
			<ShareTokenUnavailableCard
				icon={<Presentation className="h-8 w-8 text-primary" />}
				title={t("presentationPage.unavailableTitle")}
				description={getTrpcErrorMessage({
					error,
					t,
					fallbackKey: "presentationPage.unavailableDescription",
				})}
				backToLoginLabel={t("presentationPage.backToLogin")}
			/>
		);
	}

	return (
		<ShareTokenCanvasFrame templateStateRef={templateStateRef}>
			<SkedraCanvas
				whiteboardId={data.whiteboardId}
				encryptionMode={data.encryptionMode}
				presentationMode
				presentationShareToken={shareToken}
				presentationAccessMode={data.accessMode}
				e2eeKey={e2eeKey}
				forceReadonly
				presenceEnabled={data.presenceEnabled}
				audienceBoardName={data.whiteboardName}
				getSaveStateRef={templateStateRef}
			/>
		</ShareTokenCanvasFrame>
	);
}
