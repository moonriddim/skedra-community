import { LegalPage, LegalSection } from "@/components/public/legal-page";
import { legalIdentity } from "@/lib/legal";

export function PrivacyPage() {
	return (
		<LegalPage
			title="Datenschutzerklärung"
			intro="Diese Erklärung informiert darüber, welche Personendaten bei der Nutzung von Skedra bearbeitet werden, zu welchen Zwecken dies geschieht und welche Rechte betroffene Personen haben."
		>
			<LegalSection title="1. Verantwortliche Stelle">
				<p>
					<strong>{legalIdentity.operator}</strong>
					<br />
					{legalIdentity.address}
					<br />
					E-Mail: {legalIdentity.email}
				</p>
			</LegalSection>

			<LegalSection title="2. Geltungsbereich">
				<p>
					Diese Datenschutzerklärung gilt für die öffentlich erreichbare
					Website, das kostenlose lokale Whiteboard und die kostenpflichtigen
					Skedra-Cloud-Funktionen. Für selbst gehostete Installationen ist die
					jeweilige Betreiberin oder der jeweilige Betreiber verantwortlich.
				</p>
			</LegalSection>

			<LegalSection title="3. Welche Daten wir bearbeiten">
				<ul>
					<li>
						<strong>Besuchs- und Protokolldaten:</strong> IP-Adresse, Zeitpunkt,
						aufgerufene URL, Browser- und Geräteinformationen sowie technische
						Fehlerdaten.
					</li>
					<li>
						<strong>Konto- und Stammdaten:</strong> Name, E-Mail-Adresse,
						verschlüsselte Zugangsdaten, Einstellungen und Teamzugehörigkeiten.
					</li>
					<li>
						<strong>Nutzungs- und Inhaltsdaten:</strong> Board-Metadaten,
						Freigaben, Kommentare, Aktivitäten sowie hochgeladene Dateien.
						Ende-zu-Ende-verschlüsselte Board-Inhalte können von Skedra nicht im
						Klartext gelesen werden.
					</li>
					<li>
						<strong>Abrechnungsdaten:</strong> Tarif, Subscription-Status,
						Stripe-Kunden- und Subscription-IDs. Vollständige Zahlungsdaten
						werden direkt durch Stripe verarbeitet.
					</li>
					<li>
						<strong>Kommunikationsdaten:</strong> Nachrichten und technische
						Angaben, wenn du Support kontaktierst oder transaktionale E-Mails
						erhältst.
					</li>
				</ul>
			</LegalSection>

			<LegalSection title="4. Zwecke der Bearbeitung">
				<p>
					Wir bearbeiten Personendaten, um Skedra bereitzustellen, Konten und
					Berechtigungen zu verwalten, Boards zu synchronisieren, Zusammenarbeit
					zu ermöglichen, Abonnements abzurechnen, Missbrauch und
					Sicherheitsvorfälle zu verhindern, Support zu leisten und gesetzliche
					Pflichten zu erfüllen.
				</p>
			</LegalSection>

			<LegalSection title="5. Kostenloses Whiteboard und lokaler Speicher">
				<p>
					Das kostenlose Whiteboard kann ohne Konto verwendet werden.
					Zeichnungen und Einstellungen werden dabei grundsätzlich lokal im
					Browser gespeichert. Diese Daten verlassen dein Gerät erst, wenn du
					eine Cloud-Funktion, einen Upload, eine Freigabe oder einen externen
					Integrationsdienst bewusst verwendest.
				</p>
			</LegalSection>

			<LegalSection title="6. Cookies und lokale Technologien">
				<p>
					Skedra verwendet technisch notwendige Cookies oder vergleichbare
					Speichertechnologien für Sitzungen, Sprache, Darstellung und
					Sicherheitsfunktionen. Wir setzen keine Werbe-Cookies ein. Werden
					künftig optionale Analysewerkzeuge ergänzt, wird diese Erklärung
					aktualisiert und – soweit erforderlich – vorher eine Einwilligung
					eingeholt.
				</p>
			</LegalSection>

			<LegalSection title="7. Empfänger und Auftragsbearbeiter">
				<p>
					Zur Bereitstellung können Hosting-, Datenbank-, Objekt-Speicher-,
					E-Mail-, Echtzeitkommunikations- und Monitoring-Dienste eingesetzt
					werden. Für Zahlungen verwenden wir Stripe. Anbieter erhalten nur die
					Daten, die für ihre jeweilige Leistung erforderlich sind, und werden
					vertraglich zum angemessenen Schutz verpflichtet.
				</p>
			</LegalSection>

			<LegalSection title="8. Bekanntgabe ins Ausland">
				<p>
					Einzelne Dienstleister können Daten in der Schweiz, im Europäischen
					Wirtschaftsraum, in den USA oder in weiteren Staaten bearbeiten. Bei
					Bekanntgaben in Staaten ohne angemessenes Datenschutzniveau verwenden
					wir geeignete Garantien, insbesondere anerkannte
					Standardvertragsklauseln, soweit keine gesetzliche Ausnahme greift.
				</p>
			</LegalSection>

			<LegalSection title="9. Aufbewahrung und Löschung">
				<p>
					Wir speichern Personendaten nur so lange, wie dies für die genannten
					Zwecke, die Vertragserfüllung, Sicherheitsnachweise oder gesetzliche
					Aufbewahrungspflichten erforderlich ist. Lokale Whiteboard-Daten
					kannst du über deinen Browser löschen. Konto- und Cloud-Daten werden
					nach einer Löschanfrage entfernt, soweit keine gesetzlichen Pflichten
					oder berechtigten Sicherungsinteressen entgegenstehen.
				</p>
			</LegalSection>

			<LegalSection title="10. Datensicherheit">
				<p>
					Wir verwenden angemessene technische und organisatorische Maßnahmen
					wie Transportverschlüsselung, Zugriffskontrollen, verschlüsselte
					Speicherung und – bei entsprechend gewählten Boards –
					Ende-zu-Ende-Verschlüsselung. Kein Verfahren kann jedoch absolute
					Sicherheit garantieren.
				</p>
			</LegalSection>

			<LegalSection title="11. Rechte betroffener Personen">
				<p>
					Im Rahmen des anwendbaren Rechts kannst du insbesondere Auskunft,
					Berichtigung, Löschung, Herausgabe oder Einschränkung der Bearbeitung
					verlangen sowie einer Bearbeitung widersprechen oder eine Einwilligung
					widerrufen. Richte Anfragen an {legalIdentity.email}. Du hast zudem
					das Recht, dich an die zuständige Datenschutzaufsichtsbehörde zu
					wenden.
				</p>
			</LegalSection>

			<LegalSection title="12. Änderungen">
				<p>
					Wir können diese Datenschutzerklärung anpassen, wenn sich Funktionen,
					Dienstleister oder Rechtslagen ändern. Es gilt die jeweils auf dieser
					Seite veröffentlichte Fassung.
				</p>
			</LegalSection>
		</LegalPage>
	);
}
