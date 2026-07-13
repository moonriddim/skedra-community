import { decryptYjsUpdate, encryptYjsUpdate } from "@/lib/e2ee";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as Y from "yjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function usePresenterNotes(options: {
	whiteboardId?: string;
	encryptionMode: "server" | "e2ee";
	e2eeKey: string | null | undefined;
	enabled: boolean;
}) {
	const { whiteboardId, encryptionMode, e2eeKey, enabled } = options;
	const canRead =
		enabled && !!whiteboardId && (encryptionMode === "server" || !!e2eeKey);
	const query = trpc.whiteboard.listPresenterNotes.useQuery(
		{ id: whiteboardId ?? "" },
		{ enabled: canRead },
	);
	const mutation = trpc.whiteboard.updatePresenterNote.useMutation();
	const [notes, setNotes] = useState<Map<string, string>>(new Map());
	const migratedDocumentsRef = useRef(new WeakSet<Y.Doc>());

	useEffect(() => {
		if (!query.data) {
			setNotes(new Map());
			return;
		}
		let cancelled = false;
		void Promise.all(
			query.data.map(async (note) => {
				if (!note.encrypted) return [note.viewId, note.content] as const;
				if (!e2eeKey) return [note.viewId, ""] as const;
				const content = decoder.decode(
					await decryptYjsUpdate(note.content, e2eeKey),
				);
				return [note.viewId, content] as const;
			}),
		)
			.then((entries) => {
				if (!cancelled) setNotes(new Map(entries));
			})
			.catch(() => {
				if (!cancelled) setNotes(new Map());
			});
		return () => {
			cancelled = true;
		};
	}, [e2eeKey, query.data]);

	const saveNote = useCallback(
		async (viewId: string, content: string) => {
			if (!whiteboardId) return;
			setNotes((current) => new Map(current).set(viewId, content));
			const encrypted = encryptionMode === "e2ee";
			const storedContent = encrypted
				? await encryptYjsUpdate(encoder.encode(content), e2eeKey as string)
				: content;
			await mutation.mutateAsync({
				id: whiteboardId,
				viewId,
				content: storedContent,
				encrypted,
			});
		},
		[e2eeKey, encryptionMode, mutation.mutateAsync, whiteboardId],
	);

	const migrateLegacyNotes = useCallback(
		async (ydoc: Y.Doc) => {
			if (migratedDocumentsRef.current.has(ydoc)) return;
			migratedDocumentsRef.current.add(ydoc);
			try {
				const legacyNotes: Array<{
					viewId: string;
					content: string;
					view: Y.Map<unknown>;
				}> = [];
				ydoc.getMap<Y.Map<unknown>>("viewsMap").forEach((view, viewId) => {
					const content = view.get("presenterNotes");
					if (typeof content === "string") {
						legacyNotes.push({ viewId, content, view });
					}
				});
				for (const note of legacyNotes) {
					if (note.content) await saveNote(note.viewId, note.content);
					ydoc.transact(() => {
						if (note.view.get("presenterNotes") === note.content) {
							note.view.delete("presenterNotes");
						}
					});
				}
			} catch (error) {
				migratedDocumentsRef.current.delete(ydoc);
				throw error;
			}
		},
		[saveNote],
	);

	return {
		notes,
		saveNote,
		migrateLegacyNotes,
		isLoading: query.isLoading || mutation.isPending,
	};
}
