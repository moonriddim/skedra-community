# Sicherheitsprüfung: OAuth, MCP, KI und Authentifizierung

Stand: 10.10.2026 · geprüfter Commit: `3f60ab94a8362368d8f8e7964b9ea2b09c966f04`.

**Patch-Stand (10.10.2026):** Die drei priorisierten Befunde sind im lokalen Arbeitsstand behoben. Der Passwort-Reset-Limitpfad wurde ebenfalls korrigiert. Die folgenden Befundbeschreibungen dokumentieren den ursprünglichen Zustand. Umsetzung, verbleibende Punkte und Rollout-Hinweise stehen am Ende. Noch kein Deployment.

Gezielte lokale Codeprüfung mit isolierten Nachweisen. Keine Adresse aus der E-Mail geöffnet, keine Anfrage an Skedra-Produktion, keine Registrierungen, keine echten Benutzer oder Datenbankzugriffe. Nur unabhängig recherchierte offizielle OAuth-/MCP-Dokumentation wurde online gelesen. Der produktiv eingesetzte Commit und die tatsächliche Proxy-/Firewall-Konfiguration wurden nicht geprüft. Dies ist kein vollständiger Penetrationstest und keine Bestätigung der Identität des Absenders.

## Einordnung der E-Mail

Die offene Registrierung ist im Code implementiert. Sie ist für sich allein kein Beweis einer Sicherheitslücke: RFC 7591 beschreibt ausdrücklich offene Registrierung ohne Initial Access Token. Eine fremde HTTPS-Callback-Adresse gehört bei Drittanbieter-Clients grundsätzlich zum vorgesehenen Ablauf. Eine globale Domain-Allowlist wäre eine zusätzliche Produktentscheidung, nicht automatisch eine fehlende Protokollanforderung. Quellen: [RFC 7591, Abschnitt 3](https://datatracker.ietf.org/doc/html/rfc7591#section-3), [offene Registrierung, A.1.1](https://datatracker.ietf.org/doc/html/rfc7591#appendix-A.1.1).

Im lokalen Code vorhanden:

- Datenbankgestütztes Limit von 30 Registrierungen pro IP-Hash und Stunde, einschließlich Transaktionssperre gegen parallele Umgehung (`apps/api/src/lib/mcp-oauth.ts:27,180,192`). Wirksamkeit setzt eine vertrauenswürdige IP-Ermittlung am Proxy voraus.
- Anmeldung und explizite Zustimmung; Anzeige der Ziel-Domain und der angeforderten Rechte (`apps/api/src/mcp.ts:224`, `apps/api/src/lib/mcp-consent.ts:20`).
- Exakter Abgleich mit der registrierten Callback-Adresse, PKCE S256, Bindung des Codes an Client, Callback und Ressource sowie einmalige Code-Einlösung (`apps/api/src/lib/mcp-oauth.ts:315,394`).
- HTML-Escaping, CSP und Clickjacking-Schutz auf der Zustimmungsseite.

Wer einer schädlichen App tatsächlich Zugriff erlaubt, kann dadurch Daten freigeben. PKCE verhindert diese bewusste oder erschlichene Freigabe nicht. Die E-Mail zeigt nach ihrem eigenen Inhalt jedoch nur Client-Registrierungen, keine Umgehung von Anmeldung oder Zustimmung. Aus dem Text allein lässt sich weder eine fremde Kontoübernahme noch die Echtheit des Absenders ableiten.

## 1. Priorität hoch: Zustimmungstoken wird als interner API-Zugang akzeptiert

**Status:** mit echten Signier- und Verifikationsfunktionen lokal reproduziert; Benutzerdatenbank ersetzt durch einen Stub.

**Stellen:** `apps/api/src/lib/mcp-oauth.ts:268,274`; `apps/api/src/lib/mcp-internal-auth.ts:22,42,65,74`; `packages/shared/src/api-keys.ts:29`; `apps/api/src/rest/middleware.ts:33`.

OAuth-Zustimmungstoken und interne MCP-Tokens benutzen denselben HMAC-Schlüssel und signieren beide nur den kodierten Payload. Es fehlen eine kryptographische Zwecktrennung und eine strikte Prüfung des Payload-Formats. Durch Voranstellen von `ski_mcp_` wird ein gültiges Zustimmungstoken vom internen API-Verifier akzeptiert.

Zusätzlich enthält das Zustimmungstoken `scopes` als Array. Der interne Verifier erwartet einen JSON-String und übergibt den falschen Typ ungeprüft an `parseApiKeyScopes`. Dessen Fehlerbehandlung vergibt alle vier Rechte. Im Nachweis wurde aus einer Anforderung nur für `boards:read` ein akzeptierter Zugang mit `boards:read`, `boards:write`, `members:write` und `boards:delete`.

Die Zustimmungsseite erzeugt dieses Token bereits vor dem Klick auf „Zugriff erlauben“. Für den falschen API-Verwendungszweck sind weder der Klick noch PKCE erforderlich. Die Prüfung übernimmt außerdem die zehn Minuten Gültigkeit des Zustimmungstokens statt der vorgesehenen einen Minute für interne Tokens. Die REST-Middleware akzeptiert interne Tokens auch über den öffentlich eingebundenen API-Pfad.

**Voraussetzung und Grenze:** Der Angreifer muss ein gültiges Zustimmungstoken des betroffenen Benutzers besitzen. Ein eingeloggter Benutzer kann sein eigenes abrufen; eine normale fremde Website kann die Zustimmungsseite wegen der Browser-Origin-Grenze nicht einfach auslesen. Der Nachweis zeigt keinen Diebstahl eines fremden Tokens und keine anonyme Übernahme beliebiger Konten. Board-Mitgliedschaft, Eigentümerrechte und E2EE werden dadurch ebenfalls nicht pauschal aufgehoben. Dennoch wird ein vor Zustimmung ausgegebener Formulartoken zu einem übertragbaren, überprivilegierten API-Zugang.

**Behebung:** Signaturen durch getrennte abgeleitete Schlüssel oder fest mitsignierte Zweckkennungen trennen; Token-Typ, Audience, Ausstellungs-/Ablaufzeit und alle Payload-Typen strikt validieren. Fehlerhafte oder fehlende Scopes bei diesen Tokens ablehnen statt Vollzugriff zu vergeben. Tests für gegenseitige Token-Verwechslung ergänzen. Bei einer Umstellung keine alte zwecklose Signatur als Kompatibilitäts-Fallback akzeptieren.

## 2. Priorität hoch: SSRF-Schutz für KI-Endpunkte ist unvollständig

**Status:** Umgehung durch ausgelassene URL lokal nachgewiesen; HTTP-Aufrufe wurden vor jeder Netzwerkverbindung abgefangen. DNS-/Redirect-Lücke aus dem vollständigen Aufrufpfad bestätigt, ohne internes Ziel tatsächlich abzurufen.

**Stellen:** `apps/api/src/lib/ai-settings.ts:37,74,81`; `apps/api/src/trpc/routers/ai.ts:80,120,273`; `apps/api/src/lib/ai-models.ts:35,129`; `packages/shared/src/ai-providers.ts:14,106`; `apps/api/src/lib/ai-diagram.ts:185`.

Ein angemeldeter Benutzer mit Produktzugang kann `ollama` ohne `baseUrl` anfordern. Die Managed-Prüfung beendet sich bei fehlender URL ohne Fehler. Danach ergänzt die Modellsuche als Standard `http://127.0.0.1:11434/api/tags`. Die explizite Loopback-Adresse wird blockiert, dieselbe implizite Adresse wird verwendet. Für diesen Modellabruf ist kein eigener KI-Schlüssel erforderlich. Auch die Generierung besitzt den Loopback-Fallback.

Bei angegebenen URLs wird nur der geschriebene Hostname geprüft. Eine vom Angreifer kontrollierte Domain kann auf private IP-Adressen auflösen. Außerdem folgen die Fetch-Aufrufe standardmäßig Weiterleitungen, ohne das neue Ziel zu prüfen. Damit können interne Ziele trotz unauffälliger Ausgangsadresse erreicht werden. Der Loopback-Fallback ist fest auf den Ollama-Port begrenzt; beliebige interne Ziele betreffen die DNS-/Redirect-Varianten.

**Auswirkung:** Serveranfragen in das interne Netz und möglicherweise an lokale KI-Dienste. Welche Daten tatsächlich erreichbar sind, hängt von Diensten, Netzregeln und Antwortformaten ab. Ein Abruf von Cloud-Metadaten oder eine Datenexfiltration wurde nicht nachgewiesen.

**Behebung:** Für Managed zunächst benutzerdefinierte `local`-/`ollama`-Ziele sperren oder nur vom Betreiber freigegebene Ziele erlauben. Falls öffentliche benutzerdefinierte Ziele weiter unterstützt werden: erst die effektive URL einschließlich Defaults bilden, alle aufgelösten IP-Adressen prüfen, die geprüfte Adresse beim Verbindungsaufbau festhalten und Redirects sperren oder jeden Hop gleichwertig prüfen. Ausgehende Netzregeln ergänzen. Die KI-Generierung benötigt außerdem einen Request-Timeout und begrenzte Antwortgrößen.

## 3. Priorität mittel: Login-Limits können mehrere Nutzer gemeinsam sperren

**Status:** mit der installierten Better-Auth-Version 1.6.33 und simulierten Proxy-Headern lokal reproduziert. Die tatsächlichen Produktionsheader sind unbekannt.

**Stellen:** `apps/api/src/lib/auth.ts:93`; `deploy/nginx/web.conf:89`; installierte Bibliothek `@better-auth/core/dist/utils/ip.mjs` und `better-auth/dist/api/rate-limiter/index.mjs`.

Skedra liefert am nginx ein bestimmtes `X-Real-IP`, konfiguriert dessen Verwendung aber nicht für Better Auth. Better Auth liest standardmäßig `X-Forwarded-For`; ohne konfigurierte vertrauenswürdige Proxys verwirft diese Version Header mit mehreren Adressen. Solche Ketten entstehen zum Beispiel hinter Tunnel plus nginx. Fehlt dadurch eine ermittelbare IP, verwendet der Limiter einen gemeinsamen `no-trusted-ip`-Bucket pro Auth-Pfad.

**Nachweis:** Zwei unterschiedliche Nutzer-IP-Adressen mit jeweils angehängtem Proxy-Hop ergeben beide `null`. Nach fünf lokalen Limiter-Aufrufen für Nutzer A erhielt bereits der erste Aufruf von Nutzer B HTTP 429. Kein Login- oder Netzrequest wurde ausgeführt. Das betrifft Nutzer mit dieser Header-Konstellation auf derselben API-Instanz; der produktive Umfang ist zu verifizieren.

**Behebung:** Better Auth explizit auf den vom unmittelbaren vertrauenswürdigen Proxy überschriebenen `X-Real-IP` konfigurieren oder die Proxy-Kette korrekt hinterlegen. Die API darf dabei nicht direkt mit frei fälschbaren Headern erreichbar sein. Bei mehreren API-Instanzen einen gemeinsamen atomaren Limit-Store verwenden; derzeit ist er pro Prozess im Speicher.

## Weitere konkrete Härtungspunkte

**OAuth-Freigaben selbst widerrufen:** In den geprüften Routern und Einstellungen gibt es keine Verwaltung erteilter MCP-OAuth-Freigaben durch den Benutzer. Die API-Key-Verwaltung widerruft nur API-Keys. Der OAuth-Revoke-Endpunkt verlangt das eigentliche Token; dieses liegt normalerweise beim Client. Ein Passwortwechsel löscht andere Sessions, aber keine MCP-OAuth-Tokens (`apps/api/src/trpc/routers/account.ts:82`). Refresh-Tokens werden jeweils erneut für 30 Tage ausgestellt. Für den Fall einer erschlichenen Zustimmung sollte der Benutzer einzelne Apps und alle Freigaben selbst widerrufen können. Passwort-Reset und andere Sicherheitsereignisse sollten eine ausdrücklich festgelegte Widerrufsstrategie haben. Das ist eine Wiederherstellungs-/Produktlücke, kein eigenständiger Beweis einer Authentifizierungsumgehung.

**Passwort-Reset-Limit am falschen Pfad:** Der strengere Eintrag steht für `/forget-password` (`apps/api/src/lib/auth.ts:100`), das Frontend verwendet `/request-password-reset` (`apps/web/src/lib/auth-password.ts:34`). Die installierte Bibliothek begrenzt diesen tatsächlich verwendeten Pfad standardmäßig bereits auf drei Anfragen pro Minute. Die beabsichtigten drei pro fünf Minuten greifen jedoch nicht. Die Aussage „kein Rate-Limit“ wäre falsch.

**Nicht geprüfte Client-Namen:** Der Name ist frei wählbar. Die Zustimmungsseite sollte bei allen dynamisch registrierten Apps klar sagen, dass deren Identität nicht geprüft wurde, und die Ziel-Domain hervorheben. Derzeit erscheint ein zusätzlicher Warntext nur bei lokalen Callback-Adressen. Das ist eine sinnvolle Phishing-Härtung unabhängig davon, ob DCR offen bleibt.

## Verifikation und Grenzen

Der ursprüngliche Nachweis lag in `scripts/security-audit-2026-10-10.mjs` und prüfte den verwundbaren Zustand mit festen Testwerten, einer simulierten Datenbank und abgefangenen Fetch-Aufrufen. Nach der Behebung wurde dieser Einstieg auf die neuen Sicherheits-Regressionsprüfungen umgestellt: Er erwartet jetzt sichere Ablehnung und prüft weiterhin die erlaubten Abläufe.

Aus dem Repository-Verzeichnis:

```powershell
Set-Location apps/api
node --import tsx ../../scripts/security-audit-2026-10-10.mjs
node --import tsx --test src/lib/mcp-oauth.test.ts src/lib/mcp-consent.test.ts src/lib/collab-share.test.ts src/lib/presentation-share.test.ts
```

Ergebnis: Nachweisskript erfolgreich, alle beschriebenen lokalen Beobachtungen bestätigt. Die 16 vorhandenen Tests für OAuth, Zustimmung und Freigaben bestehen. Diese vorhandenen Tests decken die neu gefundenen Probleme nicht ab. `pnpm --filter` scheiterte in der Sandbox an `EPERM` bei `realpath`; der direkte Node-Aufruf funktionierte. Kein produktiver OAuth-End-to-End-Test, keine Lasttests, kein Dependency-Advisory-Scan und keine Prüfung von Produktionslogs oder Mail-Headern.

Zusätzlich stichprobenartig geprüft: REST-Authentifizierung und Scope-Prüfung, Board-/Freigabezugriffe, der frühere Passwort-Reset-Link-Endpunkt sowie Managed-Secret-Prüfungen. Der alte Reset-Link-Endpunkt verlangt jetzt Selfhost-Modus und Instanz-Admin; die alten Findings wurden nicht ungeprüft übernommen. Das ältere Dokument `SECURITY-REVIEW-auth-mcp-mail.md` bezeichnet insbesondere den SSRF-Schutz zu pauschal als abgeschlossen.

Beim ersten Review wurden nur dieser Bericht und das Nachweisskript hinzugefügt. Die nachfolgend beschriebenen Code-Patches wurden anschließend auf ausdrücklichen Benutzerwunsch umgesetzt.

## Umgesetzte Patches

- **Token-Verwechslung:** Unterschiedliche mitsignierte Zweckkennungen für Zustimmung und interne API-Tokens. Strikte Zod-Schemas prüfen Typen, Scopes, Token-Art, interne Audience, Ausstellungszeit und maximale Gültigkeit. Zusätzliche Token-Segmente sowie alte Signaturen werden abgelehnt. Interne Tokens benutzen keinen Scope-Parser mit Vollzugriff als Fehler-Fallback mehr.
- **KI/SSRF:** `local` und `ollama` sind im Managed-Modus unabhängig von URL, Default, DNS oder Redirect gesperrt. Das gilt sowohl beim Speichern als auch direkt vor Modellsuche und Generierung, also auch für bereits gespeicherte Einstellungen und Plattform-Fallbacks. Die festen Cloud-Provider bleiben verfügbar; ihre Managed-Aufrufe folgen keinen Redirects. Selfhost unterstützt weiterhin lokale Ziele. Die Generierung hat zusätzlich einen Timeout von 60 Sekunden.
- **Auth-Limits:** Die tatsächlich verwendete Better-Auth-Konfiguration liest das von nginx überschriebene `X-Real-IP`. Unterschiedliche Nutzer bleiben bei mehrgliedrigem `X-Forwarded-For` getrennt; manipulierte vordere Einträge ändern das Limit nicht. `/request-password-reset` ist jetzt auf drei Anfragen pro fünf Minuten begrenzt.
- **Regressionen:** Neue Tests in `mcp-token-security.test.ts`, `ai-provider-policy.test.ts` und `auth-security-options.test.ts`. Die Auth-Tests verwenden den echten Better-Auth-Handler mit Memory-Adapter; Token- und KI-Tests verwenden lokale Stubs. Der frühere Audit-Einstieg führt diese Tests aus.

**Patch-Verifikation:** Alle 77 API-Tests bestanden (`node --import tsx --test 'src/**/*.test.ts'`), einschließlich neun neuer Sicherheitstests. API-Typecheck mit `tsc --noEmit` bestanden. Biome-Prüfung der geänderten TypeScript-Dateien bestanden. Für die vollständige Testsuite und den Typecheck war ein Lauf außerhalb der Sandbox nötig, weil deren `realpath`-Beschränkung temporäre Dateitests und die Auflösung der pnpm-Verknüpfungen störte. Keine Produktionssysteme wurden getestet.

### Rollout und verbleibender Umfang

Alle API-Instanzen müssen aktualisiert werden; alte Instanzen besitzen weiterhin die Schwachstelle. Bereits geöffnete Zustimmungsseiten müssen neu geladen werden. Alte interne Tokens werden absichtlich nicht weiter akzeptiert; laufende Tool-Aufrufe können beim Versionswechsel erneut gestartet werden müssen. Bestehende persistierte OAuth-Access-/Refresh-Tokens haben ein anderes Format und werden durch diese Signaturänderung nicht automatisch widerrufen.

Die API muss hinter einem vertrauenswürdigen Proxy bleiben, der `X-Real-IP` selbst setzt. Die mitgelieferten nginx-Konfigurationen tun dies; der Managed-Compose exponiert keinen API-Port. Eine direkte öffentliche API-Freigabe mit ungeprüften Headern wäre weiterhin unsicher. Der Rate-Limit-Store bleibt pro Prozess; ein gemeinsamer Store für mehrere Instanzen ist eine separate Betriebsmaßnahme.

Der benutzerseitige OAuth-App-Widerruf und die zusätzliche Warnung für ungeprüfte Client-Namen aus den weiteren Härtungspunkten sind nicht Teil dieser drei Fehlerbehebungen. Keine Datenbankmigration, keine neuen Secrets und kein Deployment wurden vorgenommen.
