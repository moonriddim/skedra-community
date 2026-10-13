FROM node:22-alpine AS build
WORKDIR /app
COPY apps/docs ./apps/docs
COPY apps/web/public/logo-mark-transparent-dark.png ./apps/web/public/logo-mark-transparent-dark.png
COPY apps/web/public/readme/skedra-whiteboard.png ./apps/web/public/readme/skedra-whiteboard.png
COPY docs ./docs
COPY packages/react/README.md ./packages/react/README.md
COPY SELFHOST.md CONTRIBUTING.md LICENSING.md ./
RUN node apps/docs/build.mjs && node --test apps/docs/build.test.mjs

FROM nginx:1.27-alpine
COPY LICENSE /usr/share/doc/skedra/LICENSE
COPY deploy/docs/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/docs/dist /usr/share/nginx/html
EXPOSE 80
