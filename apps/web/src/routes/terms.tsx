import { LegalPage, LegalSection } from "@/components/public/legal-page";
import { legalIdentity } from "@/lib/legal";

export function TermsPage() {
	return (
		<LegalPage
			title="Allgemeine Geschäftsbedingungen"
			intro="Diese AGB regeln die Nutzung des kostenlosen Skedra Whiteboards und der kostenpflichtigen Skedra-Cloud-Dienste."
		>
			<LegalSection title="1. Anbieterin und Geltungsbereich">
				<p>
					Anbieterin ist {legalIdentity.operator}, {legalIdentity.address}.
					Diese AGB gelten für alle Verträge über Skedra Cloud sowie ergänzend
					für die Nutzung der öffentlich bereitgestellten Skedra-Dienste.
				</p>
			</LegalSection>

			<LegalSection title="2. Kostenloses Whiteboard">
				<p>
					Das kostenlose Whiteboard kann ohne Konto verwendet werden. Inhalte
					werden grundsätzlich lokal im Browser gespeichert. Nutzerinnen und
					Nutzer sind selbst dafür verantwortlich, wichtige Inhalte regelmäßig
					als Datei zu sichern. Ein Anspruch auf dauerhafte Verfügbarkeit oder
					Wiederherstellung lokaler Browserdaten besteht nicht.
				</p>
			</LegalSection>

			<LegalSection title="3. Konto und Vertragsabschluss">
				<p>
					Für Skedra Cloud ist ein persönliches Konto und ein aktives Abonnement
					erforderlich. Der Vertrag kommt zustande, wenn der ausgewählte Tarif
					im Stripe-Checkout zahlungspflichtig bestätigt wurde. Angaben bei der
					Registrierung müssen vollständig und korrekt sein. Zugangsdaten dürfen
					nicht an Dritte weitergegeben werden.
				</p>
			</LegalSection>

			<LegalSection title="4. Leistungen von Skedra Cloud">
				<p>
					Der konkrete Leistungsumfang ergibt sich aus der zum Zeitpunkt des
					Vertragsschlusses veröffentlichten Preisseite. Dazu können
					Cloud-Speicherung, Synchronisierung, Freigaben, Zusammenarbeit, Teams,
					Kommentare, Präsentationen, API-Zugänge und Integrationen gehören.
					Beta- oder Vorschaufunktionen können geändert oder eingestellt werden.
				</p>
			</LegalSection>

			<LegalSection title="5. Preise, Zahlung und Steuern">
				<p>
					Es gelten die auf der Preisseite und im Checkout angezeigten Preise.
					Wiederkehrende Entgelte werden zu Beginn des jeweiligen
					Abrechnungszeitraums über Stripe belastet. Angezeigte Preise verstehen
					sich inklusive oder zuzüglich anwendbarer Steuern entsprechend der
					Darstellung im Checkout.
				</p>
			</LegalSection>

			<LegalSection title="6. Laufzeit und Kündigung">
				<p>
					Monatsabonnements laufen jeweils einen Monat, Jahresabonnements ein
					Jahr und verlängern sich automatisch um den gleichen Zeitraum, sofern
					sie nicht vor der nächsten Verlängerung im Kundenportal gekündigt
					werden. Nach einer Kündigung bleibt der Zugang bis zum Ende des
					bereits bezahlten Zeitraums bestehen. Gesetzliche
					Rückerstattungsansprüche bleiben vorbehalten.
				</p>
			</LegalSection>

			<LegalSection title="7. Inhalte und Nutzungsrechte">
				<p>
					Rechte an hochgeladenen oder erstellten Inhalten verbleiben bei den
					Nutzerinnen und Nutzern. Sie räumen Skedra die technisch
					erforderlichen Rechte ein, um Inhalte zu speichern, zu übertragen, zu
					sichern und für berechtigte Empfänger bereitzustellen. Wer Inhalte
					teilt, muss über die dafür notwendigen Rechte verfügen.
				</p>
			</LegalSection>

			<LegalSection title="8. Zulässige Nutzung">
				<p>
					Untersagt sind insbesondere rechtswidrige Inhalte, Verletzungen
					fremder Rechte, Schadsoftware, automatisierte Überlastungsversuche,
					Umgehung von Zugriffskontrollen sowie eine Nutzung, die die Sicherheit
					oder Verfügbarkeit von Skedra beeinträchtigt. Bei erheblichen oder
					wiederholten Verstößen kann der Zugang eingeschränkt oder gesperrt
					werden.
				</p>
			</LegalSection>

			<LegalSection title="9. Verfügbarkeit und Wartung">
				<p>
					Skedra bemüht sich um eine hohe Verfügbarkeit, schuldet jedoch keine
					unterbrechungsfreie Leistung, soweit nicht ausdrücklich anders
					vereinbart. Wartung, Sicherheitsupdates, Störungen von Drittanbietern
					und Ereignisse außerhalb unseres Einflussbereichs können zu
					Einschränkungen führen.
				</p>
			</LegalSection>

			<LegalSection title="10. Gewährleistung und Haftung">
				<p>
					Skedra haftet unbeschränkt für vorsätzlich oder grobfahrlässig
					verursachte Schäden sowie in Fällen zwingender gesetzlicher Haftung.
					Im Übrigen ist die Haftung – soweit gesetzlich zulässig – auf
					typische, vorhersehbare direkte Schäden begrenzt. Die Haftung für
					indirekte Schäden, entgangenen Gewinn und Datenverluste ist
					ausgeschlossen, sofern keine zwingenden gesetzlichen Bestimmungen
					entgegenstehen.
				</p>
			</LegalSection>

			<LegalSection title="11. Datenschutz">
				<p>
					Informationen zur Bearbeitung von Personendaten enthält die{" "}
					<a href="/privacy">Datenschutzerklärung</a>.
				</p>
			</LegalSection>

			<LegalSection title="12. Änderungen dieser AGB">
				<p>
					Wir können diese AGB aus sachlichen Gründen anpassen, insbesondere bei
					Änderungen von Leistungen oder Rechtslage. Wesentliche Änderungen für
					laufende Abonnements werden in angemessener Form angekündigt.
					Widerspricht eine Nutzerin oder ein Nutzer, kann das Abonnement zum
					Ende des laufenden Zeitraums beendet werden.
				</p>
			</LegalSection>

			<LegalSection title="13. Schlussbestimmungen">
				<p>
					Es gilt Schweizer Recht unter Ausschluss kollisionsrechtlicher
					Bestimmungen, soweit zwingendes Verbraucherrecht nichts anderes
					vorsieht. Für Klagen von Konsumentinnen und Konsumenten gelten die
					zwingenden gesetzlichen Gerichtsstände. Im Übrigen ist Gerichtsstand,
					soweit eine Gerichtsstandsvereinbarung zulässig ist, Laufenburg,
					Kanton Aargau. Sollten einzelne Bestimmungen unwirksam sein, bleiben
					die übrigen Bestimmungen wirksam.
				</p>
			</LegalSection>
		</LegalPage>
	);
}
