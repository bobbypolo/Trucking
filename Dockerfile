# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies (including devDeps for TypeScript compilation)
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY server/package*.json ./server/
RUN cd server && npm ci --ignore-scripts

# Copy source and compile server TypeScript
COPY server/ ./server/
RUN cd server && npx tsc

# Copy frontend source and build Vite bundle
COPY . .
RUN npm run build

# ── Stage 2: Production runtime ─────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copy compiled server + production dependencies only
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/dist ./dist

# Note: serviceAccount.json is mounted via Cloud Run secret at runtime
# DO NOT bake credentials into the image

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

CMD ["node", "server/dist/index.js"]
