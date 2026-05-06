# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

RUN addgroup -S nodejs \
  && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]