# Umsetzungsvorschlag: MCP/Agent kann Canvas-Elemente erstellen

**Datum:** 2026-07-09
**Ziel:** Externe KI-Agents sollen über den MCP-Server Shapes/Diagramme (Kanban,
Mindmap, Flowchart …) auf Skedra-Boards erzeugen — trotz E2EE.

---

## Ausgangslage: Wie Boards heute funktionieren

- **E2EE-Schlüssel** = 32 Zufalls-Bytes, base64url. Lebt **nur im Client**
  (localStorage + URL-Fragment `#skedraKey=…`). Der Server kennt nur den
  SHA-256-**Hash** (`createE2eeKeyHash`) → beweist Schlüsselbesitz, ohne den
  Schlüssel zu kennen.
- **Board-State** = Yjs-Dokument mit den Maps `elementsMap` und `viewsMap`.
- **Sync ist tRPC-basiert (kein WebSocket für E2EE):** Der Client pusht
  verschlüsselte Yjs-Updates per `whiteboard.appendE2eeUpdate` und pollt sie per
  `whiteboard.listE2eeUpdates` (alle 1,5 s), plus `compactE2eeUpdates` für
  Snapshots. Der Server speichert also ein **append-only Log verschlüsselter
  Update-Envelopes** (`{ v, alg, iv, data }`) und sieht nie den Klartext.
- **Wichtig:** Die Element-Erzeugung und die Diagramm-Layouts sind bereits
  **Node-fähig**: `@skedra/canvas-core` (Element-Factory, Scene, Geometrie — mit
  Node-Tests) und `@skedra/shared/ai-generation` (Kanban/Mindmap/Flowchart/…-Layout,
  läuft schon serverseitig in `ai-diagram.ts`).

Das bedeutet: Fast alle Bausteine existieren schon — sie sind nur an die Web-App
gebunden. Für den MCP müssen sie Node-nutzbar gemacht und über die Public-API
erreichbar werden.

---

## Option A — Agent-seitiger MCP (E2EE bleibt erhalten) — **empfohlen**

Der MCP-Prozess hält den E2EE-Schlüssel, baut das Update lokal, verschlüsselt es
und schickt es über die API. Der Server bleibt „blind".

**Schritte:**

1. **Node-fähiges Sync-Kit bauen.** `yjs-canvas-mutations.ts` und
   `yjs-document-helpers.ts` (heute in `apps/web/src/lib/canvas/`) in ein geteiltes
   Paket ziehen, z. B. `@skedra/canvas-sync` oder direkt in `@skedra/canvas-core`.
   Sie hängen nur an `yjs` + canvas-core-Typen — kein Browser nötig.
2. **Crypto Node-fähig machen.** `encryptYjsUpdate` / `createE2eeKeyHash` nutzen
   die WebCrypto-API (`crypto.subtle`), die in Node ≥ 20 als `globalThis.crypto`
   vorhanden ist. Nur die Import-/Bundle-Pfade anpassen (kein `localStorage`,
   kein `window`) → in ein Node-taugliches Modul auslagern.
3. **REST-Endpunkte für das Update-Log ergänzen** (Spiegel der tRPC-Prozeduren),
   z. B. in `apps/api/src/rest/v1.ts`:
   - `GET  /api/v1/boards/:id/updates` → verschlüsselte Updates auflisten
   - `POST /api/v1/boards/:id/updates` → `{ clientId, keyHash, update }` anhängen
   Auth: API-Key + `boards:write`-Scope + Board-Zugriff, und der gepostete
   `keyHash` **muss** dem gespeicherten `e2eeKeyHash` des Boards entsprechen.
4. **MCP-Tools wieder einführen** (`add_board_elements`, optional `generate_diagram`):
   a. bestehende Updates holen → Y.Doc aufbauen → mit dem Schlüssel entschlüsseln,
   b. Elemente erzeugen — entweder explizit übergeben **oder** per
      `@skedra/shared/ai-generation` aus einem Prompt (Kanban, Mindmap …),
   c. nur den Diff verschlüsseln (`Y.encodeStateAsUpdate(doc, priorStateVector)`)
      und per POST anhängen. Bei einem **neuen** Board (leerer Doc) reicht der
      volle State als erstes Update.
5. **Schlüssel bereitstellen.** `create_board` liefert den `e2eeKey` bereits im
   Ergebnis. Für **bestehende** Boards bekommen die Schreib-Tools einen Parameter
   `e2eeKey` (der Nutzer übergibt den `#skedraKey` aus der Board-URL).

**Vorteile:** E2EE bleibt vollständig erhalten; nutzt vorhandene Layout-/Crypto-
Logik; keine neuen Vertrauensannahmen gegenüber dem Server.
**Nachteile:** Der Agent muss den Schlüssel besitzen; etwas Yjs-/Crypto-Arbeit im
MCP; Konflikt-Handling bei parallelem Editieren (Yjs löst das, aber getestet werden muss es).

---

## Option B — Unverschlüsselte Boards mit Server-Elementen

Ein Board-Flag `encrypted: false`. Für solche Boards speichert der Server den
Yjs-State/die Elemente im Klartext (weiterhin at-rest verschlüsselt via
`yjs-encryption.ts`) und implementiert die ursprünglich gedachten
`/boards/:id/elements`-Routen serverseitig. Der Server kann dann selbst
`@skedra/canvas-core` + `ai-generation` nutzen.

**Schritte:** Board-Flag + Migration; `/elements`-CRUD in `v1.ts`; Web-App muss
für diese Boards den unverschlüsselten Sync-Pfad unterstützen.

**Vorteile:** Einfachste API (kein Client-Crypto), Agent braucht keinen Schlüssel.
**Nachteile:** E2EE fällt für diese Boards weg — sollte klar gekennzeichnet und
opt-in sein; zweiter Sync-Pfad in der Web-App erhöht die Komplexität.

---

## Empfehlung

**Option A als Hauptweg** — sie erhält das E2EE-Alleinstellungsmerkmal und
recycelt fast den kompletten vorhandenen Code (Layout, Crypto, Yjs). **Option B
optional** als per-Board-Opt-in für Team-/„KI-lastige" Boards, bei denen E2EE
bewusst nicht gebraucht wird.

Kleinster sinnvoller erster Schritt (MVP von A): nur **`create_board` + ein neues
Element-Update auf dem frischen (leeren) Board**. Da entfällt das
Laden/Entschlüsseln bestehender Updates komplett — man baut einen leeren Y.Doc,
fügt die generierten Elemente ein, verschlüsselt den vollen State und postet ihn.
Damit kann der Agent sofort „Erzeuge ein Kanban-Board zu Thema X" end-to-end.

---

## Aufwand / Risiko (grob)

| Schritt | Aufwand | Risiko |
|---------|---------|--------|
| A1 Sync-Kit in geteiltes Paket | M | niedrig (reines Verschieben) |
| A2 Crypto Node-fähig | S | niedrig |
| A3 REST `/updates`-Routen | M | mittel (Auth/keyHash sorgfältig) |
| A4 MCP-Tools + Diff-Logik | M–L | mittel (Yjs-Zustand, Konflikte) |
| A5 Schlüssel-Parameter | S | niedrig |
| B gesamt | L | höher (E2EE-Ausnahme, 2. Sync-Pfad) |

S = Stunden, M = ein paar Tage, L = größer.

---

## Offene Fragen

- Sollen Agent-Schreibzugriffe in der Board-Aktivität/-Historie als solche
  markiert werden (Nachvollziehbarkeit)?
- Braucht der MCP nur **Erzeugen** oder auch **Lesen** bestehender Elemente?
  (Lesen erfordert immer das Entschlüsseln des ganzen Logs im Agent.)
- Getrennter API-Key-Scope für Canvas-Schreibzugriff (z. B. `canvas:write`),
  damit reine Board-Verwaltungs-Keys keine Inhalte ändern können?
