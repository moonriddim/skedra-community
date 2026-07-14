import {
	type HTMLAttributes,
	type ReactNode,
	type RefObject,
	createContext,
	useContext,
	useMemo,
} from "react";
import type { CanvasEditorDocumentAdapter } from "./use-canvas-editor-pointer";

export type CanvasEditorHostDocumentAdapter = CanvasEditorDocumentAdapter;

export interface CanvasEditorTranslations {
	translate: (key: string, fallback: string) => string;
}

export interface CanvasEditorAssetAdapter {
	resolveAssetUrl?: (assetId: string) => string | null | Promise<string | null>;
}

export interface CanvasEditorCollaborationAdapter {
	enabled: boolean;
}

export interface CanvasEditorServices {
	documentAdapter: CanvasEditorHostDocumentAdapter;
	translations?: CanvasEditorTranslations;
	assetAdapter?: CanvasEditorAssetAdapter;
	collaboration?: CanvasEditorCollaborationAdapter;
}

export interface CanvasEditorProps
	extends Omit<HTMLAttributes<HTMLDivElement>, "children">,
		CanvasEditorServices {
	children: ReactNode;
	rootRef?: RefObject<HTMLDivElement | null>;
}

const CanvasEditorContext = createContext<CanvasEditorServices | null>(null);

/**
 * Shared editor root used by every Skedra host. Product integrations enter only
 * through the service adapters; generic canvas UI and interaction live below it.
 */
export function CanvasEditor({
	documentAdapter,
	translations,
	assetAdapter,
	collaboration,
	rootRef,
	children,
	...rootProps
}: CanvasEditorProps) {
	const services = useMemo<CanvasEditorServices>(
		() => ({ documentAdapter, translations, assetAdapter, collaboration }),
		[assetAdapter, collaboration, documentAdapter, translations],
	);
	return (
		<CanvasEditorContext.Provider value={services}>
			<div ref={rootRef} data-canvas-editor="true" {...rootProps}>
				{children}
			</div>
		</CanvasEditorContext.Provider>
	);
}

export function useOptionalCanvasEditorServices(): CanvasEditorServices | null {
	return useContext(CanvasEditorContext);
}

export function useCanvasEditorServices(): CanvasEditorServices {
	const services = useOptionalCanvasEditorServices();
	if (!services) {
		throw new Error(
			"Canvas editor components must be rendered inside CanvasEditor.",
		);
	}
	return services;
}
