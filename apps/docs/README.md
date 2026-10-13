# Skedra website

The public website is a static project and documentation site. The self-hosted
whiteboard remains in `apps/web`. This website has no app backend, login,
checkout, hosted MCP endpoint, analytics script or remote font dependency.

From the repository root:

```bash
node apps/docs/build.mjs
node --test apps/docs/build.test.mjs
node apps/docs/serve.mjs
```

The preview is available on `http://localhost:5176`. Set `SKEDRA_DOCS_PORT` to use
another port. The workspace aliases are `pnpm docs:build` and `pnpm docs:dev`.

Deploy only `apps/docs/dist` to a static host. It contains complete HTML pages,
styles, local images, a sitemap, robots.txt and llms.txt. Serve directory index
files and return `404.html` with status 404 for unknown routes. Do not proxy `/api`
to the old hosted application.

An optional standalone website container is provided:

```bash
docker build -f deploy/docs/Dockerfile -t skedra-docs .
docker run -d --name skedra-docs -p 8080:80 skedra-docs
```

The documentation workflow builds and checks the site and uploads it as an
artifact. It does not switch the existing production domain or stop old services.
Follow [the transition guide](../../docs/OPEN-SOURCE-TRANSITION.md) for that step.
