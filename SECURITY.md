# Security policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately to
[support@skedra.xyz](mailto:support@skedra.xyz), with the subject
"Skedra security report". Do not disclose vulnerabilities in public issues,
pull requests, or Discord messages before a fix or coordinated disclosure.

Include, when available:

- The affected component, version, commit, or Docker image tag/digest.
- Whether the issue affects self-hosted Skedra, the hosted service, or an SDK.
- Reproduction steps or a minimal proof of concept.
- The potential impact and any required access or configuration.
- A way to contact you for follow-up and your attribution preference.

Remove passwords, API keys, session tokens, and private board or user data from
reports. Use accounts and instances you control for reproduction.

## Updates and supported versions

Security fixes target the latest Community release and the current `main`
branch. Older releases, development forks, and modified deployments do not have
a guaranteed backport policy. Self-hosted operators should keep their installation
and dependencies up to date and review the release notes when upgrading.

## Handling reports

The maintainer will investigate reports, request more information where needed,
and coordinate remediation and disclosure with the reporter. Response and fix
times depend on severity and available capacity; no fixed response time is
guaranteed. Please allow time for investigation before publishing details that
could put other users at risk.

For ordinary bugs and setup questions, use the repository's issue templates or
the community links in the README.
