import { getObjectStorageStatus } from "../../lib/object-storage";
import { publicProcedure, router } from "../init";

export const assetsRouter = router({
	getUploadConfig: publicProcedure.query(async ({ ctx }) => {
		const status = await getObjectStorageStatus(ctx.db);
		return {
			enabled: status.configured && status.provider === "s3",
			source: status.source,
			provider: status.provider,
			preset: status.preset,
			maxImageBytes: status.maxImageBytes,
			hasPublicBaseUrl: !!status.publicBaseUrl,
			requiresClientEncryption: true,
		};
	}),
});
