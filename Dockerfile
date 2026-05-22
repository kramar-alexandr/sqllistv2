# ── Stage 1: build React client ──────────────────────────────────────────────
FROM node:22-alpine AS build-client
WORKDIR /build
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 2: production server ────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./
COPY --from=build-client /build/dist ./public

EXPOSE 3001
CMD ["node", "src/server.js"]
