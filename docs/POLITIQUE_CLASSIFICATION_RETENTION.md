# Politique de classification et de rétention des données — API Connecteo

Conformité : exigence « Les informations sont classées et gérées selon les exigences du Groupe ; aucune donnée n'est stockée sans nécessité (minimisation, rétention). »

**Portée** : toutes les données manipulées par l'API Node.js/Express (PostgreSQL via Prisma, stockage objet S3/Cloudflare R2, fichiers locaux `uploads/`).

**Principes appliqués** :

- **Minimisation** (RGPD art. 5.1.c) : seuls les champs strictement nécessaires à la finalité sont collectés. Les schémas de validation rejettent tout champ non prévu (voir §5).
- **Limitation de la conservation** (RGPD art. 5.1.e) : chaque catégorie de données possède une durée de conservation maximale, appliquée automatiquement par le service de purge (`src/services/purge.service.ts`).
- **Privacy by design** (RGPD art. 25) : les PII sont chiffrées champ-par-champ en base (AES-256-GCM), les fichiers sont stockés chiffrés côté serveur (SSE AES256) et ne transitent qu'en HTTPS.

---

## 1. Tableau de classification des données

| Catégorie | Niveau de sensibilité | Exemples de champs / tables BDD | Durée de conservation | Règle de destruction |
|---|---|---|---|---|
| **Données Publiques** (contenu éditorial du site) | Public | `hero_slide` (titre, image), `kpi_stat`, `ceo_message`, `reference`, `catalogue.file_url`, `job_posting` (titre, description), `article`, `event`, `event_image` | Illimitée tant que le contenu est publié (gestion back-office) | Suppression définitive BDD sur action administrateur ; images associées supprimées du stockage |
| **Données Personnelles / PII — Recrutement** | **Restreint** | `application` : `first_name`, `last_name`, `email`, `phone`, `cv_url`, `cover_letter` ; `spontaneous_application` : idem + `motivation` | **24 mois** après soumission (`APPLICATION_RETENTION_MONTHS`) | Suppression définitive des lignes BDD **+ suppression physique du CV** (objet S3/R2 ou fichier disque `uploads/`) par `purgeExpiredApplications()` |
| **Données Personnelles / PII — Contact** | **Confidentiel** | `contact_message` : `first_name`, `last_name`, `email`, `phone`, `company`, `country`, `message` | **12 mois** après soumission (`CONTACT_MESSAGE_RETENTION_MONTHS`) | Suppression définitive des lignes BDD par `purgeExpiredContactMessages()` |
| **Données d'authentification & sécurité** | **Restreint** | `user` : `email`, `username`, `password_hash`, `mfa_secret`, `mfa_recovery_codes`, `invitation_token` | Durée de vie du compte ; invitation expirée = token invalide | Suppression définitive du compte par un superAdmin ; révocation MFA efface le secret |
| **Sessions & tokens** | **Restreint** | `revoked_token` : `token_hash`, `user_id`, `expires_at` | Jusqu'à l'expiration naturelle du token (access 5 min / refresh 7 j) | Purge automatique dès expiration par `purgeExpiredSessions()` |
| **Journaux de sécurité (piste d'audit)** | Confidentiel | `audit_log` : `actor_email`, `ip`, `user_agent`, `route`, `details` | **7 jours** par défaut, configurable (`AUDIT_RETENTION_DAYS`) | Purge quotidienne automatique (job interne 03:00 + `purgeAuditLogs()`) |
| **Analytics site public** | Interne | `page_view` : `visitor_id` (pseudonymisé, sans cookie ni PII), `path`, `referrer`, `user_agent` | **395 jours (13 mois)** (`PAGE_VIEW_RETENTION_DAYS`) | Purge automatique par `purgeExpiredPageViews()` |
| **Fichiers temporaires non référencés** | Interne | Fichiers `uploads/` absents de la base | 24 h | Balayage quotidien automatique (job interne 04:00, `sweepOrphanFiles()`) |

Niveaux de sensibilité (du plus faible au plus élevé) : **Public** → **Interne** → **Confidentiel** → **Restreint**.

---

## 2. Règles de destruction

Toute purge respecte le principe **« BDD + support physique »** :

1. **Base de données** : suppression définitive via Prisma (`deleteMany`), sans soft-delete ni archivage caché.
2. **Fichiers physiques** : pour chaque candidature purgée, le CV référencé par `cv_url` est supprimé :
   - URL `https://…/<bucket>/<clé>` → suppression de l'objet dans S3/R2 (`DeleteObjectCommand`, `src/services/storage.service.ts`) ;
   - chemin local `/uploads/<fichier>` → suppression du fichier disque (résolution sécurisée anti path-traversal via `getSafeFilePath`).
3. **Best-effort traçable** : un échec de suppression de fichier n'interrompt pas la purge BDD (l'incident est loggé), et chaque exécution produit un résumé loggé (`logger.info`).

---

## 3. Minimisation à la collecte

Les points d'entrée publics n'acceptent que les champs strictement nécessaires :

| Endpoint | Champs autorisés | Comportement face à un champ inconnu |
|---|---|---|
| `POST /api/application` | `job_id`, `first_name`, `last_name`, `email`, `phone`, `cv_url`, `cover_letter` | **Rejeté (400)** |
| `POST /api/spontaneous-application` | `first_name`, `last_name`, `email`, `phone`, `cv_url`, `motivation` | **Rejeté (400)** |
| `POST /api/contact-message` | `first_name`, `last_name`, `email`, `phone`, `company`, `country`, `message` | **Rejeté (400)** |

Mise en œuvre :

- Middleware `rejectUnknownBodyFields(allowedFields)` (`src/middlewares/validation.middleware.ts`) branché sur ces routes POST : toute clé non prévue déclenche une réponse 400 et un événement d'audit `VALIDATION_REJECTED`.
- Schémas Zod en mode `.strict()` (`src/validations/*.schema.ts`) pour les routes de mise à jour admin : les clés non reconnues sont rejetées plutôt que silencieusement ignorées.

---

## 4. Automatisation de la purge

### 4.1 Service applicatif

`src/services/purge.service.ts` expose :

- `purgeExpiredApplications(retentionMonths?)` — candidatures + candidatures spontanées > 24 mois, avec suppression des CV ;
- `purgeExpiredContactMessages(retentionMonths?)` — messages de contact > 12 mois ;
- `purgeExpiredSessions()` — tokens révoqués dont la date d'expiration est dépassée ;
- `purgeExpiredPageViews(retentionDays?)` — analytics > 13 mois ;
- `runDataPurge()` — orchestre l'ensemble et retourne un résumé agrégé.

### 4.2 Exécution manuelle (CLI)

```bash
npm run purge-data
```

### 4.3 Planification (crontab Ubuntu)

Purge quotidienne à 02:30 (avant les jobs internes de 03:00/04:00) :

```cron
30 2 * * * cd /srv/refonte-api && /usr/bin/npm run purge-data >> /var/log/refonte-api/purge.log 2>&1
```

Alternative sans cron : appeler `runDataPurge()` depuis un planificateur applicatif (node-cron) au démarrage du serveur.

### 4.4 Variables de configuration

| Variable | Défaut | Rôle |
|---|---|---|
| `APPLICATION_RETENTION_MONTHS` | `24` | Rétention des candidatures (candidatures + CV) |
| `CONTACT_MESSAGE_RETENTION_MONTHS` | `12` | Rétention des messages de contact |
| `PAGE_VIEW_RETENTION_DAYS` | `395` | Rétention des vues pages anonymisées |
| `AUDIT_RETENTION_DAYS` | `7` | Rétention de la piste d'audit (purge quotidienne existante) |

---

## 5. Preuve de conformité

- Classification documentée (ce fichier) et revue à chaque ajout de table.
- Purges exécutables à la demande (`npm run purge-data`) et planifiables (cron) — résumé journalisé à chaque exécution.
- Jobs internes déjà actifs : purge piste d'audit (03:00), balayage fichiers orphelins (04:00).
- Registre des traitements détaillé : voir `docs/REGISTRE_PII_RGPD.md`.
