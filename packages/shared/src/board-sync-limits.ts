/**
 * Gemeinsame Größenlimits für den Board-Sync (API und Web-Client).
 *
 * Alle Werte zählen Zeichen des base64-kodierten Updates bzw. Ciphertexts, so
 * wie sie im tRPC-Request stehen. Die interne NGINX-Konfiguration erlaubt 100 MB
 * pro Request und liegt damit deutlich über diesen Werten.
 */

/**
 * Maximale Länge eines einzelnen Sync-Payloads (append/compact).
 * Ein Snapshot enthält den gesamten Board-Zustand; ist das Limit zu klein,
 * scheitert die Komprimierung dauerhaft und das Update-Log wächst ohne Ende.
 */
export const BOARD_SYNC_UPDATE_MAX_CHARS = 16_000_000;

/**
 * Zielgröße einer Seite von `list*UpdatePage`. Die API füllt eine Seite nur bis
 * zu diesem Budget (mindestens aber eine Zeile), damit das Laden eines großen,
 * noch nicht komprimierten Logs in handliche Requests zerfällt.
 */
export const BOARD_SYNC_PAGE_MAX_CHARS = 4_000_000;
