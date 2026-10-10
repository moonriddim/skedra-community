import {
	type SkedraAiProvider,
	isLocalAiProvider,
} from "@skedra/shared/ai-providers";
import { env } from "../env";

/** Managed requests may only use fixed cloud-provider endpoints. A hostname
 * denylist cannot prevent private DNS answers, rebinding, or implicit defaults.
 * Self-hosted installations intentionally support local AI services.
 */
export function assertAiBaseUrlAllowed(
	provider: SkedraAiProvider,
	_baseUrl: string | null | undefined,
) {
	if (env.SKEDRA_DEPLOYMENT_MODE === "managed" && isLocalAiProvider(provider)) {
		throw new Error(
			"Lokale und benutzerdefinierte KI-Endpunkte sind nur bei Selfhosting verfuegbar.",
		);
	}
}
