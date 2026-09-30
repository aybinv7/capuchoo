# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter "{services/server}..." run build \
 && pnpm --filter "{apps/dashboard}..." run build \
 && pnpm --filter @capuchoo/server deploy --prod --legacy /out/server

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DASHBOARD_DIR=/app/dashboard \
    STORAGE_DIR=/data/artefacts
WORKDIR /app
COPY --from=build --chown=node:node /out/server /app/server
COPY --from=build --chown=node:node /repo/apps/dashboard/dist /app/dashboard
RUN mkdir -p /data/artefacts && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "server/dist/main.mjs"]
