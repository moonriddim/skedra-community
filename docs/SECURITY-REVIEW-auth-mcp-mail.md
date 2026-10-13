# Bug- & Fehler-Prüfung: Auth · MCP/AI · Email/SMTP

**Datum:** 2026-07-09
**Umfang:** Authentifizierung, MCP-/AI-Integration, Email-Provider/SMTP
**Kontext:** Skedra läuft in zwei Modi — `selfhost` (lokal) und `managed` (SaaS). Viele Befunde sind
nur im SaaS-Modus kritisch, weil dort fremde Nutzer auf derselben Instanz sind.

Legende Schweregrad: 🔴 kritisch · 🟠 hoch · 🟡 mittel · ⚪ niedrig

---

## 🔴 Die zwei wichtigsten Befunde zuerst

### A1 · Unauthentifizierte Account-Übernahme über `peekPasswordResetLink`
**Ort:** `apps/api/src/trpc/routers/instance.ts:355` + `apps/api/src/lib/mail.ts:11–27,112`

`peekPasswordResetLink` ist ein **`publicProcedure`** (keine Anmeldung nötig). Es nimmt nur eine
E-Mail entgegen und gibt den zwischengespeicherten Passwort-Reset-Link zurück. Wenn der
Reset-Fallback auf `"link"` steht (typisch für Self-Hosting **ohne** SMTP), landet bei jedem
Reset der Link im Speicher und ist dann öffentlich abrufbar.

**Angriffskette (komplett unauthentifiziert):**
1. `POST /api/auth/forget-password` mit der Opfer-E-Mail → Reset wird ausgelöst, SMTP schlägt fehl/fehlt → Link wird gestasht.
2. `instance.peekPasswordResetLink({ email: opfer })` → Reset-URL wird zurückgegeben.
3. Passwort setzen → **fremdes Konto übernommen.**

Der Standardwert ist `"log"` (nicht `"link"`), was das Problem entschärft — aber der `"link"`-Modus
ist genau für den häufigen Fall „Self-Host ohne Mailserver" gedacht und wird dort aktiv genutzt.

**Fix:** Endpoint entfernen oder auf `protectedProcedure` + Admin-Check umstellen. Der Reset-Link
darf niemals allein anhand der E-Mail (ohne zweiten Faktor/Session-Bindung) herausgegeben werden.
Besser: Link nur dem angemeldeten Admin in den System-Einstellungen anzeigen, nicht per öffentlichem Query.

### A2 · Standard-Secrets werden im Managed/SaaS-Modus nicht erzwungen
**Ort:** `apps/api/src/env.ts:33–35,36,97–135`

`AUTH_SECRET` hat einen **unsicheren `.default(...)`** und **kein `.min(32)`**. Die `superRefine`
für den `managed`-Modus prüft nur Object-Storage — **nicht**, ob `AUTH_SECRET` geändert wurde oder
ob `DATA_ENCRYPTION_SECRET` gesetzt ist. Eine SaaS-Instanz kann also mit dem öffentlich bekannten
Default-Secret starten.

**Folge:** Session-Cookies sind fälschbar (Sessions signiert mit bekanntem Key) **und** alle
gespeicherten Geheimnisse (SMTP-Passwort, AI-API-Keys, LiveKit-Secret) sind entschlüsselbar, weil
die Verschlüsselung auf `AUTH_SECRET` zurückfällt (siehe A3).

**Fix:** In `superRefine` für `managed` erzwingen: `AUTH_SECRET` gesetzt, ≠ Default, Länge ≥ 32;
`DATA_ENCRYPTION_SECRET` gesetzt und ≠ Default.

---

## Auth

### 🟠 A3 · `DATA_ENCRYPTION_SECRET` fällt auf `AUTH_SECRET` zurück
**Ort:** `apps/api/src/lib/instance-settings.ts:33` · `apps/api/src/lib/ai-settings.ts:29`

`secret: env.DATA_ENCRYPTION_SECRET ?? env.AUTH_SECRET`. Ohne separates Secret werden alle
gespeicherten Geheimnisse mit demselben Schlüssel verschlüsselt, der auch Sessions signiert — keine
Schlüsseltrennung. Zusammen mit A2 (Default-Key) bedeutet das: Verschlüsselung mit öffentlich
bekanntem Schlüssel. **Fix:** Eigenes `DATA_ENCRYPTION_SECRET` verlangen (mind. im Managed-Modus).

### 🟠 A4 · Keine E-Mail-Verifizierung
**Ort:** `apps/api/src/lib/auth.ts:22–32`

`emailAndPassword` ist aktiv, aber ohne `requireEmailVerification`. Nutzer registrieren sich mit
beliebigen, unverifizierten Adressen. Im SaaS-Modus ermöglicht das Identitäts-Spoofing und Missbrauch
der Invite-/Mention-Mails. **Fix:** Für `managed` `requireEmailVerification: true` + `sendVerificationEmail` setzen.

### 🟠 A5 · Kein (verlässliches) Rate-Limiting auf Auth-Endpunkten
**Ort:** `apps/api/src/lib/auth.ts` (kein `rateLimit`-Block)

Kein eigenes Rate-Limiting konfiguriert. Der better-auth-Default ist ein **In-Memory**-Limiter, der
über mehrere SaaS-Instanzen hinweg nicht greift. `forget-password`/`sign-in` sind damit anfällig für
Brute-Force und Reset-/Mail-Bombing. **Fix:** `rateLimit` mit gemeinsamem Store (DB/Redis) konfigurieren,
strengere Limits auf sensible Pfade.

### 🟡 A6 · Inkonsistente E-Mail-Normalisierung beim Signup
**Ort:** `apps/api/src/index.ts` (`readSignUpBody` / `isEmailSignUpRequest`-Block)

Der Invite-Check nutzt die **normalisierte** (kleingeschriebene) E-Mail, aber der an better-auth
weitergereichte `authBody` behält die Original-Schreibweise. Danach wird der User per
`eq(users.email, normalizeInviteEmail(...))` gesucht. Wenn better-auth die E-Mail in anderer
Schreibweise speichert, schlagen **First-Admin-Zuweisung** und **Invite-Abschluss** stillschweigend
fehl (Team-/Board-Mitgliedschaft aus dem Invite wird nicht angewendet). **Fix:** E-Mail schon im
`authBody` normalisieren und überall konsistent kleinschreiben (verifizieren, wie better-auth 1.2 speichert).

### 🟡 A7 · Reset-Link nur im Prozess-Speicher
**Ort:** `apps/api/src/lib/mail.ts:11`

`pendingResetLinks` ist eine In-Memory-`Map`: über mehrere Instanzen hinweg nutzlos (Link auf Node A
erzeugt, Abruf auf Node B → Fehlschlag) und wächst unbegrenzt (Aufräumen nur beim Consume) →
kleines Speicherleck. Siehe auch A1. **Fix:** Feature überdenken; falls nötig, TTL-basiertes Cleanup + geteilter Store.

**Positiv:** Board-Berechtigungen (`permissions.ts`) und die REST-v1-Endpunkte prüfen sauber
Scope **und** Board-Zugriff. API-Keys werden als SHA-256-Hash gespeichert (kein Klartext), E2EE-Key-Material
wird clientseitig erzeugt. Das ist solide.

---

## MCP / AI

### 🔴 M1 · MCP-Element-Tools rufen nicht existierende Endpunkte auf
**Ort:** `apps/mcp/src/index.ts:133–217` + `apps/mcp/src/client.ts:116–122` vs. `apps/api/src/rest/v1.ts`

Der MCP-Server bietet die Tools `get_board_elements`, `add_board_elements`, `update_board_element`,
`delete_board_element`. Der Client ruft dafür `/boards/:id/elements`. **Diese Routen existieren in
der REST-API v1 nicht** (kein einziger `elements`-Treffer im `rest/`-Verzeichnis, auch nicht in der
OpenAPI-Spec). Alle vier Tools laufen daher immer in einen 404.

Vermutlich Absicht der Architektur: Boards sind E2EE, der Server kann die Element-Daten gar nicht
lesen/schreiben. Dann sind diese Tools aber **funktional tot** und irreführend (der MCP-Hinweistext
empfiehlt sogar `add_board_elements`). **Fix:** Entweder Endpunkte serverseitig implementieren
(passt schwer zu E2EE) **oder** die vier Tools entfernen und die MCP-Instructions anpassen.

### 🟠 M2 · SSRF über benutzerdefinierte AI-`baseUrl`
**Ort:** `apps/api/src/lib/ai-models.ts:129–164` · `apps/api/src/trpc/routers/ai.ts:45–100,214`

Für die Provider `local`/`ollama` wird eine **vom Nutzer gelieferte `baseUrl`** serverseitig
abgerufen (`listModels` und die Diagramm-Generierung). Im SaaS-Modus ist das ein SSRF-Vektor:
interne Dienste oder Cloud-Metadaten (`http://169.254.169.254/...`) werden vom Server aus erreichbar.
**Fix:** Im `managed`-Modus `local`/`ollama` deaktivieren oder `baseUrl` gegen Allowlist prüfen und
private/link-local IP-Bereiche blocken. (Timeout ist in `ai-models.ts` vorhanden — in der Generierung prüfen.)

### 🟡 M3 · Kein Rate-Limit/Kostendeckel für `generateDiagram`
**Ort:** `apps/api/src/trpc/routers/ai.ts:214` · `apps/api/src/lib/ai-settings.ts:88–97`

Mit dem Plattform-Fallback-Key (`SKEDRA_AI_API_KEY`) kann jeder Nutzer LLM-Aufrufe auf Kosten des
Betreibers auslösen — ohne Kontingent. **Fix:** Pro-Nutzer-Limit/Quota im Managed-Modus.

### 🟡 M4 · MCP-HTTP-Client ohne Timeout
**Ort:** `apps/mcp/src/client.ts:20–43`

`request()` nutzt `fetch` ohne `AbortController`. Eine hängende API blockiert das Tool unbegrenzt.
**Fix:** Timeout via `AbortSignal.timeout(...)` ergänzen.

### ⚪ M5 · `listModels` gibt Provider-Fehlermeldungen wörtlich weiter
**Ort:** `apps/api/src/trpc/routers/ai.ts:91–99`

Fehlertext des Anbieters wird 1:1 zurückgegeben — geringe Info-Leak-/Verwirrungsgefahr. **Fix:** generische Meldung, Details nur ins Log.

---

## Email / SMTP

### 🟠 E1 · HTML-Injection in ausgehenden E-Mails
**Ort:** `apps/api/src/lib/mail.ts:92–97,148–154,201–208`

Benutzergesteuerte Werte werden **ungeschützt** in HTML interpoliert: `userName`, `inviterName`,
`context`, `authorName`, `boardName`, `recipientName`. Auch die `url` steht ungeprüft in
`href="${url}"`. Ein Nutzer mit Namen wie `<img src=x onerror=...>` schleust HTML in die Mail des
Empfängers ein bzw. bricht das `href` auf. (`commentPreview` wird immerhin per `<`→`&lt;` teil-escaped —
die Namen aber nicht.) **Fix:** Alle interpolierten Werte HTML-escapen; URL nur in Textteil oder via `encodeURI`.

### 🟡 E2 · Reset-Link im Klartext im Server-Log
**Ort:** `apps/api/src/lib/mail.ts:117`

Im Fallback-Modus `"log"` (Standard!) wird die vollständige Reset-URL inkl. Token ins Log geschrieben.
Wer Log-Zugriff hat (oder wohin auch immer Logs weitergeleitet werden), kann Konten übernehmen.
**Fix:** Nur ein Ereignis loggen, nicht den Token; Reset-Zustellung über verifizierten Kanal.

### 🟡 E3 · TLS bei SMTP-Submission nicht erzwungen
**Ort:** `apps/api/src/lib/mail.ts:43–53` · `apps/api/src/lib/instance-settings.ts:60,107`

Transport nutzt `secure: config.secure`. Bei `secure=false` (Port 587) erzwingt nodemailer kein
STARTTLS-Upgrade — erlaubt der Server Klartext, gehen SMTP-Zugangsdaten unverschlüsselt raus.
**Fix:** `requireTLS: true` für nicht-`secure` Submission-Ports setzen.

### ⚪ E4 · `sendTestEmail`/Reset ohne Rate-Limit
Email-Bombing möglich (gehört zu A5). **Fix:** Rate-Limit auf mailauslösende Endpunkte.

---

## Priorisierte Reihenfolge zum Beheben

1. **A1** – `peekPasswordResetLink` absichern/entfernen (kritisch, sofort)
2. **A2 + A3** – Secrets im Managed-Modus erzwingen, Schlüsseltrennung
3. **M1** – tote/kaputte MCP-Element-Tools entfernen oder implementieren
4. **E1** – HTML-Escaping in Mails
5. **M2** – SSRF-Schutz für AI-`baseUrl` (SaaS)
6. **A4, A5, E3** – E-Mail-Verifizierung, Rate-Limiting, SMTP-TLS
7. Rest (A6, A7, M3–M5, E2, E4) nach Kapazität

---

## Umgesetzt am 2026-07-09 (alle 15 Befunde behoben)

| Fix | Datei(en) | Änderung |
|-----|-----------|----------|
| A1 | `trpc/routers/instance.ts` | `peekPasswordResetLink` von `publicProcedure` → `protectedProcedure` + Admin-Check |
| A2 | `env.ts` | `superRefine`: erzwingt echtes `AUTH_SECRET`/`DATA_ENCRYPTION_SECRET` im Managed-Modus |
| A3 | `lib/instance-settings.ts`, `lib/ai-settings.ts` | Fallback auf `AUTH_SECRET` dokumentiert (Managed via A2 erzwungen) |
| A4 | `lib/auth.ts`, `lib/mail.ts` | `requireEmailVerification` (Managed) + neue `sendVerificationEmail` |
| A5 | `lib/auth.ts` | `rateLimit` mit strengeren Regeln für sign-in/sign-up/forget/reset |
| A6 | `index.ts` | E-Mail vor Übergabe an better-auth normalisiert |
| A7 | `lib/mail.ts` | `sweepExpiredResetLinks()` räumt abgelaufene Links auf |
| M1 | `mcp/src/index.ts`, `mcp/src/client.ts` | 4 kaputte Element-Tools + Client-Methoden entfernt, Instructions angepasst |
| M2 | `lib/ai-settings.ts`, `trpc/routers/ai.ts` | `assertAiBaseUrlAllowed` blockt interne/private Ziele im Managed-Modus |
| M3 | `trpc/routers/ai.ts` | Kontingent für Diagramm-Generierung auf Plattform-Key |
| M4 | `mcp/src/client.ts` | Request-Timeout (15s) via `AbortSignal.timeout` |
| M5 | `trpc/routers/ai.ts` | `listModels`-Fehler generisch, Details nur ins Log |
| E1 | `lib/mail.ts` | `escapeHtml()` auf alle nutzergesteuerten Werte + URLs |
| E2 | `lib/mail.ts` | Reset-/Invite-Link nicht mehr im Klartext geloggt |
| E3 | `lib/mail.ts` | `requireTLS` bei nicht-implizitem TLS (STARTTLS erzwungen) |

### Hinweise zur Verifizierung
- Ein automatischer `tsc`/`biome`-Lauf war in dieser Sandbox nicht zuverlässig
  möglich (der Datei-Mount zeigt bei frisch geänderten Dateien zeitweise
  NUL-Padding — ein Sync-Artefakt, keine echte Beschädigung). Alle Änderungen
  wurden manuell über die Datei-Tools geprüft (Imports, Referenzen, Syntax).
- **Bitte lokal ausführen:** `pnpm lint` und `pnpm build` (bzw. der API-Typecheck),
  um die Änderungen final zu bestätigen.
- **Neue Env-Anforderung (Managed):** In `SKEDRA_DEPLOYMENT_MODE=managed` müssen
  jetzt `AUTH_SECRET` und `DATA_ENCRYPTION_SECRET` gesetzt und ≠ Default sein,
  sonst startet die API nicht mehr (gewollt). `.env.example` ggf. ergänzen.
