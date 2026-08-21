# Matrice des flux réseau — API Connecteo

Conformité : exigence de sécurité « Une matrice des flux (entrants et sortants) est établie et son respect est imposé par un filtrage réseau. »

**Portée** : serveur Linux/Ubuntu hébergeant Nginx (reverse proxy), l'application Node.js/Express et PostgreSQL.

**Mécanisme d'application** : le filtrage est imposé par UFW (pare-feu hôte) via `scripts/setup-firewall.sh` (`Default Deny` entrant) et par le principe d'isolation locale : les services internes (API Node, BDD) ne sont joignables que via `127.0.0.1`.

---

## 1. Vue d'architecture

```
                     Internet
                        │
            ┌───────────▼───────────┐
            │   UFW — Default Deny  │  Autorise : 22 (SSH), 80/443 (Web)
            └───────────┬───────────┘
                        │
              ┌─────────▼──────────┐
              │ Nginx : 80/443      │  Reverse proxy TLS
              └─────────┬──────────┘
                        │ 127.0.0.1:3000 (loopback)
              ┌─────────▼──────────┐
              │ Node.js/Express    │  Écoute sur 127.0.0.1 uniquement
              └─────────┬──────────┘
                        │ 127.0.0.1:5432 (loopback)
              ┌─────────▼──────────┐
              │ PostgreSQL         │  listen_addresses='localhost'
              └────────────────────┘
```

Les flux sortants autorisés : DNS (53), NTP (123), HTTPS (443), HTTP (80).

---

## 2. Matrice des flux

### 2.1 Flux entrants

| # | Direction | Service Source | Service Destination | Interface / Port | Protocole | Justification / Usage métier | Règle de filtrage |
|---|-----------|----------------|----------------------|------------------|-----------|------------------------------|-------------------|
| E1 | Entrant | Poste d'administration (IP restreinte) | Serveur — SSHD | `0.0.0.0:22` | TCP | Administration système (SSH). Restreindre au maximum aux IP d'administration. | **Autorisé** (liste blanche source si possible) |
| E2 | Entrant | Internet | Serveur — Nginx | `0.0.0.0:80` | TCP | HTTP : redirection automatique vers HTTPS + validation ACME (Let's Encrypt). | **Autorisé** |
| E3 | Entrant | Internet | Serveur — Nginx | `0.0.0.0:443` | TCP | HTTPS : trafic applicatif (front + API, uploads, analytics). | **Autorisé** |
| E4 | Entrant | Internet | Serveur — tout | `0.0.0.0:3000` | TCP | Port interne de l'API Node. **Aucun accès externe légitime** (accessible uniquement via Nginx en loopback). | **Bloqué / Restreint au Loopback** |
| E5 | Entrant | Internet | Serveur — tout | `0.0.0.0:5432` | TCP | Port PostgreSQL. **Aucun accès externe légitime** — connexions locales uniquement. | **Bloqué / Restreint au Loopback** |
| E6 | Entrant | Internet | Serveur — tout | `0.0.0.0:3306,33060` | TCP | MySQL présent sur le serveur mais **non utilisé** par le projet. | **Bloqué** |
| E7 | Entrant | Internet | Serveur — tout | tous ports non listés | TCP/UDP | Tout autre port entrant. | **Bloqué** (politique Default Deny) |

### 2.2 Flux internes (Loopback — Locaux)

| # | Direction | Service Source | Service Destination | Interface / Port | Protocole | Justification / Usage métier | Règle de filtrage |
|---|-----------|----------------|----------------------|------------------|-----------|------------------------------|-------------------|
| L1 | Local Interne | Nginx | Node.js/Express | `127.0.0.1:3000` | TCP | Reverse proxy : inacheminement des requêtes HTTP/HTTPS vers l'API. | **Restreint au Loopback** |
| L2 | Local Interne | Node.js/Express (via Nginx ou direct) | PostgreSQL | `127.0.0.1:5432` | TCP | Persistance applicative (Prisma). Aucun accès réseau externe (TLS conseillé entre services). | **Restreint au Loopback** |
| L3 | Local Interne | Node.js/Express | Résolveur DNS local (systemd-resolved) | `127.0.0.53:53` | UDP | Résolution de noms par le cache DNS local. | **Autorisé (Local)** |
| L4 | Local Interne | Node.js/Express | MySQL (non utilisé) | `127.0.0.1:3306` | TCP | Service présent sur l'hôte mais hors périmètre du projet. | **Bloqué** (désactivation recommandée) |

### 2.3 Flux sortants (Egress)

| # | Direction | Service Source | Service Destination | Interface / Port | Protocole | Justification / Usage métier | Règle de filtrage |
|---|-----------|----------------|----------------------|------------------|-----------|------------------------------|-------------------|
| S1 | Sortant | Serveur — Node.js/Express | Résolveur DNS (fournisseur / `systemd-resolved`) | `0.0.0.0:53` | UDP (+TCP) | Résolution DNS nécessaire à tout appel sortant. | **Autorisé** |
| S2 | Sortant | Serveur — tout | Serveurs NTP | `0.0.0.0:123` | UDP | Synchronisation d'horloge (journaux d'audit horodatés, TLS, tokens). | **Autorisé** |
| S3 | Sortant | Serveur — Node.js/Express | APIs externes / stockage S3 / Cloudflare R2 | `0.0.0.0:443` | TCP | Uploads de fichiers (CV, images) vers S3/R2 et appels d'APIs externes — **uniquement en HTTPS**. | **Autorisé** |
| S4 | Sortant | Serveur — Nginx / Node | Dépôts APT, CDN, Let's Encrypt, Git | `0.0.0.0:80` | TCP | Mises à jour système, téléchargements, validation ACME, clones Git. | **Autorisé** |
| S5 | Sortant | Serveur — tout | SMTP | `0.0.0.0:25,465,587` | TCP | Envoi d'emails éventuel (alertes / notifications). Non requis actuellement. | **Bloqué** (à ouvrir si besoin) |
| S6 | Sortant | Serveur — tout | Telnet / autres ports | `0.0.0.0:23` + divers | TCP/UDP | Protocoles non chiffrés, non nécessaires. | **Bloqué** |
| S7 | Sortant | Serveur — tout | Internet | ICMP (`echo-request`) | ICMP | Diagnostic réseau sortant (ping/traceroute). | **Autorisé** (optionnel) |

---

## 3. Règles de filtrage UFW appliquées

Récapitulatif des règles posées par `scripts/setup-firewall.sh` :

| Politique | Règle | Effet |
|-----------|-------|-------|
| `ufw default deny incoming` | Tous les flux entrants sont refusés sauf règles explicites. | Ports 3000 / 5432 / 3306 inaccessibles depuis l'extérieur. |
| `ufw default allow outgoing` | Flux sortants autorisés par défaut (cf. §2.3 pour les restrictions cibles). | DNS, NTP, HTTPS/HTTP sortants fonctionnels. |
| `ufw allow 22/tcp` | SSH entrant autorisé. | Administration. |
| `ufw allow 80/tcp` | HTTP entrant autorisé. | Redirection HTTPS + ACME. |
| `ufw allow 443/tcp` | HTTPS entrant autorisé. | Trafic applicatif. |

**Rappel des contrôles de conformité** (exécutés par le script) :
- Aucun processus ne doit écouter sur une interface publique pour les ports internes.
  Contrôle : `ss -tlnp | grep -E ':3000|:5432'` doit montrer `127.0.0.1` uniquement.
- `ufw status verbose` doit confirmer la politique par défaut `deny (incoming)`.

---

## 4. Vérification de l'isolation locale des services

### 4.1 Application Node.js/Express — bind sur 127.0.0.1

Configuration dans `src/server.ts` :

```ts
const host = process.env.HOST || "127.0.0.1";
app.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
});
```

- Par défaut, l'API n'écoute **que** sur le loopback (`127.0.0.1`), jamais sur une interface publique.
- Nginx est le seul point d'entrée ; il inachémine vers `127.0.0.1:3000`.
- **Contrôle runtime** :
  ```bash
  ss -tlnp | grep ':3000'
  # attendu : 127.0.0.1:3000 — jamais 0.0.0.0:3000 ni *:3000
  ```

### 4.2 PostgreSQL — connexions locales uniquement

Fichier `/etc/postgresql/*/main/postgresql.conf` :

```ini
listen_addresses = 'localhost'   # n'accepter que les connexions locales
port = 5432
```

- **Contrôle runtime** :
  ```bash
  ss -tlnp | grep ':5432'
  # attendu : 127.0.0.1:5432 — jamais 0.0.0.0:5432
  ```
- **Contrôle `pg_hba.conf`** : aucune ligne `host ... 0.0.0.0/0` ; n'autoriser que `127.0.0.1/32` et `::1/128` pour le TCP.

### 4.3 Nginx — reverse proxy, pas d'exposition directe de l'API

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name api.connecteo.mg;

    location / {
        proxy_pass http://127.0.0.1:3000;   # loopback uniquement
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> Aucune directive `listen` sur le port 3000 côté Nginx : seul le loopback transite vers l'API.

---

## 5. Échéance et revue

| Élément | Propriétaire | Fréquence |
|---------|--------------|-----------|
| Revue de la matrice | Responsable sécurité / infra | Au minimum semestrielle et à chaque changement d'architecture (nouveau service, nouveau port, nouvelle dépendance sortante). |
| Contrôle effectif du filtrage | Admin système | `ufw status verbose` + `ss -tlnp` à chaque déploiement. |
| Inventaire des flux sortants | Équipe dev | À l'ajout de toute intégration tierce (S3, APIs, emails). |
