# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile --ignore-scripts

# ─── Development ──────────────────────────────────────────────────────────────
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
WORKDIR /app/apps/api
RUN pnpm prisma generate
EXPOSE 3000
CMD ["pnpm", "run", "dev"]

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
WORKDIR /app/apps/api
RUN pnpm prisma generate
RUN pnpm build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS production
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Installer seulement les dépendances de production
COPY apps/api/package.json .
COPY pnpm-lock.yaml .
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Copier le build et Prisma
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/api/prisma ./prisma

# Utilisateur non-root
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "dist/main"]
