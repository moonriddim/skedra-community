import { z } from "zod";

/** Typ-Kennung in .skedralib-Dateien (Shape-Bibliotheken, analog excalidrawlib). */
export const SKEDRA_LIB_TYPE = "skedralib" as const;

export const SKEDRA_LIB_VERSION = 1;
export const SKEDRA_LIBRARY_LICENSE = "MIT" as const;

export const skedraLibraryItemSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	elements: z.array(z.record(z.unknown())),
});

export const skedraLibrarySchema = z.object({
	type: z.literal(SKEDRA_LIB_TYPE),
	version: z.number().int().positive(),
	name: z.string().optional(),
	source: z.string().optional(),
	author: z.string().optional(),
	description: z.string().optional(),
	/** Public catalog packages are published under the MIT License. */
	license: z.literal(SKEDRA_LIBRARY_LICENSE).optional(),
	items: z.array(skedraLibraryItemSchema),
});

export type SkedraLibraryItem = z.infer<typeof skedraLibraryItemSchema>;
export type SkedraLibraryFile = z.infer<typeof skedraLibrarySchema>;

export const SKEDRA_LIB_EXTENSION = "skedralib";
export const SKEDRA_LIB_MIME = "application/vnd.skedra.library+json";

export const personalShapeLibraryPackageSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().optional(),
	items: z.array(skedraLibraryItemSchema),
	updatedAt: z.number(),
});

export const installedShapeLibrarySchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().optional(),
	author: z.string().optional(),
	source: z.string().optional(),
	license: z.literal(SKEDRA_LIBRARY_LICENSE).optional(),
	items: z.array(skedraLibraryItemSchema),
	installedAt: z.number(),
});

export const personalShapeLibraryStateSchema = z.object({
	ownPackages: z.array(personalShapeLibraryPackageSchema),
	activePackageId: z.string().nullable(),
	installedLibraries: z.array(installedShapeLibrarySchema),
});

export type PersonalShapeLibraryState = z.infer<
	typeof personalShapeLibraryStateSchema
>;

/** Excalidraw-Bibliotheksformat (.excalidrawlib). */
export const EXCALIDRAW_LIB_TYPE = "excalidrawlib" as const;

export const excalidrawLibrarySchema = z.object({
	type: z.literal(EXCALIDRAW_LIB_TYPE),
	version: z.number().optional(),
	library: z.array(z.array(z.record(z.unknown()))),
});

export type ExcalidrawLibraryFile = z.infer<typeof excalidrawLibrarySchema>;
