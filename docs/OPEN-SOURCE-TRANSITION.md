# Open-source project transition

Skedra is moving to one fully open-source, self-hosted project under AGPL-3.0-only. `moonriddim/skedra-community` remains the canonical repository and keeps its existing public history, issues and releases.

## What changes

- All applications, editor packages, SDK, docs and deployment sources use AGPL-3.0-only.
- Subscription checkout, Stripe webhooks, trials and subscription access checks are removed.
- The private-to-community export workflow is removed. Checks, container releases and SDK publishing run directly in the public repository.
- `apps/docs` builds the static project website. The public domain provides documentation and links to releases and self-hosting.
- The default shape-library catalog belongs to the local installation. Optional remote catalogs require an explicit operator-supplied URL.
- Library review and publication move from the private operations dashboard into the app's administrator-only System settings.
- Product analytics and installation reporting are removed, including reporting from previously opted-in instances.

## Existing self-hosted installations

Back up PostgreSQL, asset files and instance secrets before upgrading. Keep the same encryption secrets, storage credentials, volumes and public URLs. Set `SKEDRA_DEPLOYMENT_MODE=selfhost`, or remove the variable to use the default. The retired `managed` mode is rejected at startup.

Old subscription, access-grant and statistics tables are retained for non-destructive upgrades. They no longer determine access or send reports. No migration drops existing boards, accounts or encrypted data.

The new default library catalog is local. Existing custom remote catalogs remain supported when their API URL is configured. Remove the old `libraries.skedra.xyz` URL if it still appears in your environment.

Email verification is optional. Set `SKEDRA_REQUIRE_EMAIL_VERIFICATION=true` only after configuring SMTP and confirming verification mail delivery.

The new images are published after this change is merged and the release workflow succeeds. Older tags retain their original behavior and licensing.

## Repository consolidation

Apply the reviewed source changes to a branch based on the current public repository. Preserve its history and any community changes. Do not force-push private source history over the public repository.

After merge, update developer checkouts to use the public remote:

```bash
git remote set-url origin https://github.com/moonriddim/skedra-community.git
git fetch origin
```

Because the old private and public repositories have different histories, use a fresh clone for subsequent development rather than merging the private `main` into public `main`.

Archive the old private `moonriddim/Skedra` repository after verifying that all needed code and outstanding work have been transferred. Remove the community deploy key and retired VPS deployment secrets from GitHub. Archiving preserves a recoverable record of the old project; deleting it is a separate decision.

Update the npm trusted-publisher configuration for `@skedra/react` to permit the release workflow in `moonriddim/skedra-community`. The old private-repository trust does not automatically authorize this repository.

## Public website

Build the site with `pnpm docs:build`. Deploy only `apps/docs/dist` to a static web host for `skedra.xyz`; it requires no database or API proxy. Preview with `pnpm docs:dev` on port 5176. The documentation workflow uploads the built site as a downloadable artifact.

The existing website and hosted API continue to run until the infrastructure is switched. Publish the static site first as a preview and verify navigation, downloads and documentation. Remove the old API proxy when switching the public domain.

## Retiring a previously hosted service

Before stopping an installation used by other people, provide a migration/export window and verify data backups. Users must export their boards or migrate their installation data; replacing the public site does not transfer their accounts or boards to a new server.

Existing Stripe subscriptions must be resolved in Stripe before shutting down the old service. Removing billing code does not cancel existing subscriptions. Keep the old service accessible as needed to complete exports and billing changes, then retire its app/API containers. This repository change does not stop servers, cancel charges or delete user data.

Update or withdraw any public MCP registry listing and plugin submission that still advertises `https://skedra.xyz/api/mcp`. The project no longer publishes metadata promising a centrally hosted MCP service.
