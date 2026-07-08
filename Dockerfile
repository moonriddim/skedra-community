FROM --platform=${BUILDPLATFORM} node:24-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml biome.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @skedra/app build

FROM nginx:stable-alpine-slim

COPY apps/app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/app/dist /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
