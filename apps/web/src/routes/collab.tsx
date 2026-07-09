/**
 * Excalidraw+-ähnlicher Kollaborations-Link (Gast, view oder edit).
 */

import {
	ShareTokenCanvasFrame,
	ShareTokenLoadingScreen,
	ShareTokenUnavailableCard,
} from "@/components/board/share-token-page-layout";
import { getKnownE2eeKey } from "@/lib/e2ee";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { getTrpcErrorMessage } from "@/lib/trpc-errors";
import { Link2 } from "lucide-react";
import { lazy, useEffect, useState } from "react";
import { useParams } from "react-router";

const SkedraCanvas = lazy(() =>
	import("@/components/canvas/skedra-canvas").then((m) => ({
		default: m.SkedraCanvas,
	})),
);

export function CollabPage() {
	const { shareToken } = useParams();
	const { t } = useI18n();
	const [e2eeKey, setE2eeKey] = useState<string | null>(null);

	const { data, error, isLoading } =
		trpc.whiteboard.resolveCollabShare.useQuery(
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
				icon={<Link2 className="h-8 w-8 text-primary" />}
				title={t("collabPage.unavailableTitle")}
				description={getTrpcErrorMessage({
					error,
					t,
					fallbackKey: "collabPage.unavailableDescription",
				})}
				backToLoginLabel={t("collabPage.backToLogin")}
			/>
		);
	}

	return (
		<ShareTokenCanvasFrame>
			<SkedraCanvas
				whiteboardId={data.whiteboardId}
				collabShareToken={shareToken}
				e2eeEnabled={data.e2eeEnabled}
				e2eeKey={e2eeKey}
				forceReadonly={!data.canWrite}
				audienceBoardName={data.whiteboardName}
			/>
		</ShareTokenCanvasFrame>
	);
}
