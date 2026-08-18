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

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY src ./src/
RUN npx prisma generate

COPY --from=build /app/dist ./dist/

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
