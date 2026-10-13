# Project scope

Skedra is one open-source, self-hosted project under AGPL-3.0-only.
All development, issues, pull requests, SDK releases and container images belong
to [moonriddim/skedra-community](https://github.com/moonriddim/skedra-community).

The project includes the complete web app, API, database, collaboration, comments,
accounts, teams, libraries, MCP server and reusable canvas/React packages. There
are no paid feature gates, trials, license checks or private product extensions.

`apps/docs` is the independent static website for skedra.xyz. It helps visitors
understand, install, operate and contribute to Skedra. It has no app backend,
accounts, subscription checkout or hosted whiteboard/MCP service.

Instances operate their own infrastructure, authentication and storage. Optional
AI providers, SMTP, social login, object storage, remote catalogs and LiveKit are
configured by operators. The default catalog is local. Central installation
reporting and product analytics have been removed.

Repository boundaries separate applications and reusable packages, not editions.
The same editor and canvas model power the app, SDK and agent workflows.
