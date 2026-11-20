# =============================================================================
# API Connecteo — image multi-étapes
#   build   : dépendances complètes, client Prisma, compilation TypeScript
#   migrate : réutilise « build » (le CLI Prisma est une dépendance de dev) pour
#             appliquer les migrations, puis s'arrête (service « migrate » du compose)
#   runtime : uniquement dist/ et les dépendances de production, utilisateur non root
# Render n'utilise pas ce fichier (runtime: node dans render.yaml).
# =============================================================================

FROM node:22-slim AS build

# OpenSSL : requis par le moteur Prisma (migrate deploy) ; absent de l'image slim.
RUN apt-get update -y &&     apt-get install -y --no-install-recommends openssl ca-certificates &&     rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
# Caches npm et Prisma conservés entre deux builds : une connexion coupée ne fait
# pas tout retélécharger, et les nouvelles tentatives réseau sont plus nombreuses.
RUN --mount=type=cache,target=/root/.npm     --mount=type=cache,target=/root/.cache/prisma     npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY prisma ./prisma/
COPY prisma.config.ts tsconfig.json ./
COPY src ./src/

# Le client Prisma est généré dans src/generated puis compilé dans dist/generated.
RUN npx prisma generate && npm run build

# --- Migrations (et seed) : lancé une fois avant l'API -----------------------
FROM build AS migrate

USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# --- Production ---------------------------------------------------------------
FROM node:22-slim AS runtime

ENV NODE_ENV=production

RUN groupadd --gid 1001 connecteo && \
    useradd --uid 1001 --gid connecteo --shell /bin/sh --create-home connecteo

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm     npm ci --omit=dev --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY --from=build /app/dist ./dist/

# Le code reste à root (lecture seule pour l'application) ; seul uploads/ est accessible en écriture.
RUN mkdir -p uploads && chown connecteo:connecteo uploads

USER connecteo

EXPOSE 3000

CMD ["node", "dist/server.js"]
