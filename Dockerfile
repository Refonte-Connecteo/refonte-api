# =============================================================================
# API Connecteo — image multi-étapes
#   build   : dépendances complètes, client Prisma, compilation TypeScript
#   migrate : réutilise « build » (le CLI Prisma est une dépendance de dev) pour
#             appliquer les migrations, puis s'arrête (service « migrate » du compose)
#   runtime : uniquement dist/ et les dépendances de production, utilisateur non root
# Render n'utilise pas ce fichier (runtime: node dans render.yaml).
# =============================================================================

FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

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
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist/

# Le code reste à root (lecture seule pour l'application) ; seul uploads/ est accessible en écriture.
RUN mkdir -p uploads && chown connecteo:connecteo uploads

USER connecteo

EXPOSE 3000

CMD ["node", "dist/server.js"]
