import { readCanvasMapsFromYDoc } from "@/lib/canvas/yjs-document-helpers";
import { base64ToBytes, decryptYjsUpdate } from "@/lib/e2ee";
import type { CanvasElement } from "@skedra/canvas-core";
import * as Y from "yjs";

export interface WhiteboardPreviewState {
	elements: Map<string, CanvasElement>;
	canvasBg: string;
}

export async function readWhiteboardPreviewState({
	updates,
	encryptionMode,
	e2eeKey,
}: {
	updates: string[];
	encryptionMode: "server" | "e2ee";
	e2eeKey?: string | null;
}): Promise<WhiteboardPreviewState> {
	if (encryptionMode === "e2ee" && !e2eeKey) {
		return { elements: new Map(), canvasBg: "" };
	}

	const doc = new Y.Doc();
	try {
		for (const update of updates) {
			const bytes =
				encryptionMode === "e2ee"
					? await decryptYjsUpdate(update, e2eeKey as string)
					: base64ToBytes(update);
			Y.applyUpdate(doc, bytes);
		}
		const state = readCanvasMapsFromYDoc(doc);
		return {
			elements: state.elements,
			canvasBg: state.canvasBg,
		};
	} finally {
		doc.destroy();
	}
}
