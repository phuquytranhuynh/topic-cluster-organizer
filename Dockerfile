# Single-image deploy: one Node process serves both the API and the built React frontend.
# Build from the repo root: docker build -t topic-cluster-organizer .

# ---- Stage 1: build the frontend (Vite/React) ----
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# ---- Stage 2: build the server (Express/TypeScript/Prisma) ----
FROM node:22-alpine AS server-build
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/prisma ./prisma
COPY server/src ./src
# tsc build + `prisma generate` (see server/package.json's build script) — the generated Prisma
# client ends up in node_modules/@prisma/client and node_modules/.prisma, both alpine/musl builds,
# matching the runtime stage below.
RUN npm run build

# ---- Stage 3: runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Ship the whole node_modules built in stage 2 (includes the `prisma` CLI, needed at container start
# to run `prisma migrate deploy`) rather than reinstalling — avoids any drift between build and run.
COPY --from=server-build /app/node_modules ./node_modules
COPY --from=server-build /app/dist ./dist
COPY --from=server-build /app/prisma ./prisma
COPY --from=server-build /app/package.json ./package.json
COPY --from=frontend-build /app/dist ./public
COPY server/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
