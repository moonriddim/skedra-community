import { LibraryItemPreview } from "@/components/canvas/library-item-preview";
import { Button } from "@/components/ui/button";
import { decodeCanvasElements } from "@/lib/canvas/canvas-codecs";
import { downloadBlob } from "@/lib/download-blob";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

export function SystemLibrarySettings() {
	const { locale } = useI18n();
	const de = locale === "de";
	const utils = trpc.useUtils();
	const [selected, setSelected] = useState<string | null>(null);
	const config = trpc.shapeLibrary.getCatalogConfig.useQuery();
	const queue = trpc.shapeLibrary.listSubmissions.useQuery(undefined, {
		enabled: config.data?.mode === "local",
		retry: false,
	});
	const preview = trpc.shapeLibrary.getSubmissionPreview.useQuery(
		{ id: selected ?? "" },
		{ enabled: Boolean(selected), retry: false },
	);
	const review = trpc.shapeLibrary.reviewSubmission.useMutation({
		onSuccess: async () => {
			setSelected(null);
			await Promise.all([
				utils.shapeLibrary.listSubmissions.invalidate(),
				utils.shapeLibrary.listPublic.invalidate(),
				utils.shapeLibrary.listMine.invalidate(),
			]);
		},
	});
	return (
		<section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
			<h2 className="text-lg font-semibold">
				{de ? "Bibliotheks-Katalog" : "Library catalog"}
			</h2>
			<p className="mt-2 text-sm text-muted-foreground">
				{de
					? "Prüfe Bibliotheken, bevor du sie im Katalog dieser Instanz freigibst."
					: "Review libraries before publishing them in this instance's catalog."}
			</p>
			{config.isError || queue.isError ? (
				<p role="alert" className="mt-4 text-sm text-destructive">
					{de
						? "Der Katalog konnte nicht geladen werden."
						: "Could not load the catalog."}
				</p>
			) : null}
			{config.data?.mode === "remote" ? (
				<p className="mt-4 text-sm">
					{de
						? "Die Freigaben verwaltet der Betreiber des konfigurierten Remote-Katalogs."
						: "Submissions are reviewed by the configured remote catalog's operator."}
				</p>
			) : null}
			{queue.isLoading ? (
				<output className="mt-4 block text-sm">
					{de ? "Lädt …" : "Loading…"}
				</output>
			) : null}
			{queue.data?.length === 0 ? (
				<p className="mt-4 text-sm text-muted-foreground">
					{de ? "Keine ausstehenden Einreichungen." : "No pending submissions."}
				</p>
			) : null}
			<ul className="mt-4 space-y-3">
				{queue.data?.map((submission) => (
					<li
						key={submission.id}
						className="rounded-xl border border-border p-4"
					>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h3 className="font-medium">{submission.name}</h3>
								<p className="text-xs text-muted-foreground">
									{submission.author} · {submission.itemCount}{" "}
									{de ? "Elemente" : "items"}
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setSelected(submission.id);
									review.reset();
								}}
							>
								{de ? "Prüfen" : "Review"}
							</Button>
						</div>
						{submission.description ? (
							<p className="mt-2 text-sm text-muted-foreground">
								{submission.description}
							</p>
						) : null}
						{selected === submission.id ? (
							<div className="mt-4 border-t border-border pt-4">
								{preview.isLoading ? (
									<output>{de ? "Vorschau lädt …" : "Loading preview…"}</output>
								) : null}
								{preview.isError ? (
									<p role="alert" className="text-sm text-destructive">
										{de
											? "Vorschau konnte nicht geladen werden."
											: "Could not load the preview."}
									</p>
								) : null}
								{preview.data ? (
									<>
										<div className="grid max-h-96 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
											{preview.data.file.items.map((item) => (
												<div
													key={item.id}
													className="rounded-lg border border-border p-2"
												>
													<LibraryItemPreview
														elements={decodeCanvasElements(item.elements)}
														className="h-24 w-full"
													/>
													<p className="mt-2 truncate text-xs">
														{item.name ?? item.id}
													</p>
												</div>
											))}
										</div>
										<div className="mt-4 flex flex-wrap gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => {
													if (preview.data)
														downloadBlob(
															new Blob([JSON.stringify(preview.data.file)], {
																type: "application/json",
															}),
															`${preview.data.slug}.skedralib`,
														);
												}}
											>
												{de ? "Datei herunterladen" : "Download file"}
											</Button>
											<Button
												size="sm"
												disabled={review.isPending}
												onClick={() =>
													review.mutate({
														id: submission.id,
														action: "approve",
													})
												}
											>
												{de ? "Freigeben" : "Approve"}
											</Button>
											<Button
												variant="outline"
												size="sm"
												disabled={review.isPending}
												onClick={() =>
													review.mutate({ id: submission.id, action: "reject" })
												}
											>
												{de ? "Ablehnen" : "Reject"}
											</Button>
										</div>
									</>
								) : null}
							</div>
						) : null}
					</li>
				))}
			</ul>
			{review.error ? (
				<p role="alert" className="mt-4 text-sm text-destructive">
					{review.error.message}
				</p>
			) : null}
		</section>
	);
}
