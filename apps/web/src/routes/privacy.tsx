import { LegalPage, LegalSection } from "@/components/public/legal-page";
import { legalIdentity } from "@/lib/legal";

export function PrivacyPage() {
	return (
		<LegalPage
			title="Datenschutzerklärung"
			intro="Diese Erklärung beschreibt konkret, welche Personendaten Skedra bearbeitet, welche Inhalte verschlüsselt sind, welche technischen Metadaten lesbar bleiben und wann Daten an externe Dienste übermittelt werden."
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
					Diese Datenschutzerklärung gilt für skedra.xyz, das kostenlose lokale
					Whiteboard, Skedra Cloud, die öffentlichen Freigabe- und
					Präsentationsseiten sowie die von Skedra betriebenen Bibliotheks- und
					API-Dienste. Bei einer selbst gehosteten Skedra-Installation ist die
					jeweilige Betreiberin oder der jeweilige Betreiber für die
					Datenbearbeitung verantwortlich.
				</p>
			</LegalSection>

			<LegalSection title="3. Hosting, Verbindungs- und Protokolldaten">
				<p>
					Die Skedra-Anwendung und ihre primäre Serverinfrastruktur werden auf
					einem VPS von OVHcloud am Standort Frankfurt am Main, Deutschland,
					betrieben. Beim Aufruf können insbesondere IP-Adresse, Zeitpunkt,
					aufgerufene Adresse, HTTP-Methode und Statuscode, Referrer,
					Browser-/Gerätetyp sowie technische Fehlerdaten bearbeitet werden.
					Diese Daten sind für die Auslieferung, Fehleranalyse, Stabilität,
					Missbrauchsabwehr und IT-Sicherheit erforderlich.
				</p>
				<p>
					Cloudflare kann für DNS, TLS, Schutz vor Angriffen, Routing und den
					Cloudflare Tunnel eingesetzt werden. Dabei verarbeitet Cloudflare
					technische Verbindungsdaten, insbesondere IP-Adressen und
					HTTP-Anfragedaten.
				</p>
			</LegalSection>

			<LegalSection title="4. Kostenloses Whiteboard und lokale Speicherung">
				<p>
					Das kostenlose Whiteboard kann ohne Konto verwendet werden. Der
					Canvas-Zustand, Undo-/Redo-Historie, Ansichtsposition, persönliche
					Bibliotheken, Sprache und Darstellung werden je nach Funktion im Local
					Storage, Session Storage oder in IndexedDB des Browsers gespeichert.
					Diese Daten bleiben grundsätzlich auf deinem Gerät und können über die
					Browserfunktionen gelöscht werden.
				</p>
				<p>
					Lokale Browserdaten sind nicht automatisch ein Backup und können beim
					Löschen von Website-Daten, bei einem Browserwechsel oder durch
					Geräteverlust verloren gehen. Eine Übertragung an Skedra erfolgt erst,
					wenn du eine Cloud-, Upload-, Freigabe-, Bibliotheks- oder
					Integrationsfunktion verwendest.
				</p>
			</LegalSection>

			<LegalSection title="5. Konto, Anmeldung und Sitzungen">
				<p>Bei Registrierung und Kontonutzung bearbeiten wir insbesondere:</p>
				<ul>
					<li>Name, E-Mail-Adresse, Profilbild und Verifizierungsstatus;</li>
					<li>
						einen durch das Authentifizierungssystem geschützten Passwort-Hash,
						nicht dein Klartextpasswort;
					</li>
					<li>Sitzungs-Token, Ablaufzeit, IP-Adresse und User-Agent;</li>
					<li>Sprache, Darstellung und Benachrichtigungseinstellungen;</li>
					<li>
						Registrierungs-, Einladungs-, Verifizierungs- und
						Passwort-Reset-Daten mit jeweiliger Ablaufzeit.
					</li>
				</ul>
				<p>
					Diese Bearbeitungen dienen der Kontoerstellung, Anmeldung,
					E-Mail-Verifizierung, Zugriffskontrolle, Betrugs- und
					Missbrauchsprävention sowie der Wiederherstellung des Kontozugangs.
				</p>
			</LegalSection>

			<LegalSection title="6. Cloud-Boards und Verschlüsselungsmodi">
				<p>
					Skedra bietet zwei Verschlüsselungsmodi. Die Auswahl wird beim
					Speichern eines Boards angezeigt:
				</p>
				<ul>
					<li>
						<strong>Ende-zu-Ende-Verschlüsselung (E2EE):</strong>{" "}
						Canvas-Inhalte, Y.js-Updates, Live-Presence-Daten und Bildinhalte
						werden im Browser mit einem Board-Schlüssel verschlüsselt. Der
						Server speichert und überträgt bei ordnungsgemässer Verwendung nur
						den Ciphertext. Der private E2EE-Identitätsschlüssel wird mit dem
						Kontopasswort oder einem separaten E2EE-Sicherheitscode
						verschlüsselt; Board-Schlüssel werden für berechtigte Empfänger
						individuell verschlüsselt.
					</li>
					<li>
						<strong>Serververwaltete Verschlüsselung:</strong> Canvas-Updates
						werden mit AES-256-GCM verschlüsselt gespeichert. Da der
						Skedra-Server den hierfür benötigten Instanzschlüssel verwaltet,
						kann er diese Inhalte zur Bereitstellung der Funktionen
						entschlüsseln. Dieser Modus ist keine Ende-zu-Ende-Verschlüsselung.
					</li>
				</ul>
				<p>
					Auch bei E2EE bleiben notwendige Metadaten serverlesbar. Dazu gehören
					insbesondere Board-ID und -Name, Eigentümer, Team und Ordner,
					Mitglieder und Rollen, Verschlüsselungsmodus, Zeitstempel,
					Freigabestatus und Freigabe-Token, Aktivitätsereignisse,
					Dateimetadaten und kryptografische Schlüsselprüfwerte. Kommentare,
					AI-Verläufe und Bibliotheksinhalte sind derzeit nicht Teil der
					Board-E2EE.
				</p>
				<p>
					Der Browser kann E2EE-Board-Schlüssel lokal speichern, damit Boards
					nach einem erneuten Aufruf geöffnet werden können. Personen mit
					Zugriff auf dein entsperrtes Gerät oder Browserprofil könnten deshalb
					auch auf lokal gespeicherte Schlüssel zugreifen.
				</p>
			</LegalSection>

			<LegalSection title="7. Zusammenarbeit, Kommentare und Freigabelinks">
				<p>
					Für Teams und Zusammenarbeit speichern wir Team- und Ordnernamen,
					Mitgliedschaften, Rollen, Berechtigungen, Einladungsadressen und
					Aktivitätsereignisse. Live-Cursor und Auswahlzustände werden nur
					flüchtig übertragen; bei E2EE-Boards sind diese Presence-Nachrichten
					clientseitig verschlüsselt.
				</p>
				<p>
					Kommentartexte, Autor, Position und Zeitstempel werden strukturiert
					und serverlesbar in der Datenbank gespeichert – auch bei einem
					E2EE-Board. Bei Erwähnungen kann ein Ausschnitt des Kommentars per
					E-Mail an die erwähnte Person gesendet werden.
				</p>
				<p>
					Wenn du Präsentations-, Kollaborations- oder Embed-Links aktivierst,
					können Personen mit dem Link im gewählten Umfang auf das Board
					zugreifen. Bei E2EE-Freigaben kann der benötigte Schlüssel im
					URL-Fragment weitergegeben werden; dieses Fragment wird vom Browser
					nicht als Teil der HTTP-Anfrage an den Server gesendet. Du bist dafür
					verantwortlich, Freigabelinks nur an vorgesehene Empfänger zu senden
					und sie bei Bedarf zu deaktivieren oder neu zu erzeugen.
				</p>
			</LegalSection>

			<LegalSection title="8. Bilder, Objekt-Speicher und Backups">
				<p>
					Bilddateien werden vor dem Upload im Browser mit AES-256-GCM
					verschlüsselt. Im E2EE-Modus wird der Schlüssel aus dem geheimen
					Board-Schlüssel abgeleitet. Im serververwalteten Modus ist der
					Dateischlüssel über den serverlesbaren Board-Zustand verfügbar. Der
					Objekt-Speicher erhält verschlüsselte Dateiinhalte sowie technische
					Metadaten wie Objektpfad, Dateityp, Grösse, Prüfsumme, Board- und
					Eigentümer-ID.
				</p>
				<p>
					Für den privaten Objekt-Speicher und verschlüsselte Datenbank-Backups
					wird Cloudflare R2 eingesetzt. Datenbank-Backups werden vor dem Upload
					zusätzlich mit <code>age</code> verschlüsselt. Die technische
					Standardaufbewahrung der Backups beträgt 14 Tage; abweichende
					gesetzliche oder betriebliche Sicherungsfristen bleiben vorbehalten.
				</p>
			</LegalSection>

			<LegalSection title="9. Abonnements und Zahlungen über Stripe">
				<p>
					Für Skedra-Cloud-Abonnements verwenden wir Stripe. An Stripe werden
					insbesondere Name, E-Mail-Adresse, Skedra-Benutzer-ID, ausgewählter
					Tarif sowie – im Checkout – Rechnungsadresse und gegebenenfalls
					Steuer-ID übermittelt. Stripe verarbeitet die Zahlungsdaten direkt.
					Skedra speichert selbst insbesondere Stripe-Kunden-, Subscription- und
					Preis-ID, Subscription-Status, Laufzeit, Kündigungsstatus und
					Webhook-Ereignis-IDs, jedoch keine vollständigen Kartenangaben.
				</p>
			</LegalSection>

			<LegalSection title="10. E-Mail-Versand">
				<p>
					Für Verifizierung, Passwort-Reset, Einladungen, Erwähnungen und
					weitere transaktionale Nachrichten übermitteln wir Empfängeradresse,
					Name, Betreff und Nachrichteninhalt an den konfigurierten SMTP-Dienst.
					Kommentarbenachrichtigungen können Boardname, Autorenname, einen
					Kommentar-Ausschnitt und einen Board-Link enthalten. Die
					SMTP-Verbindung verwendet TLS beziehungsweise erzwungenes STARTTLS.
				</p>
			</LegalSection>

			<LegalSection title="11. Audio-Kommunikation über LiveKit">
				<p>
					Wenn Audio-Sitzungen aktiviert und von dir gestartet werden,
					verarbeitet die konfigurierte LiveKit-Instanz einen kurzlebigen
					Teilnahme-Token, Anzeigename, pseudonymisierte Teilnehmer-ID,
					Benutzer- und Board-ID, Zugriffsrolle sowie den übertragenen
					Mikrofon-Audiostream. Skedra zeichnet Audio nicht selbst auf. Bei
					einer selbst betriebenen LiveKit-Instanz erfolgt die Verarbeitung auf
					der eigenen Infrastruktur; bei LiveKit Cloud gelten zusätzlich deren
					Datenschutzbedingungen.
				</p>
			</LegalSection>

			<LegalSection title="12. AI-Funktionen und externe AI-Anbieter">
				<p>
					AI-Funktionen werden nur auf deine aktive Eingabe hin verwendet. Der
					Prompt und bis zu acht vorherige Chat-Nachrichten werden an den von
					dir gewählten Anbieter übermittelt. Unterstützt werden OpenAI,
					OpenRouter, DeepSeek, Kimi/Moonshot AI sowie selbst konfigurierte
					lokale oder OpenAI-kompatible Endpunkte. Welche Staaten und
					Datenschutzbedingungen gelten, hängt vom gewählten Anbieter und
					Endpunkt ab.
				</p>
				<p>
					Prompts und AI-Antworten werden mit Benutzer- und Board-ID, Rolle,
					Modell, Zeitstempel und Ergebnisgrösse serverlesbar in PostgreSQL
					gespeichert, bis du den Verlauf löschst oder die zugehörigen Daten
					gelöscht werden. AI-Chatverläufe sind auch bei E2EE-Boards nicht
					Ende-zu-Ende-verschlüsselt. Eigene AI-API-Schlüssel werden mit dem
					serverseitigen Instanzschlüssel verschlüsselt gespeichert und für die
					Anfrage an den ausgewählten Anbieter entschlüsselt.
				</p>
			</LegalSection>

			<LegalSection title="13. Notion-, Obsidian- und sonstige Integrationen">
				<p>
					Integrationen werden nur nach deiner Konfiguration aktiviert. Bei
					Notion werden insbesondere Boardname, Board-Link, öffentlicher
					Embed-Link und Synchronisationszeit an Notion übertragen. Bei einer
					Obsidian-Integration werden entsprechende Markdown-Inhalte an den von
					dir angegebenen Endpunkt gesendet. Die Aktivierung kann einen
					öffentlichen Read-only-Embed-Link für das Board erzeugen.
					Integrationstoken werden serverseitig verschlüsselt gespeichert.
				</p>
			</LegalSection>

			<LegalSection title="14. Shape Libraries und öffentliche Einreichungen">
				<p>
					Persönliche Shape Libraries werden als serverlesbare JSON-Daten mit
					deinem Konto synchronisiert. Wenn du eine Library veröffentlichst oder
					zur Prüfung einreichst, speichern wir je nach Formular Name, Slug,
					Beschreibung, Autor, Einreichername und -E-Mail, Quellinstanz,
					Lizenzbestätigung, Library-Inhalt, Prüfstatus und Zeitstempel.
					Veröffentlichte Libraries und die angegebenen Autoreninformationen
					sind öffentlich abrufbar.
				</p>
			</LegalSection>

			<LegalSection title="15. Cookies und vergleichbare Technologien">
				<p>
					Skedra verwendet technisch notwendige Cookies für Anmeldung und
					Sitzungsverwaltung sowie Local Storage, Session Storage und IndexedDB
					für Canvas-Daten, E2EE-Schlüssel, ausstehende verschlüsselte Updates,
					Ansichtspositionen, Undo-Historie, Sprache, Darstellung und
					Bibliotheken. Es werden derzeit keine Werbe-Cookies eingesetzt. Falls
					später optionale Analyse- oder Marketingdienste hinzukommen, wird
					diese Erklärung aktualisiert und eine erforderliche Einwilligung
					eingeholt.
				</p>
			</LegalSection>

			<LegalSection title="16. Empfänger und Bekanntgaben ins Ausland">
				<p>
					Je nach verwendeter Funktion können Daten an folgende Kategorien und
					Anbieter gelangen:
				</p>
				<ul>
					<li>
						<strong>OVHcloud:</strong> Hosting in Frankfurt am Main,
						Deutschland;
					</li>
					<li>
						<strong>Cloudflare:</strong> DNS, TLS, Sicherheits- und
						Routingdienste sowie R2-Objekt-Speicher; Cloudflare ist ein
						US-Anbieter und kann Daten innerhalb seines globalen Netzwerks
						bearbeiten;
					</li>
					<li>
						<strong>Stripe:</strong> Zahlungs- und Abonnementabwicklung über
						europäische und gegebenenfalls US-amerikanische
						Gruppengesellschaften;
					</li>
					<li>
						<strong>SMTP-Dienst:</strong> Versand transaktionaler E-Mails
						entsprechend dem jeweils konfigurierten Anbieter;
					</li>
					<li>
						<strong>LiveKit:</strong> nur bei aktivierter Audio-Funktion, selbst
						gehostet oder über LiveKit Cloud;
					</li>
					<li>
						<strong>AI-Anbieter:</strong> abhängig von deiner Auswahl
						insbesondere USA bei OpenAI/OpenRouter oder China bei DeepSeek/Kimi;
					</li>
					<li>
						<strong>Notion oder benutzerdefinierte Endpunkte:</strong> nur bei
						aktivierter Integration.
					</li>
				</ul>
				<p>
					Bei Bekanntgaben in Staaten ohne vom Schweizer Bundesrat anerkanntes
					angemessenes Datenschutzniveau stützen wir uns, soweit erforderlich,
					auf geeignete Garantien wie anerkannte Standardvertragsklauseln oder
					auf eine gesetzliche Ausnahme. Bei von dir selbst gewählten Anbietern
					und Endpunkten bestimmst du den Empfänger mit.
				</p>
			</LegalSection>

			<LegalSection title="17. Aufbewahrung und Löschung">
				<ul>
					<li>
						Lokale Whiteboard-Daten bleiben im Browser, bis du sie oder die
						Website-Daten löschst.
					</li>
					<li>
						Konto-, Team-, Board- und Bibliotheksdaten bleiben grundsätzlich bis
						zur Löschung des jeweiligen Inhalts oder Kontos gespeichert.
					</li>
					<li>
						Archivierte Boards bleiben bis zur endgültigen Löschung im
						Papierkorb erhalten.
					</li>
					<li>
						Kommentare bleiben bis zur Löschung des Kommentars oder Boards
						erhalten.
					</li>
					<li>
						AI-Verläufe bleiben bis zur manuellen Löschung des Verlaufs oder der
						zugehörigen Daten erhalten.
					</li>
					<li>
						Sitzungen, Einladungen und Verifikationsdaten werden nach Ablauf
						beziehungsweise Widerruf ungültig und im Rahmen der technischen
						Bereinigung gelöscht.
					</li>
					<li>
						Verschlüsselte Datenbank-Backups werden standardmässig 14 Tage
						aufbewahrt.
					</li>
					<li>
						Abrechnungs- und Geschäftsunterlagen können aufgrund gesetzlicher
						Aufbewahrungspflichten länger gespeichert werden.
					</li>
				</ul>
				<p>
					Bei einer Löschung können Daten bis zum Ablauf der Backup-Rotation in
					verschlüsselten Sicherungen verbleiben. Sie werden dort nicht für den
					laufenden Betrieb verwendet und mit der regulären Rotation entfernt.
				</p>
			</LegalSection>

			<LegalSection title="18. Datensicherheit">
				<p>
					Wir verwenden angemessene technische und organisatorische Massnahmen,
					darunter TLS für die Übertragung, rollenbasierte Zugriffskontrollen,
					Rate-Limits, private Objekt-Speicher, AES-256-GCM für geschützte
					Inhalte und Geheimnisse, clientseitige E2EE für entsprechend gewählte
					Boards sowie zusätzlich verschlüsselte Offsite-Backups. Kein Verfahren
					kann absolute Sicherheit garantieren.
				</p>
			</LegalSection>

			<LegalSection title="19. Rechte betroffener Personen">
				<p>
					Im Rahmen des anwendbaren Rechts kannst du insbesondere Auskunft,
					Berichtigung, Löschung, Herausgabe oder Einschränkung der Bearbeitung
					verlangen, einer Bearbeitung widersprechen oder eine Einwilligung
					widerrufen. Richte Anfragen an {legalIdentity.email}. Du kannst dich
					zudem an den Eidgenössischen Datenschutz- und
					Öffentlichkeitsbeauftragten (EDÖB) oder eine sonst zuständige
					Datenschutzaufsichtsbehörde wenden.
				</p>
			</LegalSection>

			<LegalSection title="20. Änderungen">
				<p>
					Wir passen diese Datenschutzerklärung an, wenn sich Funktionen,
					Infrastruktur, Dienstleister oder Rechtslagen ändern. Es gilt die
					jeweils auf dieser Seite veröffentlichte Fassung.
				</p>
			</LegalSection>
		</LegalPage>
	);
}
