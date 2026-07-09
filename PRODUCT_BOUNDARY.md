# Skedra Community Scope

Skedra has a strong open-source Community edition. The goal is simple:
self-hosted Skedra should be useful, inspectable, and trustworthy.

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
- Private operational credentials or customer data.
- Private deployment, release, or mirror automation that is specific to the
  maintainer's infrastructure.

## Rule Of Thumb

If a feature is needed to run a serious self-hosted collaborative workspace, it
belongs in the open Community edition.
