import type { Viewport } from "@skedra/canvas-core";
import type { CanvasRole } from "@skedra/shared";

interface CanvasPresenceBase {
	user: {
		id: string;
		name: string;
		image: string | null;
		color: string;
		role: CanvasRole;
	};
	selection: string[];
	cursor: { x: number; y: number } | null;
	viewport: Viewport | null;
	activeViewId: string | null;
	canWrite: boolean;
	updatedAt: number;
}

export interface RemoteCanvasPresence extends CanvasPresenceBase {
	clientId: number;
}

export interface LocalCanvasPresence extends CanvasPresenceBase {}
