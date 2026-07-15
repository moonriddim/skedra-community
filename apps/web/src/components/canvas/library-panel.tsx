/**
 * Shape-Bibliothek: eigene Pakete erstellen, Community, Import/URL.
 */

import { LibraryItemPreview } from "@/components/canvas/library-item-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { decodeCanvasElements } from "@/lib/canvas/canvas-codecs";
import {
	buildSkedraLibraryFile,
	downloadSkedraLibrary,
	installPublicLibraryBySlug,
	instantiateLibraryItem,
} from "@/lib/canvas/library-utils";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useCanvasLibraryStore } from "@/stores/canvas-library-store";
import { useThemeStore } from "@/stores/theme";
import type { CanvasElement } from "@skedra/canvas-core";
import type { SkedraLibraryItem } from "@skedra/shared";
import { normalizeLibrarySlug } from "@skedra/shared";
import {
	BookOpen,
	Download,
	Loader2,
	PackagePlus,
	Pin,
	Plus,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface LibraryPanelProps {
	selectedElements: CanvasElement[];
	onInsertElements: (elements: CanvasElement[]) => void;
	getViewportCenter: () => { x: number; y: number };
	onClose: () => void;
}

const SCROLL_AREA_CLASS =
	"flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-5 [scrollbar-gutter:stable] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30 hover:scrollbar-thumb-muted-foreground/45";

type LibraryPanelTab = "create" | "libraries";

export function LibraryPanel({
	selectedElements,
	onInsertElements,
	getViewportCenter,
	onClose,
}: LibraryPanelProps) {
	const { t } = useI18n();
	const { data: session } = authClient.useSession();
	const utils = trpc.useUtils();
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
	const isLoggedIn = !!session?.user;

	const [activeTab, setActiveTab] = useState<LibraryPanelTab>("libraries");
	const [pinned, setPinned] = useState(false);
	const [importError, setImportError] = useState("");
	const [installingSlug, setInstallingSlug] = useState<string | null>(null);
	const [publishOpen, setPublishOpen] = useState(false);
	const [publishSlug, setPublishSlug] = useState("");
	const [publishDescription, setPublishDescription] = useState("");
	const [licenseAccepted, setLicenseAccepted] = useState(false);
	const [submissionMessage, setSubmissionMessage] = useState<string | null>(
		null,
	);
	/** Leeres Neu-Paket wird beim Abbrechen wieder entfernt. */
	const [draftPackageId, setDraftPackageId] = useState<string | null>(null);
	const personalLibraryLoadedRef = useRef(false);

	const ownPackages = useCanvasLibraryStore((s) => s.ownPackages);
	const activePackageId = useCanvasLibraryStore((s) => s.activePackageId);
	const createPackage = useCanvasLibraryStore((s) => s.createPackage);
	const setActivePackage = useCanvasLibraryStore((s) => s.setActivePackage);
	const renamePackage = useCanvasLibraryStore((s) => s.renamePackage);
	const deletePackage = useCanvasLibraryStore((s) => s.deletePackage);
	const addToActivePackage = useCanvasLibraryStore((s) => s.addToActivePackage);
	const removeItemFromPackage = useCanvasLibraryStore(
		(s) => s.removeItemFromPackage,
	);
	const installLibrary = useCanvasLibraryStore((s) => s.installLibrary);
	const uninstallLibrary = useCanvasLibraryStore((s) => s.uninstallLibrary);
	const installedLibraries = useCanvasLibraryStore((s) => s.installedLibraries);

	const { data: catalogConfig } = trpc.shapeLibrary.getCatalogConfig.useQuery();
	const { data: publicLibraries = [] } =
		trpc.shapeLibrary.listPublic.useQuery();
	const { data: personalLibrary } = trpc.shapeLibrary.getPersonal.useQuery(
		undefined,
		{ enabled: isLoggedIn },
	);
	const syncPersonalLibrary = trpc.shapeLibrary.syncPersonal.useMutation();

	const submitMutation = trpc.shapeLibrary.submitForReview.useMutation({
		onSuccess: () => {
			setSubmissionMessage(t("shapeLibrary.reviewSubmitted"));
			setPublishOpen(false);
			setLicenseAccepted(false);
			setDraftPackageId(null);
			void utils.shapeLibrary.listMine.invalidate();
		},
		onError: () => setImportError(t("shapeLibrary.errors.publishFailed")),
	});

	const activePackage = useMemo(() => {
		if (!activePackageId) return ownPackages[0] ?? null;
		return (
			ownPackages.find((p) => p.id === activePackageId) ??
			ownPackages[0] ??
			null
		);
	}, [activePackageId, ownPackages]);

	const activeItems = activePackage?.items ?? [];

	const installableLibraries = useMemo(() => {
		const installedSlugs = new Set(installedLibraries.map((lib) => lib.id));
		return publicLibraries.filter((entry) => !installedSlugs.has(entry.slug));
	}, [installedLibraries, publicLibraries]);

	const insertItem = useCallback(
		(item: SkedraLibraryItem) => {
			const center = getViewportCenter();
			onInsertElements(instantiateLibraryItem(item, center.x, center.y));
		},
		[getViewportCenter, onInsertElements],
	);

	const handleAddSelection = () => {
		if (selectedElements.length === 0) return;
		addToActivePackage(selectedElements);
		setDraftPackageId(null);
	};

	const handleNewPackage = () => {
		const id = createPackage();
		setDraftPackageId(id);
		setPublishOpen(false);
		setSubmissionMessage(null);
	};

	const handleCancelCreate = () => {
		setPublishOpen(false);
		setPublishSlug("");
		setPublishDescription("");
		if (draftPackageId) {
			const draft = ownPackages.find((p) => p.id === draftPackageId);
			if (draft && draft.items.length === 0) {
				deletePackage(draftPackageId);
			}
			setDraftPackageId(null);
		}
	};

	const showCancelCreate = publishOpen || draftPackageId !== null;

	const handlePackageNameChange = (name: string) => {
		if (!activePackage) return;
		renamePackage(activePackage.id, name);
	};

	const handleExportPackage = () => {
		if (!activePackage || activeItems.length === 0) return;
		const slug = normalizeLibrarySlug(activePackage.name) || "mein-paket";
		const lib = buildSkedraLibraryFile(activeItems, {
			name: activePackage.name,
			description: activePackage.description,
		});
		downloadSkedraLibrary(lib, `${slug || "mein-paket"}.skedralib`);
	};

	const handleInstallPublic = async (slug: string) => {
		setInstallingSlug(slug);
		setImportError("");
		try {
			installLibrary(await installPublicLibraryBySlug(slug, { resolvedTheme }));
		} catch {
			setImportError(t("shapeLibrary.errors.fetchFailed"));
		} finally {
			setInstallingSlug(null);
		}
	};

	const handlePublish = () => {
		if (!activePackage || activeItems.length === 0 || !licenseAccepted) return;
		const slug = publishSlug.trim();
		if (!slug) return;
		setImportError("");
		submitMutation.mutate({
			slug,
			name: activePackage.name,
			licenseAccepted: true,
			description:
				publishDescription.trim() || activePackage.description || undefined,
			items: activeItems,
		});
	};

	const canSubmitToCatalog = catalogConfig?.canSubmit !== false;

	useEffect(() => {
		if (!isLoggedIn || personalLibraryLoadedRef.current || !personalLibrary) {
			return;
		}
		personalLibraryLoadedRef.current = true;
		if (
			personalLibrary.ownPackages.length > 0 ||
			personalLibrary.installedLibraries.length > 0
		) {
			useCanvasLibraryStore.setState({
				ownPackages: personalLibrary.ownPackages,
				activePackageId: personalLibrary.activePackageId,
				installedLibraries: personalLibrary.installedLibraries,
			});
		}
	}, [isLoggedIn, personalLibrary]);

	useEffect(() => {
		if (!isLoggedIn || !personalLibraryLoadedRef.current) return;
		const timer = window.setTimeout(() => {
			syncPersonalLibrary.mutate({
				ownPackages,
				activePackageId,
				installedLibraries,
			});
		}, 700);
		return () => window.clearTimeout(timer);
	}, [
		activePackageId,
		installedLibraries,
		isLoggedIn,
		ownPackages,
		syncPersonalLibrary.mutate,
	]);

	return (
		<div
			className={cn(
				"absolute top-14 left-4 z-40 flex w-[min(100vw-2rem,320px)] flex-col overflow-hidden rounded-xl border border-border bg-card/95 text-card-foreground shadow-xl backdrop-blur-md max-lg:top-auto max-lg:bottom-[calc(8.5rem+env(safe-area-inset-bottom))] max-lg:left-1/2 max-lg:max-h-[min(48dvh,32rem)] max-lg:w-[min(22rem,calc(100vw-1.5rem-env(safe-area-inset-left)-env(safe-area-inset-right)))] max-lg:-translate-x-1/2",
				pinned
					? "bottom-20 max-lg:bottom-[calc(8.5rem+env(safe-area-inset-bottom))]"
					: activeTab === "libraries"
						? "h-[min(72vh,680px)]"
						: "max-h-[min(72vh,680px)]",
			)}
		>
			<div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2.5">
				<BookOpen className="h-4 w-4 shrink-0 text-primary" />
				<h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
					{t("shapeLibrary.title")}
				</h3>
				<button
					type="button"
					onClick={() => setPinned((v) => !v)}
					className={cn(
						"cursor-pointer rounded-md p-1 transition-colors max-lg:flex max-lg:h-11 max-lg:w-11 max-lg:items-center max-lg:justify-center",
						pinned
							? "bg-primary/15 text-primary"
							: "text-muted-foreground hover:bg-accent hover:text-foreground",
					)}
					aria-label={t("shapeLibrary.pin")}
				>
					<Pin className="h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={onClose}
					className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground max-lg:flex max-lg:h-11 max-lg:w-11 max-lg:items-center max-lg:justify-center"
					aria-label={t("common.close")}
				>
					<X className="h-4 w-4" />
				</button>
			</div>

			<div className="shrink-0 border-b border-border/60 px-3 py-2.5">
				<div
					role="tablist"
					aria-label={t("shapeLibrary.tabsLabel")}
					className="grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1"
				>
					<button
						type="button"
						id="shape-library-create-tab"
						role="tab"
						aria-selected={activeTab === "create"}
						aria-controls="shape-library-create-panel"
						onClick={() => setActiveTab("create")}
						className={cn(
							"flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
							activeTab === "create"
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:bg-background/60 hover:text-foreground",
						)}
					>
						<PackagePlus className="h-3.5 w-3.5" />
						{t("shapeLibrary.createTab")}
					</button>
					<button
						type="button"
						id="shape-library-libraries-tab"
						role="tab"
						aria-selected={activeTab === "libraries"}
						aria-controls="shape-library-libraries-panel"
						onClick={() => setActiveTab("libraries")}
						className={cn(
							"flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
							activeTab === "libraries"
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:bg-background/60 hover:text-foreground",
						)}
					>
						<BookOpen className="h-3.5 w-3.5" />
						{t("shapeLibrary.librariesTab")}
					</button>
				</div>
			</div>

			<div className={SCROLL_AREA_CLASS}>
				{importError && (
					<p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs leading-snug text-destructive">
						{importError}
					</p>
				)}

				{activeTab === "create" && (
					<div
						id="shape-library-create-panel"
						role="tabpanel"
						aria-labelledby="shape-library-create-tab"
						className="space-y-5"
					>
						{submissionMessage && (
							<div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-[11px]">
								<p className="font-medium text-foreground">
									{submissionMessage}
								</p>
								<p className="mt-1 text-muted-foreground">
									{t("shapeLibrary.reviewSubmittedHint")}
								</p>
							</div>
						)}

						{/* Eigenes Paket erstellen */}
						<section className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
							<div className="flex items-start justify-between gap-2">
								<h4 className="text-sm font-semibold leading-tight text-foreground">
									{t("shapeLibrary.createOwn")}
								</h4>
								{showCancelCreate && (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-7 shrink-0 px-2 text-[11px] text-muted-foreground hover:text-foreground"
										onClick={handleCancelCreate}
									>
										{t("shapeLibrary.cancelCreate")}
									</Button>
								)}
							</div>

							<ol className="list-decimal space-y-1 pl-4 text-[11px] leading-snug text-muted-foreground">
								<li>{t("shapeLibrary.createStep1")}</li>
								<li>{t("shapeLibrary.createStep2")}</li>
								<li>{t("shapeLibrary.createStep3")}</li>
							</ol>

							<div className="space-y-2">
								<label
									htmlFor="shape-library-package-name"
									className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
								>
									{t("shapeLibrary.packageNamePlaceholder")}
								</label>
								{activePackage && (
									<Input
										id="shape-library-package-name"
										value={activePackage.name}
										onChange={(e) => handlePackageNameChange(e.target.value)}
										placeholder={t("shapeLibrary.packageNamePlaceholder")}
										className="h-9 bg-background text-sm"
									/>
								)}
							</div>

							{ownPackages.length > 1 && (
								<div className="space-y-1">
									<label
										htmlFor="shape-library-active-package"
										className="text-[10px] font-medium text-muted-foreground"
									>
										{t("shapeLibrary.activePackage")}
									</label>
									<select
										id="shape-library-active-package"
										value={activePackage?.id ?? ""}
										onChange={(e) => {
											setActivePackage(e.target.value);
											setDraftPackageId(null);
										}}
										className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs"
									>
										{ownPackages.map((pkg) => (
											<option key={pkg.id} value={pkg.id}>
												{pkg.name} ·{" "}
												{t("shapeLibrary.itemCount", {
													count: pkg.items.length,
												})}
											</option>
										))}
									</select>
								</div>
							)}

							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-9 w-full gap-2 text-xs"
								onClick={handleNewPackage}
							>
								<PackagePlus className="h-4 w-4 shrink-0" />
								{t("shapeLibrary.newPackage")}
							</Button>

							<div className="border-t border-border/50 pt-3">
								<div className="mb-2 flex items-center justify-between gap-2">
									<span className="text-xs font-medium text-foreground">
										{t("shapeLibrary.personal")}
									</span>
									<Button
										type="button"
										size="sm"
										disabled={selectedElements.length === 0}
										onClick={handleAddSelection}
										className="h-8 gap-1.5 px-3 text-xs"
										title={t("shapeLibrary.addSelection")}
									>
										<Plus className="h-3.5 w-3.5" />
										{t("shapeLibrary.add")}
									</Button>
								</div>

								{activeItems.length === 0 ? (
									<p className="rounded-md border border-dashed border-border/50 bg-background/50 px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
										{t("shapeLibrary.personalEmpty")}
									</p>
								) : (
									<div className="grid grid-cols-4 gap-1.5">
										{activeItems.map((item) => (
											<LibraryItemButton
												key={item.id}
												item={item}
												onInsert={() => insertItem(item)}
												onRemove={
													activePackage
														? () =>
																removeItemFromPackage(activePackage.id, item.id)
														: undefined
												}
												showRemove
											/>
										))}
									</div>
								)}
							</div>

							<div className="flex flex-col gap-2 border-t border-border/50 pt-3">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-9 w-full text-xs"
									disabled={activeItems.length === 0}
									onClick={handleExportPackage}
								>
									<Download className="mr-2 h-3.5 w-3.5 shrink-0" />
									{t("shapeLibrary.exportPackage")}
								</Button>

								{!canSubmitToCatalog ? (
									<div className="rounded-lg border border-border/60 bg-background p-2.5 text-[11px]">
										<p className="text-muted-foreground">
											{t("shapeLibrary.reviewReadOnlyHint")}
										</p>
										{catalogConfig?.submitUrl ? (
											<a
												href={catalogConfig.submitUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="mt-2 inline-flex font-medium text-primary hover:underline"
											>
												{t("shapeLibrary.openSubmitPortal")}
											</a>
										) : null}
									</div>
								) : isLoggedIn ? (
									<>
										{!publishOpen ? (
											<Button
												type="button"
												variant="secondary"
												size="sm"
												className="h-9 w-full text-xs"
												disabled={activeItems.length === 0}
												onClick={() => {
													setPublishOpen(true);
													setLicenseAccepted(false);
													if (!publishSlug && activePackage) {
														setPublishSlug(
															activePackage.name
																.toLowerCase()
																.replace(/[^a-z0-9]+/g, "-")
																.replace(/^-+|-+$/g, "")
																.slice(0, 48),
														);
													}
												}}
											>
												<Upload className="mr-2 h-3.5 w-3.5 shrink-0" />
												{t("shapeLibrary.publishPackage")}
											</Button>
										) : (
											<div className="space-y-2 rounded-lg border border-border/60 bg-background p-2.5">
												<p className="text-xs font-medium text-foreground">
													{t("shapeLibrary.publishPackage")}
												</p>
												<Input
													value={publishSlug}
													onChange={(e) => setPublishSlug(e.target.value)}
													placeholder={t("shapeLibrary.publishSlugPlaceholder")}
													className="h-9 font-mono text-xs"
												/>
												<Input
													value={publishDescription}
													onChange={(e) =>
														setPublishDescription(e.target.value)
													}
													placeholder={t(
														"shapeLibrary.publishDescriptionPlaceholder",
													)}
													className="h-9 text-xs"
												/>
												<p className="text-[10px] leading-snug text-muted-foreground">
													{t("shapeLibrary.publishHint")}
												</p>
												<label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-muted/20 p-2 text-[10px] leading-snug text-muted-foreground">
													<input
														type="checkbox"
														checked={licenseAccepted}
														onChange={(event) =>
															setLicenseAccepted(event.target.checked)
														}
														className="mt-0.5 accent-primary"
													/>
													<span>{t("shapeLibrary.mitLicenseConsent")}</span>
												</label>
												<div className="flex gap-2">
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="h-9 flex-1 text-xs"
														onClick={() => {
															setPublishOpen(false);
															setLicenseAccepted(false);
														}}
													>
														{t("shapeLibrary.cancelCreate")}
													</Button>
													<Button
														type="button"
														size="sm"
														className="h-9 flex-1 text-xs"
														disabled={
															!publishSlug.trim() ||
															!licenseAccepted ||
															submitMutation.isPending
														}
														onClick={handlePublish}
													>
														{submitMutation.isPending && (
															<Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
														)}
														{t("shapeLibrary.publishSubmit")}
													</Button>
												</div>
											</div>
										)}
									</>
								) : (
									<p className="text-center text-[10px] text-muted-foreground">
										{t("shapeLibrary.publishLoginHint")}
									</p>
								)}

								{ownPackages.length > 1 && activePackage && (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-8 w-full text-[11px] text-muted-foreground hover:text-destructive"
										onClick={() => {
											deletePackage(activePackage.id);
											setDraftPackageId(null);
										}}
									>
										<Trash2 className="mr-1.5 h-3.5 w-3.5" />
										{t("shapeLibrary.deletePackage")}
									</Button>
								)}
							</div>
						</section>
					</div>
				)}

				{activeTab === "libraries" && (
					<div
						id="shape-library-libraries-panel"
						role="tabpanel"
						aria-labelledby="shape-library-libraries-tab"
						className="space-y-3"
					>
						{installedLibraries.map((library) => {
							return (
								<section
									key={library.id}
									className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-2.5"
								>
									<div className="flex items-start gap-2">
										<div className="min-w-0 flex-1">
											<h4 className="truncate text-sm font-semibold">
												{library.name}
											</h4>
											<p className="text-[10px] text-muted-foreground">
												{t("shapeLibrary.itemCount", {
													count: library.items.length,
												})}
											</p>
										</div>
										<button
											type="button"
											onClick={() => uninstallLibrary(library.id)}
											className="cursor-pointer rounded-md p-1 text-muted-foreground hover:text-destructive"
											title={t("shapeLibrary.uninstall")}
										>
											<Trash2 className="h-3.5 w-3.5" />
										</button>
									</div>
									<div className="grid grid-cols-4 gap-1.5">
										{library.items.map((item) => (
											<LibraryItemButton
												key={`${library.id}-${item.id}`}
												item={item}
												onInsert={() => insertItem(item)}
											/>
										))}
									</div>
								</section>
							);
						})}

						{installableLibraries.map((entry) => (
							<div
								key={entry.slug}
								className="rounded-lg border border-border/60 bg-background/40 p-2.5"
							>
								<div className="flex items-center justify-between gap-2">
									<p className="text-sm font-medium">{entry.name}</p>
									<span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
										{entry.license}
									</span>
								</div>
								{entry.description && (
									<p className="mt-1 text-[11px] text-muted-foreground">
										{entry.description}
									</p>
								)}
								<p className="mt-1 text-[10px] text-muted-foreground/80">
									{entry.author ?? "—"} ·{" "}
									{t("shapeLibrary.itemCount", { count: entry.itemCount })}
								</p>
								<Button
									type="button"
									size="sm"
									className="mt-2.5 h-8 w-full text-xs"
									disabled={installingSlug === entry.slug}
									onClick={() => void handleInstallPublic(entry.slug)}
								>
									{installingSlug === entry.slug && (
										<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
									)}
									{t("shapeLibrary.install")}
								</Button>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function LibraryItemButton({
	item,
	onInsert,
	onRemove,
	showRemove,
}: {
	item: SkedraLibraryItem;
	onInsert: () => void;
	onRemove?: () => void;
	showRemove?: boolean;
}) {
	const elements = decodeCanvasElements(item.elements);

	return (
		<div className="group relative min-w-0">
			<button
				type="button"
				onClick={onInsert}
				className="flex w-full min-w-0 cursor-pointer flex-col rounded-lg border border-border/50 bg-background/80 p-1 transition-colors hover:border-primary/50 hover:bg-accent/50"
				title={item.name}
			>
				<LibraryItemPreview elements={elements} />
			</button>
			{showRemove && onRemove && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onRemove();
					}}
					className="absolute -right-1 -top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-sm group-hover:opacity-100"
					aria-label="Remove"
				>
					<X className="h-3 w-3" />
				</button>
			)}
		</div>
	);
}
