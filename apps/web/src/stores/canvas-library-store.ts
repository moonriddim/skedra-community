/**
 * Lokale Shape-Bibliotheken: eigene Pakete (erstellen/befüllen) + installierte Sammlungen.
 * Persistiert in localStorage.
 */

import { encodeCanvasElements } from "@/lib/canvas/canvas-codecs";
import { prepareLibraryItemForStorage } from "@/lib/canvas/library-item-prepare";
import type { InstalledShapeLibrary } from "@/lib/canvas/library-utils";
import type { CanvasElement } from "@skedra/canvas-core";
import type { SkedraLibraryItem } from "@skedra/shared";
import { nanoid } from "nanoid";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Vom Nutzer erstelltes Paket (lokal, vor Veröffentlichung). */
interface OwnLibraryPackage {
	id: string;
	name: string;
	description?: string;
	items: SkedraLibraryItem[];
	updatedAt: number;
}

interface CanvasLibraryState {
	ownPackages: OwnLibraryPackage[];
	activePackageId: string | null;
	installedLibraries: InstalledShapeLibrary[];

	createPackage: (name?: string) => string;
	importPackage: (library: {
		name: string;
		description?: string;
		items: SkedraLibraryItem[];
	}) => string;
	setActivePackage: (id: string) => void;
	renamePackage: (id: string, name: string, description?: string) => void;
	deletePackage: (id: string) => void;
	getActivePackage: () => OwnLibraryPackage | null;
	addToActivePackage: (elements: CanvasElement[], itemName?: string) => void;
	removeItemFromPackage: (packageId: string, itemId: string) => void;
	installLibrary: (library: InstalledShapeLibrary) => void;
	uninstallLibrary: (id: string) => void;
	isLibraryInstalled: (id: string) => boolean;
}

function createDefaultPackage(name: string): OwnLibraryPackage {
	const id = nanoid();
	return {
		id,
		name,
		items: [],
		updatedAt: Date.now(),
	};
}

export const useCanvasLibraryStore = create<CanvasLibraryState>()(
	persist(
		(set, get) => ({
			ownPackages: [],
			activePackageId: null,
			installedLibraries: [],

			createPackage: (name) => {
				const pkg = createDefaultPackage(
					name?.trim() || `Paket ${get().ownPackages.length + 1}`,
				);
				set((state) => ({
					ownPackages: [pkg, ...state.ownPackages],
					activePackageId: pkg.id,
				}));
				return pkg.id;
			},

			importPackage: (library) => {
				const pkg: OwnLibraryPackage = {
					id: nanoid(),
					name: library.name.trim() || `Paket ${get().ownPackages.length + 1}`,
					description: library.description,
					items: library.items,
					updatedAt: Date.now(),
				};
				set((state) => ({
					ownPackages: [pkg, ...state.ownPackages],
					activePackageId: pkg.id,
				}));
				return pkg.id;
			},

			setActivePackage: (id) => {
				if (!get().ownPackages.some((p) => p.id === id)) return;
				set({ activePackageId: id });
			},

			renamePackage: (id, name, description) => {
				set((state) => ({
					ownPackages: state.ownPackages.map((pkg) =>
						pkg.id === id
							? {
									...pkg,
									name: name.trim() || pkg.name,
									description:
										description !== undefined ? description : pkg.description,
									updatedAt: Date.now(),
								}
							: pkg,
					),
				}));
			},

			deletePackage: (id) => {
				set((state) => {
					const ownPackages = state.ownPackages.filter((p) => p.id !== id);
					const activePackageId =
						state.activePackageId === id
							? (ownPackages[0]?.id ?? null)
							: state.activePackageId;
					return { ownPackages, activePackageId };
				});
			},

			getActivePackage: () => {
				const { ownPackages, activePackageId } = get();
				if (!activePackageId) return ownPackages[0] ?? null;
				return (
					ownPackages.find((p) => p.id === activePackageId) ??
					ownPackages[0] ??
					null
				);
			},

			addToActivePackage: (elements, itemName) => {
				if (elements.length === 0) return;

				let { ownPackages, activePackageId } = get();
				if (ownPackages.length === 0) {
					const pkg = createDefaultPackage("Meine Bibliothek");
					ownPackages = [pkg];
					activePackageId = pkg.id;
				}

				const targetId = activePackageId ?? ownPackages[0].id;
				const prepared = prepareLibraryItemForStorage(elements);
				const item: SkedraLibraryItem = {
					id: nanoid(),
					name:
						itemName?.trim() ||
						`Symbol ${(ownPackages.find((p) => p.id === targetId)?.items.length ?? 0) + 1}`,
					elements: encodeCanvasElements(prepared),
				};

				set({
					ownPackages: ownPackages.map((pkg) =>
						pkg.id === targetId
							? { ...pkg, items: [item, ...pkg.items], updatedAt: Date.now() }
							: pkg,
					),
					activePackageId: targetId,
				});
			},

			removeItemFromPackage: (packageId, itemId) => {
				set((state) => ({
					ownPackages: state.ownPackages.map((pkg) =>
						pkg.id === packageId
							? {
									...pkg,
									items: pkg.items.filter((i) => i.id !== itemId),
									updatedAt: Date.now(),
								}
							: pkg,
					),
				}));
			},

			installLibrary: (library) => {
				set((state) => {
					const without = state.installedLibraries.filter(
						(lib) => lib.id !== library.id,
					);
					return {
						installedLibraries: [
							{ ...library, installedAt: Date.now() },
							...without,
						],
					};
				});
			},

			uninstallLibrary: (id) => {
				set((state) => ({
					installedLibraries: state.installedLibraries.filter(
						(lib) => lib.id !== id,
					),
				}));
			},

			isLibraryInstalled: (id) =>
				get().installedLibraries.some((lib) => lib.id === id),
		}),
		{
			name: "skedra-shape-libraries",
			version: 2,
			migrate: (persisted) => {
				const state = persisted as Record<string, unknown>;
				const ownPackages = state.ownPackages;
				if (!Array.isArray(ownPackages) || ownPackages.length === 0) {
					const pkg = createDefaultPackage("Meine Bibliothek");
					return {
						...state,
						ownPackages: [pkg],
						activePackageId: pkg.id,
					};
				}
				const activeId = state.activePackageId;
				if (
					typeof activeId !== "string" ||
					!ownPackages.some((p) => (p as OwnLibraryPackage).id === activeId)
				) {
					return {
						...state,
						activePackageId: (ownPackages[0] as OwnLibraryPackage).id,
					};
				}
				return state;
			},
		},
	),
);
