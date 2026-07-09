/** Aktivitaetstypen fuer Board-Aenderungen (Activity Feed). */
export const whiteboardActivityTypes = [
	"board_created",
	"board_renamed",
	"board_archived",
	"board_restored",
	"board_deleted",
	"member_invited",
	"presentation_shared",
] as const;

export type WhiteboardActivityType = (typeof whiteboardActivityTypes)[number];

export type WhiteboardActivityMetadata = {
	/** Neuer oder alter Board-Name */
	name?: string;
	previousName?: string;
	/** Eingeladene E-Mail bei member_invited */
	email?: string;
	/** view | edit bei member_invited */
	accessLevel?: "view" | "edit";
	roleName?: string;
	pendingRegistration?: boolean;
};
