# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter "{apps/dashboard}..." run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY deploy/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/dashboard/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /repo/apps/dashboard/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
