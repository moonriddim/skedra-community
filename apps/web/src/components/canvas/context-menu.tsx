import { useI18n } from "@/lib/i18n";
import {
	CanvasEditorContextMenu,
	type CanvasEditorContextMenuProps,
} from "@skedra/canvas-editor";

export type ContextMenuProps = Omit<CanvasEditorContextMenuProps, "translate">;

/** Community translation adapter for the shared editor context menu. */
export function ContextMenu(props: ContextMenuProps) {
	const { t } = useI18n();
	return (
		<CanvasEditorContextMenu
			{...props}
			translate={(key, fallback) => {
				const translated = t(key);
				return translated === key ? fallback : translated;
			}}
		/>
	);
}
