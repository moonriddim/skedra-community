// Offline regression entry point for the findings from 2026-10-10.
// Run in apps/api: node --import tsx ../../scripts/security-audit-2026-10-10.mjs
// Uses mocked database/fetch calls and an in-memory auth adapter. No live URLs,
// real credentials, SMTP, or production database are used.
import "../apps/api/src/lib/mcp-token-security.test.ts";
import "../apps/api/src/lib/ai-provider-policy.test.ts";
import "../apps/api/src/lib/auth-security-options.test.ts";
