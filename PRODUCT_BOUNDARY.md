# Skedra Product Boundary

Skedra is an open-core product with a strong open-source Community edition.
The goal is simple: self-hosted Skedra should be useful, inspectable, and
trustworthy without needing a commercial license.

## Open-Source Community Edition

The Community edition is open source and includes the full self-hostable
workspace needed by individuals and teams:

- Workspace web app and authenticated app shell.
- Accounts, login, invite-based registration, and basic user settings.
- Workspaces, teams, board membership, board-level roles, and permissions.
- Persisted boards, database schema, migrations, activity history, and exports.
- Realtime collaboration backend for shared canvas editing.
- Comments, mentions, comment resolution, and board activity.
- Shape libraries, local/self-hosted library workflows, and community catalog
  integration.
- Self-host Docker Compose files, standalone image build, migrations, and
  operational documentation.
- Bring-your-own-key and local AI integration points where they are useful for
  self-hosted installs.

The reusable editor packages remain MIT licensed:

- `packages/canvas-core`: scene model, element types, geometry, hit testing,
  ordering, selection, snapping, path rendering, import helpers, and canvas
  domain logic.
- `packages/react`: auth-free React canvas SDK, local/controlled state, tool UI,
  factories, templates, and typed workspace integration hooks.

The wider Community workspace source is licensed under `AGPL-3.0-only` unless a
file or directory has its own license.

## Commercial And Hosted Skedra

Commercial value should live around operations, enterprise controls, managed
services, and support rather than hiding the core collaboration product.

Commercial or hosted-only features may include:

- Skedra Cloud hosting, managed upgrades, backups, monitoring, and uptime/SLA.
- SSO/SAML/OIDC, SCIM, enterprise identity policy, and domain controls.
- Enterprise roles, audit logs, retention, legal hold, compliance workflows, and
  advanced admin controls.
- Managed AI gateway, hosted model routing, credit limits, team AI policy, and
  provider billing.
- Billing, subscriptions, usage metering, plan management, and payment systems.
- Premium integrations with external SaaS products.
- Priority support, migration help, onboarding, and enterprise services.

These features should be isolated from the Community edition with explicit
module boundaries and clear license notices. Community code must continue to
build and run without private services.

## Public Repository And Images

This public OSS repository contains the Skedra Community edition:

- `apps/web`, `apps/api`, `apps/realtime`, `apps/libraries`, and `apps/mcp`.
- `packages/db`, `packages/shared`, `packages/canvas-core`, and
  `packages/react`.
- Dockerfiles, Compose files, standalone image scripts, migrations, and release
  workflows for Community self-hosting.

It must not contain:

- Secrets, production credentials, private infrastructure state, or unpublished
  assets.
- Skedra Cloud operational credentials or customer data.
- Commercial-only source unless it is intentionally published with a compatible
  license and clear gating.

## Rule Of Thumb

If a feature is needed to run a serious self-hosted collaborative workspace, it
belongs in the open Community edition. If it is about managed hosting,
enterprise governance, billing, proprietary integrations, or Skedra-operated
services, it can be commercial.
