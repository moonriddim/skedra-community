import { PublicSiteLayout } from "@/components/public/public-site-layout";
export function PrivacyPage() {
	return (
		<PublicSiteLayout>
			<article className="mx-auto max-w-3xl px-6 py-16">
				<h1 className="mb-6 text-3xl font-semibold">
					Privacy on this instance
				</h1>
				<p className="leading-7 text-muted-foreground">
					This Skedra instance is operated by its administrator. Accounts,
					boards, uploaded files and collaboration data are stored on the
					configured infrastructure. Skedra does not send installation reports
					or product analytics to a central Skedra service. Optional
					integrations contact the providers configured by you or your
					administrator. Contact the instance operator about access, retention,
					backups and deletion of your data.
				</p>
			</article>
		</PublicSiteLayout>
	);
}
