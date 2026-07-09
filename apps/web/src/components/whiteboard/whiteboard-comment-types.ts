/** Autor einer Kommentar-Nachricht (vom API-Layer). */
export interface WhiteboardCommentAuthor {
	id: string;
	name: string;
	image: string | null;
}

export interface WhiteboardCommentMessage {
	id: string;
	body: string;
	createdAt: Date | string;
	author: WhiteboardCommentAuthor;
}

/** Thread mit Canvas-Position und allen Antworten. */
export interface WhiteboardCommentThread {
	id: string;
	x: number;
	y: number;
	resolvedAt: Date | string | null;
	createdAt: Date | string;
	updatedAt: Date | string;
	createdBy: WhiteboardCommentAuthor;
	messages: WhiteboardCommentMessage[];
}
