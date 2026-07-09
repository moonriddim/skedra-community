# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

FROM base AS build
ARG VITE_APP_URL=http://localhost:5174
ARG VITE_LIBRARIES_URL=http://localhost:5175
ARG VITE_API_URL=
ARG VITE_REALTIME_URL=
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_LIBRARIES_URL=$VITE_LIBRARIES_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_REALTIME_URL=$VITE_REALTIME_URL
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM base AS standalone-build
ARG VITE_APP_URL=http://localhost:3000
ARG VITE_LIBRARIES_URL=http://localhost:3000/libraries
ARG VITE_API_URL=
ARG VITE_REALTIME_URL=
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_LIBRARIES_URL=$VITE_LIBRARIES_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_REALTIME_URL=$VITE_REALTIME_URL
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @skedra/canvas-core build
RUN pnpm --filter @skedra/react build
RUN pnpm --filter @skedra/web build
RUN VITE_BASE_PATH=/libraries/ pnpm --filter @skedra/libraries build

FROM base AS server
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3001 1235

FROM build AS schema-export
RUN cd packages/db && pnpm exec drizzle-kit export --dialect postgresql --schema src/schema.ts > /schema.sql

FROM build AS api-package
RUN pnpm --filter @skedra/api deploy --prod --legacy /runtime/api
RUN pnpm exec esbuild apps/api/src/index.ts \
    --bundle \
    --platform=node \
    --format=esm \
    --target=node22 \
    --minify \
    --outfile=/runtime/api/index.js \
    --external:@hono/node-server \
    --external:@trpc/server \
    --external:better-auth \
    --external:drizzle-orm \
    --external:hono \
    --external:nodemailer \
    --external:yjs \
    --external:zod
RUN rm -rf /runtime/api/src /runtime/api/dist /runtime/api/.turbo /runtime/api/.tmp /runtime/api/tsconfig.json /runtime/api/node_modules/@skedra

FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache postgresql-client
COPY --from=api-package /runtime/api ./
COPY --from=schema-export /schema.sql /app/schema.sql
COPY deploy/db/selfhost-migrations.sql /app/selfhost-migrations.sql
COPY deploy/api/start-with-migrations.sh /app/start-with-migrations.sh
RUN chmod +x /app/start-with-migrations.sh
EXPOSE 3001
CMD ["/app/start-with-migrations.sh"]

FROM build AS realtime-package
RUN pnpm --filter @skedra/realtime deploy --prod --legacy /runtime/realtime
RUN pnpm exec esbuild apps/realtime/src/index.ts \
    --bundle \
    --platform=node \
    --format=esm \
    --target=node22 \
    --minify \
    --outfile=/runtime/realtime/index.js \
    --external:@hocuspocus/extension-database \
    --external:@hocuspocus/server \
    --external:drizzle-orm \
    --external:zod
RUN rm -rf /runtime/realtime/src /runtime/realtime/dist /runtime/realtime/.turbo /runtime/realtime/.tmp /runtime/realtime/tsconfig.json /runtime/realtime/node_modules/@skedra

FROM node:22-alpine AS realtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=realtime-package /runtime/realtime ./
EXPOSE 1235
CMD ["node", "index.js"]

FROM nginx:1.27-alpine AS web
COPY deploy/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80

FROM nginx:1.27-alpine AS libraries
COPY deploy/nginx/libraries.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build /app/apps/libraries/dist /usr/share/nginx/html
EXPOSE 80

FROM node:22-alpine AS standalone
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache nginx postgresql16 postgresql16-client su-exec
COPY --from=api-package /runtime/api /app/api
COPY --from=realtime-package /runtime/realtime /app/realtime
COPY --from=schema-export /schema.sql /app/api/schema.sql
COPY deploy/db/selfhost-migrations.sql /app/api/selfhost-migrations.sql
COPY --from=standalone-build /app/apps/web/dist /usr/share/skedra/web
COPY --from=standalone-build /app/apps/libraries/dist /usr/share/skedra/libraries
COPY deploy/standalone/nginx.conf /etc/nginx/http.d/default.conf
COPY deploy/standalone/start.sh /app/start-standalone.sh
RUN chmod +x /app/start-standalone.sh
VOLUME ["/data"]
EXPOSE 80
HEALTHCHECK CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
CMD ["/app/start-standalone.sh"]
