import { whiteboardPresentationShareSettingsSchema } from "./schemas";

export function getWhiteboardPresentationShareSettings(whiteboard: {
	presentationShareEnabled: boolean;
	presentationSharePresenceEnabled: boolean;
	presentationShareAccessMode: "always" | "presentation-only";
}) {
	return whiteboardPresentationShareSettingsSchema.parse({
		enabled: whiteboard.presentationShareEnabled,
		presenceEnabled: whiteboard.presentationSharePresenceEnabled,
		accessMode: whiteboard.presentationShareAccessMode,
	});
}

export function isPresentationCurrentlyActive(
	activeUntil: Date | null | undefined,
) {
	if (!activeUntil) return false;
	return activeUntil.getTime() > Date.now();
}
