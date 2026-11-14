# refonte-api

Projet Express.js minimal.

## Démarrage

```bash
npm install
npm run dev
```

## Lancer avec Docker (base + API + site)

Prérequis : Docker Desktop, GNU Make, Node.js, et le dépôt du site cloné **à côté**
de celui-ci (`../front`). Toutes les commandes se lancent depuis `back/`.

```bash
make init   # une seule fois : crée docker.env (mot de passe PostgreSQL aléatoire)
make up     # construit et démarre : base, migrations, API, site
make logs   # journaux (make logs s=api pour un seul service)
make down   # arrête (les données sont conservées)
make        # liste de toutes les commandes
```

- Site : http://localhost:3001, API : http://localhost:3000/health.
- La base Docker (`connecteo`) est neuve et distincte de votre base locale.
  `make seed` la remplit, `make psql` ouvre une console SQL.
- `.env` (secrets de l'API) est lu tel quel ; l'adresse de la base y est remplacée
  automatiquement par celle du conteneur.
- `make clean CONFIRM=oui` efface définitivement la base et les fichiers déposés.

Sous Windows, `make` s'installe par exemple avec `winget install GnuWin32.Make` ou
`choco install make`, et s'utilise depuis Git Bash.

## Ports

Deux processus distincts, un port différent chacun (sinon `EADDRINUSE`) :

| Service | Port | Commande                       | URL                      |
| ------- | ---- | ------------------------------ | ------------------------ |
| back    | 3000 | `cd back && npm run dev`       | http://localhost:3000    |
| front   | 3001 | `cd front && npm run dev`      | http://localhost:3001    |

Le port du back se règle via `PORT` dans `back/.env`. `FRONTEND_URL` doit pointer
sur le port réel du front : c'est l'origine autorisée par la config CORS de l'API.
Si le port 3000 est déjà pris, le back s'arrête avec un message explicite.

## Endpoints

- `GET /` retourne un message de bienvenue.
- `GET /health` retourne l'état de santé de l'API.