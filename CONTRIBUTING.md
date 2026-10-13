# Contributing to Skedra

Bug reports, fixes, documentation, translations and accessibility improvements
are welcome. For a large feature, open an issue first to discuss its scope.

The complete project is maintained in
[moonriddim/skedra-community](https://github.com/moonriddim/skedra-community).
There is no private development mirror or separate commercial edition.

Follow our [Code of Conduct](CODE_OF_CONDUCT.md). Report suspected vulnerabilities
privately using [SECURITY.md](SECURITY.md).

## License

Skedra is licensed under [AGPL-3.0-only](LICENSE). By intentionally submitting a
contribution for inclusion, you offer it under that same license. You retain your
copyright. No additional commercial license grant or copyright assignment is required.

Only submit material you have the rights to contribute. Identify third-party code,
assets and licenses and preserve their notices. See [LICENSING.md](LICENSING.md).

## Development

Follow [README.md](README.md) for local setup. Keep editor behavior shared between
the app and SDK; `pnpm sdk:verify` checks their boundary and parity.

Before opening a pull request:

- Explain the problem, resulting behavior and verification.
- Run the checks appropriate to the affected packages; `pnpm lint` and `pnpm test`
  run the project checks.
- Exclude secrets, private instance data and generated build files.
- Preserve copyright, license and third-party notices.

Website documentation is built from repository Markdown with `pnpm docs:build`.
Run `pnpm docs:dev` to preview it locally on port 5176.
