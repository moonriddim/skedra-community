import { LibraryReviewSettings } from "@/components/settings/library-review-settings";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, LibraryBig, ShieldCheck } from "lucide-react";
import { Link } from "react-router";

export function AdminLibrariesPage() {
	const { t } = useI18n();

	return (
		<div className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
			<header className="mb-8 flex flex-col gap-5 rounded-3xl border border-border/80 bg-card/80 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-start gap-4">
					<div className="rounded-2xl bg-primary/10 p-3 text-primary">
						<ShieldCheck className="h-6 w-6" />
					</div>
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
							{t("adminLibraries.eyebrow")}
						</p>
						<h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
							<LibraryBig className="h-6 w-6" />
							{t("adminLibraries.title")}
						</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
							{t("adminLibraries.description")}
						</p>
					</div>
				</div>
				<Button asChild variant="outline" className="shrink-0">
					<Link to="/library">
						<ArrowLeft className="mr-2 h-4 w-4" />
						{t("adminLibraries.back")}
					</Link>
				</Button>
			</header>

			<LibraryReviewSettings />
		</div>
	);
}
