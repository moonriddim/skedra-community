import {
	ShareTokenCanvasFrame,
	ShareTokenLoadingScreen,
	ShareTokenUnavailableCard,
} from "@/components/board/share-token-page-layout";
import { getKnownE2eeKey } from "@/lib/e2ee";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { getTrpcErrorMessage } from "@/lib/trpc-errors";
import { Code2 } from "lucide-react";
import { lazy, useEffect, useState } from "react";
import { useParams } from "react-router";

const SkedraCanvas = lazy(() =>
	import("@/components/canvas/skedra-canvas").then((m) => ({
		default: m.SkedraCanvas,
	})),
);

export function EmbedPage() {
	const { shareToken } = useParams();
	const { t } = useI18n();
	const [e2eeKey, setE2eeKey] = useState<string | null>(null);

	const { data, error, isLoading } = trpc.whiteboard.resolveEmbedShare.useQuery(
		{ shareToken: shareToken ?? "" },
		{ enabled: !!shareToken },
	);

	useEffect(() => {
		if (!data?.whiteboardId) return;
		setE2eeKey(getKnownE2eeKey(data.whiteboardId));
	}, [data?.whiteboardId]);

	if (!shareToken) return null;
	if (isLoading) return <ShareTokenLoadingScreen />;

	if (!data) {
		return (
			<ShareTokenUnavailableCard
				icon={<Code2 className="h-8 w-8 text-primary" />}
				title={t("embedPage.unavailableTitle") ?? "Embed unavailable"}
				description={getTrpcErrorMessage({
					error,
					t,
					fallbackKey: "embedPage.unavailableDescription",
				})}
				backToLoginLabel={t("presentationPage.backToLogin")}
			/>
		);
	}

	return (
		<ShareTokenCanvasFrame>
			<SkedraCanvas
				whiteboardId={data.whiteboardId}
				embedShareToken={shareToken}
				e2eeEnabled={data.e2eeEnabled}
				e2eeKey={e2eeKey}
				forceReadonly
				presenceEnabled={false}
				audienceBoardName={data.whiteboardName}
			/>
		</ShareTokenCanvasFrame>
	);
}
