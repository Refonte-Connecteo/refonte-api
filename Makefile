# =============================================================================
# Connecteo — raccourcis Docker Compose (à lancer depuis back/)
#   make            liste des commandes
#   make init       crée docker.env (mot de passe PostgreSQL aléatoire), une seule fois
#   make up         construit et démarre base + migrations + API + site
# Prérequis : Docker Desktop (Compose v2), GNU Make, Node.js (pour make init).
# front/ doit se trouver à côté de back/ : le site est construit depuis ../front.
# =============================================================================

# Variables Compose séparées de .env (secrets de l'API, lus par le conteneur api).
ENV_DOCKER := docker.env
COMPOSE := docker compose --env-file $(ENV_DOCKER)
# Service visé par logs, shell, restart… (ex. : make logs s=api)
s ?=

.DEFAULT_GOAL := help
.PHONY: help init check-env up up-fg down stop start restart build rebuild logs ps \
        migrate seed psql shell config clean

help: ## Affiche cette aide
	@echo "Commandes disponibles :"
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  make %-10s %s\n", $$1, $$2}'
	@echo ""
	@echo "Site : http://localhost:3001   API : http://localhost:3000/health"

init: ## Crée docker.env à partir de docker.env.example (mot de passe aléatoire)
ifeq ($(wildcard $(ENV_DOCKER)),)
	@node -e "const fs=require('fs');const p=require('crypto').randomBytes(24).toString('hex');fs.writeFileSync('docker.env',fs.readFileSync('docker.env.example','utf8').replace('POSTGRES_PASSWORD=','POSTGRES_PASSWORD='+p))"
	@echo "docker.env créé (mot de passe PostgreSQL généré, ne le commitez pas)."
else
	@echo "docker.env existe déjà : rien à faire."
endif
ifeq ($(wildcard .env),)
	@echo "ATTENTION : .env est absent. Copiez .env.example en .env et remplissez les secrets."
endif
ifeq ($(wildcard ../front/package.json),)
	@echo "ATTENTION : ../front introuvable. Le dépôt du site doit être à côté de back/."
endif

check-env:
ifeq ($(wildcard $(ENV_DOCKER)),)
	$(error $(ENV_DOCKER) manquant : lancez d'abord « make init »)
endif
ifeq ($(wildcard .env),)
	$(error .env manquant : copiez .env.example en .env et remplissez les secrets)
endif
ifeq ($(wildcard ../front/package.json),)
	$(error ../front introuvable : le dépôt du site doit être à côté de back/)
endif

up: check-env ## Construit et démarre tout en arrière-plan
	$(COMPOSE) up -d --build
	@echo "Site : http://localhost:3001   API : http://localhost:3000/health"

up-fg: check-env ## Comme up, mais au premier plan (journaux affichés, Ctrl+C pour arrêter)
	$(COMPOSE) up --build

down: ## Arrête et supprime les conteneurs (les données sont conservées)
	$(COMPOSE) down

stop: ## Met les conteneurs en pause sans les supprimer
	$(COMPOSE) stop $(s)

start: check-env ## Relance des conteneurs arrêtés par make stop
	$(COMPOSE) start $(s)

restart: check-env ## Redémarre tout, ou un service : make restart s=api
	$(COMPOSE) restart $(s)

build: check-env ## Reconstruit les images
	$(COMPOSE) build $(s)

rebuild: check-env ## Reconstruit sans cache puis redémarre
	$(COMPOSE) build --no-cache $(s)
	$(COMPOSE) up -d

logs: ## Suit les journaux : make logs, ou make logs s=api
	$(COMPOSE) logs -f --tail=100 $(s)

ps: ## État des conteneurs
	$(COMPOSE) ps -a

migrate: check-env ## Applique les migrations Prisma
	$(COMPOSE) run --rm migrate

seed: check-env ## Remplit la base avec les données de départ (prisma/seed.ts)
	$(COMPOSE) run --rm migrate npx prisma db seed

psql: ## Console SQL sur la base Docker
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

shell: ## Terminal dans un conteneur : make shell s=api (api par défaut)
	$(COMPOSE) exec $(or $(s),api) sh

config: ## Vérifie et affiche la configuration Compose finale
	$(COMPOSE) config

clean: ## SUPPRIME la base et les fichiers déposés : make clean CONFIRM=oui
ifneq ($(CONFIRM),oui)
	@echo "Cette commande efface définitivement la base Docker et les uploads."
	@echo "Pour confirmer : make clean CONFIRM=oui"
else
	$(COMPOSE) down -v --remove-orphans
endif
