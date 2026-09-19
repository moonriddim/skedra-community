# Skedra Community Scope

Skedra has a source-available Community edition. The goal is simple:
self-hosted Skedra should be useful, inspectable, and trustworthy.

## Source-Available Community Edition

The Community edition is source available and includes the full self-hostable
workspace needed by individuals and teams:

- Workspace web app and authenticated app shell.
- Accounts, login, invite-based registration, and basic user settings.
- Workspaces, teams, board membership, team roles, and board access grants.
- Persisted boards, database schema, migrations, activity history, and exports.
- Encrypted collaboration backend for shared canvas editing.
- Comments, mentions, comment resolution, and board activity.
- Shape libraries, local/self-hosted library workflows, and community catalog
  integration.
- Self-host Docker Compose files, standalone image build, migrations, and
  operational documentation.
- Bring-your-own-key and local AI integration points where they are useful for
  self-hosted installs.

The editor packages use the same Skedra Community License 1.0:

- `packages/canvas-core`: scene model, element types, geometry, hit testing,
  ordering, selection, snapping, path rendering, import helpers, and canvas
  domain logic.
- `packages/canvas-editor`: storage-independent editor gestures and shared React
  interaction UI. Path drawing, start snapping, closing, point editing, and path
  mode behavior live here once and are adapted by both Community and SDK.
- `packages/canvas-react`: shared React/SVG canvas rendering.
- `packages/canvas-io`: file, clipboard, import/export, and document codecs.
- `packages/react`: auth-free React canvas SDK, local/controlled state, tool UI,
  factories, templates, and typed workspace integration hooks.

All Skedra-owned Community code, SDK packages, and deployment files use the
[Skedra Community License 1.0](LICENSE). Self-hosting for personal and internal
business use and contributions are allowed. Independent products, rebranding,
and third-party hosted services require a separate written license. Third-party
material retains its own terms. See [LICENSING.md](LICENSING.md) for examples
and the preservation of earlier AGPL/MIT rights.

## Public Repository And Images

The public Skedra source repository contains the Community edition:

- `apps/web`, `apps/api`, `apps/libraries`, and `apps/mcp`.
- `packages/db`, `packages/shared`, `packages/canvas-core`,
  `packages/canvas-editor`, `packages/canvas-io`, `packages/canvas-react`, and
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
belongs in the self-hostable Community edition.
