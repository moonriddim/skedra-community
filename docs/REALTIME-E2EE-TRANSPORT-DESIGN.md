# Design: Realtime E2EE Live-Transport

**Datum:** 2026-07-09
**Ziel:** „Wirklich realtime" **und** Ende-zu-Ende-verschlüsselt. Kein Legacy-
Hocuspocus-Service zurückholen, sondern ein kleiner Live-Kanal im bestehenden
API-Prozess, der **nur Ciphertext bzw. Update-IDs** weiterreicht. Das durable
DB-Log bleibt die Quelle der Wahrheit; der Server sieht nie Klartext.

---

## Ist-Zustand

- Sync über tRPC-**Update-Log**: `whiteboard.appendE2eeUpdate` (schreibt eine
  Zeile in `whiteboardE2eeUpdates`), Client pollt `listE2eeUpdates` alle **1500 ms**,
  `compactE2eeUpdates` macht Snapshots. Updates sind verschlüsselte Envelopes
  (`{ v, alg, iv, data }`) — der Server kennt nur den `keyHash`, nie den Schlüssel.
- Offline/Crash-Queue mit Retry ist vorhanden (`e2ee-update-queue`).
- **Presence ist ein No-op** (`noopPresence`, `remotePresence = []`).
- Transport: Hono + `@hono/node-server`. `hono/streaming` liefert **SSE ohne neue
  Dependency**; WebSocket bräuchte `@hono/node-ws`.

**Fazit:** Es fehlt nur die *Push-Kante*. Persistenz, Auth, Crypto und Konflikt-
auflösung (Yjs) sind bereits da. Wir latenzen das Polling weg, ohne die Architektur
umzubauen.

---

## Zielarchitektur

```
Client A ──(1) appendE2eeUpdate (tRPC, wie heute) ─────────────▶  API
                                                                  │
                                              (2) DB-Insert (durable)
                                                                  │
                                        (3) publish(boardId, {id, createdAt[, ciphertext]})
                                                                  ▼
                                                        In-Process Event-Bus
                                                    (Managed: Postgres LISTEN/NOTIFY)
                                                                  │
Client B ◀──(4) SSE/WS-Event ──────────────────────────────────┘
Client B ──(5) listE2eeUpdates ab Cursor  ODER  wendet Ciphertext direkt an
```

Wichtig: Der Live-Kanal transportiert **ausschließlich** Ciphertext-Envelopes,
Update-IDs und Zeitstempel. Entschlüsselt wird nur im Client mit dem `#skedraKey`.
Damit bleibt E2EE unangetastet — der Live-Kanal ist „blind" wie der REST-Pfad.

---

## Phase 1 (MVP): Live-Push für Dokument-Updates — **SSE, keine neue Dependency**

Größter Gewinn (sofortige Doku-Sync statt bis zu 1,5 s Verzögerung) bei minimalem Aufwand.

**Server**
1. **Event-Bus** (`apps/api/src/lib/board-live-bus.ts`): `Map<whiteboardId, Set<Subscriber>>`
   mit `publishBoardUpdate(id, payload)` und `subscribe(id, cb): unsubscribe`.
2. In `appendE2eeUpdate` **und** `compactE2eeUpdates` **nach dem DB-Commit**
   `publishBoardUpdate(whiteboardId, { id, createdAt })` aufrufen (optional den
   Ciphertext mitschicken, um den Extra-Fetch zu sparen).
3. **SSE-Route** auf der Hono-App (`GET /api/boards/:id/live`), via `streamSSE`:
   - Zugriff prüfen wie `requireE2eeUpdateAccess` (Session-Cookie **oder**
     presentation-/collab-/embed-Share-Token als Query-Param).
   - Beim Verbinden abonnieren, jedes Event als `data:` senden; Heartbeat ~15 s.
   - Bei Disconnect sauber `unsubscribe`.

**Client**
4. Neuer Hook `useBoardLiveChannel(whiteboardId, { onUpdate })` mit `EventSource`
   (Cookies gehen dank `credentials`-CORS automatisch mit; Share-Token als Query).
5. In `useE2eeCanvasSync`: bei Live-Event **sofort** `listE2eeUpdates` invalidieren/
   nachladen (oder mitgeschickten Ciphertext direkt `Y.applyUpdate`). `refetchInterval`
   von 1500 ms auf einen **langsamen Sicherheits-Fallback** (z. B. 10 s) senken,
   solange die Live-Verbindung steht.

Ergebnis: near-instant kollaborative Bearbeitung, unverändertes E2EE, Polling nur
noch als Netz-und-doppelter-Boden.

## Phase 2: E2EE-Presence (Cursor/Auswahl) — **WebSocket** (`@hono/node-ws`)

Presence ist hochfrequent, bidirektional und **flüchtig** (nicht persistiert) — dafür
ist WS die richtige Wahl.
- Presence-Payloads (Cursor-Position, Auswahl, Name/Farbe) werden **clientseitig mit
  demselben Board-Key verschlüsselt** und über WS relayt — **nicht** in die DB.
- Server hält nur einen flüchtigen Raum pro Board (`Map<boardId, Set<socket>>`),
  broadcastet Ciphertext an die anderen Teilnehmer, räumt bei Disconnect auf.
- Client: `noopPresence` im Hook durch echte Sender ersetzen, `remotePresence`
  aus entschlüsselten WS-Nachrichten füllen.
- Optional: Auch die Doku-Updates aus Phase 1 auf denselben WS umziehen (dann fällt SSE weg).

## Phase 3: Mehr-Instanz-Betrieb (Managed/SaaS)

Der In-Process-Bus greift nur pro Prozess. Für mehrere Nodes:
- **Postgres `LISTEN/NOTIFY`** (schon vorhanden, kein neuer Dienst): Node, der den
  Append schreibt, `NOTIFY board_update, '<id>'`; alle Nodes `LISTEN` und leiten an
  ihre lokalen SSE/WS-Abonnenten weiter. Payload nur ID/Zeitstempel (klein, kein Klartext).
- Alternative: Redis Pub/Sub, falls ohnehin vorhanden.

---

## Sicherheit

- Live-Kanal führt **nur Ciphertext + IDs + Zeitstempel** — konsistent mit E2EE.
- Zugriff exakt wie beim Lese-Log (`requireE2eeUpdateAccess`): Session **oder**
  gültiger Share-Token. Schreiben bleibt beim bestehenden `appendE2eeUpdate`
  (inkl. `keyHash`-Prüfung) — der Live-Kanal ist read/relay-only.
- Limits: max. gleichzeitige Verbindungen pro Board/Nutzer; Heartbeat + Idle-Timeout;
  Presence-Nachrichten größenbegrenzen und rate-limiten.
- Kein Vertrauensgewinn für den Server: Er könnte Nachrichten weglassen/verzögern,
  aber niemals entschlüsseln (wie heute schon).

---

## Aufwand / Risiko

| Phase | Inhalt | Neue Dep | Aufwand | Risiko |
|-------|--------|----------|---------|--------|
| 1 | SSE-Live-Push für Updates | keine | M | niedrig |
| 2 | WS-E2EE-Presence | `@hono/node-ws` | M–L | mittel |
| 3 | LISTEN/NOTIFY für Multi-Node | keine | S–M | mittel |

S=Stunden, M=paar Tage, L=größer.

---

## Empfehlung

**Mit Phase 1 (SSE) starten** — kleiner, dependency-freier Eingriff mit dem größten
spürbaren Effekt (kollaborative Bearbeitung wird instant). Danach Phase 2 (WS-Presence)
für „echtes" Multiplayer-Gefühl, Phase 3 sobald mehrere API-Nodes laufen.

## Umgesetzt am 2026-07-09

Alle drei Phasen + MCP-Integration wurden implementiert. Der Live-Kanal transportiert
nur Ciphertext/Metadaten; der Server entschlüsselt nie.

**Server (`apps/api`)**
- `src/lib/board-live-bus.ts` — In-Process-Bus + optionaler Postgres LISTEN/NOTIFY-Bridge (Phase 3).
- `src/trpc/routers/whiteboard.ts` — `appendE2eeUpdate` und `compactE2eeUpdates` publizieren nach dem Commit auf den Bus.
- `src/index.ts` — SSE-Route `GET /api/boards/:id/live` (Phase 1) und WebSocket-Route `GET /api/boards/:id/presence` (Phase 2, via `@hono/node-ws`, `injectWebSocket`).
- `src/lib/board-presence.ts` — flüchtiger Presence-Raum, relayt nur Ciphertext.
- `src/rest/v1.ts` — `GET/POST /api/v1/boards/:id/updates` (API-Key + `keyHash`-Prüfung), POST publiziert auf den Bus → **MCP-Änderungen erscheinen sofort live**.
- `package.json` — neue Dependency `@hono/node-ws`.

**MCP (`apps/mcp`)**
- `src/canvas-e2ee.ts` — Node-Crypto (Web-kompatibler Envelope) + Yjs-Update-Bau.
- `src/index.ts` — Tools `add_board_elements` und `create_kanban_board` (erfordern `e2eeKey`).
- `src/client.ts` — `appendBoardUpdate` gegen die neue REST-Route.
- `package.json` — neue Dependencies `yjs`, `@skedra/canvas-core`.

**Web (`apps/web`)**
- `src/hooks/use-board-live-channel.ts` — SSE-Client (Dokument-Realtime).
- `src/hooks/use-board-presence.ts` — WebSocket-Presence (Live-Cursor/Auswahl), verschlüsselt.
- `src/hooks/use-e2ee-canvas-sync.ts` — beide Hooks verdrahtet; Polling drosselt auf 8 s bei aktivem Live-Kanal; `noopPresence` durch echte Presence ersetzt.

### Lokale Schritte (in dieser Sandbox nicht ausführbar)
1. `pnpm install` — zieht `@hono/node-ws`, `yjs`, `@skedra/canvas-core` (MCP).
2. `pnpm build` und `pnpm lint` — Typecheck/Format bestätigen.
3. `pnpm dev` — testen.

### Schnelltest
- Board in **zwei** Browsern öffnen → eine Änderung erscheint im anderen **sofort** (statt bis zu 1,5 s). Cursor des jeweils anderen sind sichtbar.
- MCP: `create_board` → `add_board_elements`/`create_kanban_board` mit dem `e2eeKey` → Shapes erscheinen **live** im offenen Board.

### Bewusst zu prüfen (konnte in der Sandbox nicht kompiliert werden)
- **`@hono/node-ws`**: exakte Version/Typen (v1.x zu Hono 4). Falls die async-`upgradeWebSocket`-Fabrik zickt, Auth in `onOpen` verschieben.
- **Presence-Rendering**: Der Sync-Hook liefert jetzt echte `remotePresence` + Setter. Ob die Board-Komponente daraus schon Cursor zeichnet, bitte prüfen — ggf. kleine UI-Anbindung nötig.
- **Multi-Node**: LISTEN/NOTIFY ist optional; für Single-Node/Selfhost irrelevant.
- Der Datei-Mount dieser Sandbox beschädigt Dateien beim Sync (NUL-Bytes) → ein hiesiger `tsc` ist nicht aussagekräftig. Deshalb lokaler Build nötig.

## Offene Fragen

- Soll Phase 1 den **Ciphertext direkt** über SSE mitschicken (spart den Nachlade-
  Fetch, größere Events) oder nur die **Update-ID** (kleiner, ein Extra-Fetch)?
- Presence-Umfang: nur Cursor + Auswahl, oder auch Viewport/aktive View (wie die
  vorhandenen `setPresence*`-No-ops andeuten)?
- Soll der MCP/Agent (siehe `MCP-CANVAS-WRITE-PROPOSAL.md`) ebenfalls am Live-Kanal
  hängen, damit Agent-Änderungen sofort erscheinen? (Fällt mit Phase 1 automatisch ab.)
