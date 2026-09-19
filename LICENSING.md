# Skedra Community licensing

The [Skedra Community License 1.0](LICENSE), dated 2026-09-19, applies to
versions released with it. This is source-available software with restrictions
on independent products and hosted services, not Open Source software.
The license text controls; this page explains its intent and practical scope.

## What you can do

| Activity | Under the Community license |
| --- | --- |
| Download, inspect, build, and try Skedra | Allowed |
| Self-host for personal use or your organization's work | Allowed, including internal commercial use |
| Modify your internal instance | Allowed; no obligation to submit your changes |
| Invite collaborators to work on your organization's boards | Allowed for that work |
| Publish boards, diagrams, or exports, including commercially | Allowed; your original content remains yours |
| Pay a contractor to install or maintain your own instance under your control | Allowed |
| Create an unofficial development fork, fix bugs, and submit pull requests | Allowed, even if changes are not merged |
| Launch a renamed, white-label, or independently marketed derivative | Requires a separate written license |
| Offer Skedra or a modified version as a hosted service to customers or the public | Requires a separate written license, even when free |
| Use the SDK or other Skedra components in a separately offered product | Requires a separate written license |

Giving clients access to particular boards for your own project work is different
from offering clients a general-purpose whiteboard service. The former is
permitted collaboration; the latter requires a separate agreement. Internal
business use is permitted even when the business earns money from its own work.

## One license across Skedra's own Community code

The same terms cover the Community web app, API, MCP server, library-catalog
application, database and shared code, all canvas/editor packages, the React
SDK, Skedra documentation, and self-hosting/build/deployment files. This includes
`canvas-core`, `canvas-editor`, `canvas-io`, `canvas-react`, and `react`; these
versions do not have a separate MIT exception. `SELFHOST_LICENSE` carries the
same text so standalone deployment bundles contain the full terms.

Third-party dependencies, separately licensed assets, and community-submitted
shape libraries retain their own licenses. For example, the MIT license on an
independently submitted `.skedralib` file covers that content, not the Skedra
application or SDK. This change does not relicense third-party works.

## Earlier releases and contributions

Earlier Community releases were offered under AGPL-3.0-only, with MIT terms on
specified editor packages and deployment files. Those grants are not revoked.
Existing recipients can continue to exercise those rights, including lawful
redistribution and further development under the earlier licenses.

The transition begins with the version/commit that introduces this license;
the date in the license is not a retroactive cutoff. Earlier Git history, tags,
downloads, container images, and npm packages keep their applicable terms.
Do not overwrite old tags or artifacts to suggest their licenses have changed.
New restrictions cannot undo permissions already granted for the same material.

New contributions follow [CONTRIBUTING.md](CONTRIBUTING.md) and section 5 of the
license. Existing third-party contributions require the necessary permission
before they can be offered under different terms. Git authorship alone is not
proof of ownership or permission to relicense.

## Contact

For a separate agreement or clarification about an intended use, contact
support@skedra.xyz.
