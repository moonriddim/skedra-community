import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { BookOpen, Check, Loader2, X } from "lucide-react";
import { useState } from "react";

function formatDate(value: Date | string) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "-";
	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function LibraryReviewSettings() {
	const { t } = useI18n();
	const utils = trpc.useUtils();
	const [notes, setNotes] = useState<Record<string, string>>({});

	const {
		data: submissions = [],
		isLoading,
		error,
	} = trpc.shapeLibrary.listReviewQueue.useQuery(undefined, {
		retry: false,
	});

	const invalidate = () => {
		void utils.shapeLibrary.listReviewQueue.invalidate();
		void utils.shapeLibrary.listPublic.invalidate();
	};

	const approve = trpc.shapeLibrary.approveSubmission.useMutation({
		onSuccess: invalidate,
	});
	const reject = trpc.shapeLibrary.rejectSubmission.useMutation({
		onSuccess: invalidate,
	});

	return (
		<div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
			<div className="flex items-center gap-3">
				<div className="rounded-xl bg-primary/10 p-2 text-primary">
					<BookOpen className="h-5 w-5" />
				</div>
				<div>
					<h3 className="text-base font-semibold text-foreground">
						{t("systemSettings.libraryReview.title")}
					</h3>
					<p className="mt-0.5 text-sm text-muted-foreground">
						{t("systemSettings.libraryReview.description")}
					</p>
				</div>
			</div>

			{isLoading ? (
				<div className="flex justify-center py-8">
					<Loader2 className="h-5 w-5 animate-spin text-primary" />
				</div>
			) : error ? (
				<p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{error.message}
				</p>
			) : submissions.length === 0 ? (
				<p className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
					{t("systemSettings.libraryReview.empty")}
				</p>
			) : (
				<div className="space-y-3">
					{submissions.map((submission) => {
						const note = notes[submission.id] ?? "";
						const busy = approve.isPending || reject.isPending;
						return (
							<div
								key={submission.id}
								className="rounded-xl border border-border/70 bg-background/50 p-4"
							>
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div className="min-w-0">
										<h4 className="truncate text-sm font-semibold text-foreground">
											{submission.name}
										</h4>
										<p className="mt-1 font-mono text-xs text-muted-foreground">
											{submission.slug}
										</p>
										{submission.description ? (
											<p className="mt-2 text-sm text-muted-foreground">
												{submission.description}
											</p>
										) : null}
										<p className="mt-2 text-xs text-muted-foreground">
											{t("systemSettings.libraryReview.meta", {
												count: submission.itemCount,
												date: formatDate(submission.createdAt),
												email: submission.submitter?.email ?? "-",
											})}
										</p>
										{submission.sourceInstanceUrl ? (
											<p className="mt-1 text-xs text-muted-foreground">
												{t("systemSettings.libraryReview.source", {
													source: submission.sourceInstanceUrl,
												})}
											</p>
										) : null}
									</div>
									<div className="flex shrink-0 gap-2">
										<Button
											type="button"
											size="sm"
											disabled={busy}
											onClick={() => approve.mutate({ id: submission.id })}
										>
											{approve.isPending ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : (
												<Check className="mr-2 h-4 w-4" />
											)}
											{t("systemSettings.libraryReview.approve")}
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={busy}
											onClick={() =>
												reject.mutate({
													id: submission.id,
													note: note.trim() || undefined,
												})
											}
										>
											{reject.isPending ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : (
												<X className="mr-2 h-4 w-4" />
											)}
											{t("systemSettings.libraryReview.reject")}
										</Button>
									</div>
								</div>

								<div className="mt-3">
									<Input
										value={note}
										onChange={(event) =>
											setNotes((current) => ({
												...current,
												[submission.id]: event.target.value,
											}))
										}
										placeholder={t(
											"systemSettings.libraryReview.notePlaceholder",
										)}
										className="text-sm"
									/>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
