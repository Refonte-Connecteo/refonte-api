# refonte-api

Projet Express.js minimal.

## Démarrage

```bash
npm install
npm run dev
```

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