# Ergänzende lokale Sicherheitsprüfung vom 10.10.2026

Geprüft: lokaler Arbeitsstand auf Basis von `3f60ab94a8362368d8f8e7964b9ea2b09c966f04`, einschließlich der bereits vorhandenen Sicherheitskorrekturen. **Patch-Stand: Alle drei nachfolgend historisch beschriebenen Befunde sind im lokalen Code behoben. Noch kein Deployment.** Die ursprünglichen Nachweise wurden zu Regressionstests mit sicheren Erwartungen umgestellt. Umsetzung und Prüfung stehen am Ende dieses Berichts.

Keine Links aus der E-Mail geöffnet, keine Produktivsysteme angesprochen, keine echten Nutzer, Datenbankverbindungen, E-Mails oder Netzwerkrequests verwendet. Die Nachweise verwenden echte Router beziehungsweise Funktionen mit simulierten Datenbankantworten und abgefangenem `fetch`. Die Bewertung betrifft den lokalen Code; produktiver Commit, externe Firewall und Proxy-Konfiguration sind unbekannt. Dies ist eine gezielte Prüfung, kein vollständiger Penetrationstest.

## F1 — Hohe Priorität: weitere SSRF über die Obsidian-Synchronisierung

**Stellen:** `apps/api/src/trpc/routers/integrations.ts:118` und `:168`; `apps/api/src/lib/integration-sync.ts:251`.

`saveObsidian` akzeptiert eine beliebige syntaktisch gültige URL. `syncNow` führt anschließend einen serverseitigen HTTP-PUT an diese Adresse mit angehängtem `/vault/<Pfad>` aus. Anders als bei den korrigierten KI-Providern gilt hier keine Einschränkung für den Managed-Modus. Weder Loopback/private Adressen noch HTTP-Weiterleitungen werden ausgeschlossen. Bei Fehlerantworten gelangen bis zu 300 Zeichen des Antworttexts über `lastSyncError` zum aufrufenden Nutzer. Es gibt außerdem keinen expliziten Request-Timeout.

**Voraussetzungen:** angemeldeter Nutzer mit Produktzugang und `canManageShare` auf einem Board, beispielsweise der Besitzer seines eigenen Boards. Kein instanzweiter Administratorzugang erforderlich.

**Lokaler Nachweis F1:** Im Managed-Modus wird über den echten Router `http://127.0.0.1:27123` gespeichert. Ein anschließendes `syncNow` erreicht den abgefangenen Netzwerkaufruf `PUT http://127.0.0.1:27123/vault/audit.md`. Der künstliche interne Fehlertext wird an den Aufrufer zurückgegeben. Es erfolgte keine Verbindung zu diesem Ziel.

**Auswirkung:** Zugriff auf aus dem API-Server erreichbare interne HTTP-Dienste und mögliche Änderungen dort, sofern diese den PUT mit dem vorgegebenen Markdown-Inhalt verarbeiten. Interne Fehlerantworten können Informationen offenlegen. Beliebige Methoden, beliebige Request-Bodies, Zugriff auf Cloud-Zugangsdaten oder eine vollständige Serverübernahme wurden nicht nachgewiesen. Das Verhalten von DNS-Rebinding/Redirects wurde hier nicht separat ausgeführt.

**Korrektur:** Für Managed-Instanzen benutzerdefinierte Obsidian-Endpunkte sowohl beim Speichern als auch bei der Ausführung sperren, falls die Integration nur für Selfhosting gedacht ist. Bereits gespeicherte Konfigurationen müssen ebenfalls abgewiesen werden. Falls Cloud-Unterstützung benötigt wird: administrativ festgelegte Ziele oder abgesicherter Egress-Dienst, der Zieladressen inklusive DNS-Auflösung und sämtlicher Redirects kontrolliert. Zusätzlich Request-Timeout, begrenztes Lesen von Antworten und keine internen Antworttexte an Benutzer. Ein reiner Hostnamenvergleich ist kein hinreichender SSRF-Schutz.

## F2 — Mittlere Priorität: Admin-Herabstufung über Einladungsfunktion

**Stellen:** `apps/api/src/trpc/routers/team.ts:311`, insbesondere `:328` und `:380`; korrekter Vergleichspfad `:430`.

`updateMemberRole` verlangt `canManageWorkspaceAdmins`, wenn entweder die vorhandene oder die gewünschte Rolle `admin` ist. `inviteMember` prüft dagegen nur die gewünschte Rolle. Ist die eingeladene E-Mail bereits Mitglied des Teams, überschreibt die Funktion dessen vorhandene Rolle. Der Standardwert `workspaceRole: "member"` umgeht so den Schutz vorhandener Admins; ohne `roleId` wird zusätzlich die Rollenzuordnung gelöscht.

**Voraussetzungen:** Angreifer ist bereits Workspace-Admin, besitzt jedoch nicht das separate Recht zur Verwaltung anderer Workspace-Admins. Ziel ist ein anderer Admin desselben Teams. Dies ist keine Eskalation eines normalen Mitglieds und kein Nachweis einer Änderung des Workspace-Eigentümers (`teams.ownerId`).

**Lokaler Nachweis F2:** Derselbe Nutzer erhält bei `updateMemberRole({ userId: target, workspaceRole: "member" })` einen Berechtigungsfehler ohne Schreibzugriff. `inviteMember({ email: targetEmail })` gelingt dagegen und schreibt `{ roleId: null, workspaceRole: "member" }` für das vorhandene Admin-Mitglied.

**Auswirkung:** Unberechtigter Entzug von Admin-Rechten und Störung der Workspace-Verwaltung.

**Korrektur:** Rollenänderungen über bestehende Einladungen mit derselben Prüfung für bestehende und gewünschte Rolle absichern. Alternativ bei bereits vorhandenen Mitgliedern keine Rollenänderungen über `inviteMember` erlauben. Berechtigungsprüfung und Mutation gegen gleichzeitige Rollenänderungen absichern. Tests für eingeschränkte Admins, normale Mitglieder, Eigentümer und bereits vorhandene Zielmitglieder ergänzen.

## F3 — Mittlere Priorität: Rechteentzug beendet offene Presence-Verbindungen nicht

**Stellen:** `apps/api/src/index.ts:1366` (`/api/boards/:id/presence`); `apps/api/src/lib/board-presence.ts` (`joinPresenceRoom`, `broadcastPresence`, `fanoutLocal`); `apps/api/src/trpc/routers/whiteboard.ts:2630` (`removeMember`).

Die WebSocket-Route prüft Session, Produktzugang und Board-Zugriff nur beim Verbindungsaufbau. Der Relay hält anschließend den Nutzer und Socket im Raum. Beim Entfernen eines Mitglieds werden die Mitgliedschaft und Schlüsselzuordnung gelöscht, aber bestehende Presence-Verbindungen weder geschlossen noch erneut autorisiert. Der Versand und Empfang bleiben möglich, solange die Verbindung besteht.

**Voraussetzungen:** zuvor berechtigtes Board-Mitglied mit bereits geöffnetem Presence-WebSocket, das die Verbindung nach Entzug seiner Mitgliedschaft weiter betreibt.

**Lokaler Nachweis F3:** Der unveränderte Presence-Handler wird mit dem TypeScript-Parser direkt aus `index.ts` extrahiert und isoliert ausgeführt, ohne den API-Server zu starten. Echte `getBoardAccess`-, Presence-Relay- und `whiteboard.removeMember`-Funktionen werden genutzt; Datenbank und Socket sind simuliert. Nach Entfernen des Mitglieds verweigern `getBoardAccess` und ein neuer Verbindungsaufbau den Zugang. Die bereits offene Verbindung empfängt dennoch eine anschließend gesendete Nachricht des Besitzers und sendet eigene Nachrichten an ihn.

**Auswirkung:** Fortgesetzter Empfang und Versand von Anwesenheitsdaten (unter anderem Cursor, Auswahl und Namen, abhängig vom Clientformat). Bei E2EE bleibt die Nutzbarkeit vom Besitz passender Schlüssel abhängig. Kein Nachweis eines fortbestehenden Zugriffs auf sämtliche Board-Inhalte oder eines Bypasses der normalen Board-API.

**Korrektur:** Mitgliedschafts- und Rollenentzug sowie Session-Widerruf an alle API-Instanzen verteilen und betroffene Verbindungen schließen. Zusätzlich zeitlich begrenzte Autorisierung mit erneuter Prüfung für länger laufende Verbindungen vorsehen; reine Prüfung bei eingehenden Nachrichten schützt passive Empfänger nicht. Vergleichbare Lebenszyklen bei SSE und Präsentationskanälen mitprüfen. Beim Präsentations-Publisher fällt im Code ebenfalls die einmalige Zugriffsprüfung auf; dessen Verhalten wurde hier nicht als eigener reproduzierter Befund bewertet.

## Reproduktion und Ergebnis

Aus `apps/api` ausführen:

```powershell
node --import tsx ../../scripts/security-audit-2026-10-10-followup.mjs
```

Ursprüngliches Ergebnis vor der Korrektur: **3 von 3 Schwachstellen reproduziert.** Das Skript prüft inzwischen die umgekehrten, sicheren Erwartungen: Cloud-Obsidian wird abgewiesen, Einladungen ändern vorhandene Rollen nicht und entfernte Mitglieder erhalten oder senden keine weiteren Presence-Nachrichten. Alle drei Regressionen bestehen.

Weitere gesichtete Bereiche: Board-Freigaben, Rechteprüfungen, Asset-Zugriff/Uploads, Kontoverwaltung und Bibliothekseinreichungen. Hieraus folgt keine Vollständigkeits- oder Sicherheitsgarantie. Insbesondere wurde keine Lastprüfung durchgeführt. Produktivsysteme und tatsächliche Erreichbarkeit interner Dienste wurden nicht untersucht.

## Umgesetzte Korrekturen und Prüfung

- **F1:** `saveObsidian` und die gemeinsame Ausführungsfunktion `runBoardIntegrationSync` sperren Obsidian im Managed-Modus. Damit sind auch vorher gespeicherte Konfigurationen gesperrt, bevor Netzwerkaufrufe oder Änderungen an Embed-Freigaben stattfinden. Selfhosting unterstützt lokale Obsidian-Endpunkte weiterhin; Requests lehnen Redirects ab und besitzen ein Timeout von 15 Sekunden. Fehler enthalten nur den HTTP-Status, keine Antwortinhalte interner Dienste.
- **F2:** Einladungen vorhandener Mitglieder sind hinsichtlich der Rollen idempotent. Rollenänderungen erfolgen ausschließlich über die dafür vorgesehene Funktion mit ihren Berechtigungsprüfungen. Bei gleichzeitigem Einfügen verhindert `onConflictDoNothing`, dass eine inzwischen angelegte Mitgliedschaft überschrieben wird. Neue Einladungen bleiben möglich; eingeschränkte Admins dürfen weiterhin keine neuen Admins einladen.
- **F3:** Presence prüft sowohl Sender als auch Empfänger vor der Nachrichtenweitergabe erneut. Die Prüfung liest Session-ID, Nutzerbindung und Ablaufzeit direkt aus der Datenbank, kontrolliert Produktzugang und aktuelle Board-Berechtigung. Gleiches gilt für die Wiederholung gespeicherter Presence-Nachrichten an neue Verbindungen. Der gemeinsame Empfangspfad prüft auch Nachrichten aus dem PostgreSQL-NOTIFY-Bridge. Abgewiesene Verbindungen werden aus dem Raum entfernt, ihre zwischengespeicherten Daten gelöscht und der Socket geschlossen. Ein zusätzlicher 30-Sekunden-Timer prüft ruhende Verbindungen; der Nachrichtenschutz wartet nicht auf diesen Timer. Fehlgeschlagene Prüfungen sperren den Zugang. Überlappende ausgehende Presence-Updates werden verworfen, statt unbegrenzt Datenbankabfragen anzusammeln.

Validierung des lokalen Gesamtstands:

- Vollständige API-Tests: **93 bestanden**, darunter sieben neu ergänzte Sicherheitstests; zwei vorhandene Presence-Tests wurden an die asynchrone Prüfung angepasst.
- Separates Nachweisskript: **3 Regressionen bestanden**, einschließlich des unveränderten, aus dem aktuellen Quelltext extrahierten WebSocket-Handlers und der echten Mitgliedsentfernungsfunktion.
- API-TypeScript-Prüfung (`tsc --noEmit`) erfolgreich. pnpm-Verknüpfungen wurden hierfür außerhalb der Windows-Sandbox aufgelöst.
- Formatierung und Lint der geänderten Dateien geprüft.

Keine Datenbankmigration erforderlich. Zum Rollout müssen alle API-Instanzen den neuen Code erhalten; bestehende Verbindungen alter Prozesse müssen beim Neustart geschlossen werden. Die Presence-Prüfung erzeugt zusätzliche Datenbankabfragen; eine Lastmessung mit vielen gleichzeitigen Board-Nutzern steht aus. Der reale Mehrinstanzbetrieb des NOTIFY-Bridge wurde nicht getestet. Die zuvor zusätzlich erwähnten SSE-/Präsentationskanäle sind durch diese gezielte Presence-Korrektur nicht pauschal abgesichert.
