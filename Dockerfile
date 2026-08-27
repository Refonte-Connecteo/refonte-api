FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY src ./src/
COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY tsconfig.json ./

RUN npx prisma generate
RUN npm run build

# --- Production stage ---
FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1001 connecteo && \
    useradd --uid 1001 --gid connecteo --shell /bin/sh --create-home connecteo

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY src ./src/
RUN npx prisma generate

COPY --from=build /app/dist ./dist/

RUN mkdir -p uploads && chown -R connecteo:connecteo /app

USER connecteo

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
