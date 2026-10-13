import { PublicSiteLayout } from "@/components/public/public-site-layout";
export function ImprintPage() {
	return (
		<PublicSiteLayout>
			<article className="mx-auto max-w-3xl px-6 py-16">
				<h1 className="mb-6 text-3xl font-semibold">Instance information</h1>
				<p className="leading-7 text-muted-foreground">
					You are using a self-hosted Skedra instance. The person or
					organization operating this installation is responsible for its
					operation and contact information. For questions about your account or
					stored boards, contact your instance administrator. Project issues and
					source code are available in the Skedra GitHub repository.
				</p>
			</article>
		</PublicSiteLayout>
	);
}
