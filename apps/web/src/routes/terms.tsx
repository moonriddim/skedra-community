import { PublicSiteLayout } from "@/components/public/public-site-layout";
export function TermsPage() {
	return (
		<PublicSiteLayout>
			<article className="mx-auto max-w-3xl px-6 py-16">
				<h1 className="mb-6 text-3xl font-semibold">
					Using this Skedra instance
				</h1>
				<p className="leading-7 text-muted-foreground">
					Skedra is open-source software under AGPL-3.0-only. Your instance
					operator controls registration, user access and infrastructure. There
					is no Skedra subscription or paid feature gate. You retain ownership
					of your original boards and exports. The software license and warranty
					terms are available with the source code.
				</p>
			</article>
		</PublicSiteLayout>
	);
}
