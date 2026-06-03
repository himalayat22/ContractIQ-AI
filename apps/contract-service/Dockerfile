# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps ./apps

RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl \
  && addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -u 1001 -G nodejs \
  && mkdir -p /app/apps/contract-service/uploads \
  && chown -R nodejs:nodejs /app/apps/contract-service/uploads

ENV NODE_ENV=production
ENV CONTRACT_UPLOAD_DIR=/app/apps/contract-service/uploads

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs package.json package-lock.json ./
COPY --chown=nodejs:nodejs apps/contract-service ./apps/contract-service

USER nodejs

EXPOSE 4002

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS http://127.0.0.1:4002/api/v1/health || exit 1

CMD ["node", "apps/contract-service/src/index.js"]
