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
  && adduser -S nodejs -u 1001 -G nodejs

ENV NODE_ENV=production

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs package.json package-lock.json ./
COPY --chown=nodejs:nodejs apps/api-gateway ./apps/api-gateway

USER nodejs

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS http://127.0.0.1:4000/api/v1/health || exit 1

CMD ["node", "apps/api-gateway/src/app.js"]
