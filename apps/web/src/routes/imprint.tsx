import { LegalPage, LegalSection } from "@/components/public/legal-page";
import { legalIdentity } from "@/lib/legal";

export function ImprintPage() {
	return (
		<LegalPage
			title="Impressum"
			intro="Angaben zur verantwortlichen Anbieterin von Skedra und Kontaktmöglichkeiten."
		>
			<LegalSection title="Anbieterin">
				<p>
					<strong>{legalIdentity.operator}</strong>
					<br />
					{legalIdentity.address}
				</p>
			</LegalSection>
			<LegalSection title="Kontakt">
				<p>E-Mail: {legalIdentity.email}</p>
			</LegalSection>
			<LegalSection title="Register- und Unternehmensangaben">
				<p>{legalIdentity.uid}</p>
			</LegalSection>
			<LegalSection title="Haftung für Links">
				<p>
					Diese Website kann Links zu externen Websites enthalten. Für deren
					Inhalte und Datenschutzpraktiken sind ausschließlich die jeweiligen
					Betreiber verantwortlich.
				</p>
			</LegalSection>
			<LegalSection title="Urheberrecht">
				<p>
					Inhalte und Gestaltung dieser Website unterliegen dem anwendbaren
					Urheberrecht. Die Open-Source-Bestandteile von Skedra werden unter den
					jeweils im Repository ausgewiesenen Lizenzen bereitgestellt.
				</p>
			</LegalSection>
		</LegalPage>
	);
}
