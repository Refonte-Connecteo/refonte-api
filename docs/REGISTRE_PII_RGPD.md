# Registre des traitements de données personnelles (RGPD — art. 30)

Conformité : exigence « Les données traitées sont catégorisées ; les traitements de données à caractère personnel (PII) et les exigences de protection de la vie privée sont identifiés dès l'initiation. »

**Responsable de traitement** : Connecteo.
**Périmètre** : API Node.js/Express, base PostgreSQL (chiffrement AES-256-GCM champ-par-champ sur les PII), stockage objet S3/Cloudflare R2 (SSE AES256, TLS obligatoire).
**Document associé** : `docs/POLITIQUE_CLASSIFICATION_RETENTION.md` (classification, durées détaillées, automatisation des purges).

---

## 1. Registre des traitements

| # | Nom du traitement | Catégories de données PII collectées | Finalité métier | Base légale RGPD | Durée de conservation maximale | Destinataires & sous-traitants |
|---|---|---|---|---|---|---|
| 1 | **Gestion des candidatures** (`application`, `spontaneous_application`) | Identité (prénom, nom), coordonnées (email, téléphone), CV (fichier), lettre de motivation / candidature spontanée | Instruction des candidatures aux offres et candidatures spontanées (recrutement) | Intérêt légitime (gestion du recrutement) / mesures précontractuelles (art. 6.1.b et 6.1.f) | **24 mois** après soumission (`APPLICATION_RETENTION_MONTHS`), purge automatique BDD + suppression physique du CV (S3/R2 ou disque) | Base de données locale chiffrée ; stockage S3/R2 (Cloudflare) ; administrateurs RH habilités (authentification + MFA) |
| 2 | **Formulaire de contact** (`contact_message`) | Identité (prénom, nom), coordonnées (email, téléphone), société, pays, contenu du message | Répondre aux demandes d'information et sollicitations commerciales entrantes | Intérêt légitime (réponse aux demandes, art. 6.1.f) / consentement (art. 6.1.a) | **12 mois** après soumission (`CONTACT_MESSAGE_RETENTION_MONTHS`), purge automatique BDD | Base de données locale chiffrée ; administrateurs habilités |
| 3 | **Comptes administrateurs** (`user`) | Email professionnel, nom d'utilisateur, empreinte de mot de passe (bcrypt), secret MFA chiffré, codes de récupération MFA | Gestion des accès au back-office, authentification forte (MFA TOTP) | Exécution contractuelle (art. 6.1.b) / obligation légale de sécurité (art. 6.1.c) | Durée de vie du compte ; suppression définitive sur retrait du collaborateur | Base de données locale ; superAdmin uniquement |
| 4 | **Piste d'audit sécurité** (`audit_log`) | Email de l'acteur, adresse IP, user-agent, route/methode, horodatage, détails d'événement (valeurs sensibles masquées `[REDACTED]`) | Détection des intrusions, investigation d'incident, preuve de conformité | Intérêt légitime — cybersécurité (art. 6.1.f) | **7 jours** par défaut (`AUDIT_RETENTION_DAYS`), purge quotidienne automatique à 03:00 | Base de données locale (append-only) ; consultation réservée superAdmin |
| 5 | **Mesure d'audience anonymisée** (`page_view`) | Identifiant visiteur pseudonymisé (sans cookie ni identité), chemin consulté, referrer, user-agent, device | Statistiques de fréquentation du site public | Intérêt légitime (mesure d'audience sans identification, art. 6.1.f) | **395 jours (13 mois)** (`PAGE_VIEW_RETENTION_DAYS`), purge automatique | Base de données locale |
| 6 | **Sessions & tokens révoqués** (`revoked_token`) | Empreinte (hash) du token, identifiant utilisateur associé, date d'expiration | Liste noire des JWT révoqués (déconnexion, rotation) — aucune donnée d'identité en clair | Intérêt légitime — sécurité des accès (art. 6.1.f) | Suppression dès l'expiration naturelle du token (access 5 min / refresh 7 j), purge automatique | Base de données locale |
| 7 | **Chatbot IA (LLM tiers OpenRouter)** | Contenu libre des messages saisis par le visiteur (susceptible de contenir des PII) | Assistance conversationnelle du visiteur sur le site public | Consentement (art. 6.1.a) — information explicite avant usage | **30 jours max** pour les journaux de conversation | **OpenRouter (sous-traitant LLM tiers)** : aucun message ne part en clair — masquage préalable via `src/utils/piiSanitizer.ts` (`[EMAIL_REDACTED]`, `[PHONE_REDACTED]`, `[SENSITIVE_REDACTED]`) ; modèle gratuit à exclure si les CGU autorisent l'entraînement |

---

## 2. Sous-traitants & transferts

| Sous-traitant | Service | Données transmises | Garanties exigées |
|---|---|---|---|
| Cloudflare R2 (ou équivalent S3) | Hébergement des fichiers (CV, images) | Fichiers binaires (CV = données restreintes) | TLS obligatoire (endpoint https://), chiffrement SSE AES256, DPA Cloudflare |
| OpenRouter | Inférence LLM pour le chatbot | Messages utilisateurs **sanitisés uniquement** (PII masquées avant envoi) | Vérifier la clause « no training / zero retention » ; consentement utilisateur recueilli ; journal purgé à 30 jours |

Aucun autre transfert hors Union européenne n'est identifié ; la base de données et l'API sont hébergées sur le serveur du Groupe (voir `docs/MATRICE_DES_FLUX.md`).

---

## 3. Mesures de protection transverses

- **Minimisation à la collecte** : les formulaires publics rejettent tout champ non prévu (`rejectUnknownBodyFields`, schémas Zod `.strict()`).
- **Chiffrement** : PII chiffrées en base (AES-256-GCM champ-par-champ, `ENCRYPTION_KEY`) ; secrets MFA chiffrés ; fichiers S3/R2 en SSE-AES256.
- **Transport** : HTTPS imposé (HSTS), PostgreSQL accessible en loopback uniquement, TLS requis en production.
- **Rétention & purge** : durées bornées par traitement, purge automatisée (`npm run purge-data`, jobs internes quotidiens).
- **Traçabilité** : piste d'audit append-only avec masquage défensif des valeurs sensibles.
- **Droits des personnes** : demandes d'accès / rectification / effacement traitées via le responsable de traitement ; l'effacement est effectif immédiat en base et au prochain cycle de purge pour les supports physiques.

---

## 4. Tenue du registre

Ce registre est mis à jour **dès l'initiation** de tout nouveau traitement (nouvelle table contenant des PII, nouveau sous-traitant, nouvelle finalité). Toute évolution fait l'objet :
1. d'une ligne dans le tableau §1 ;
2. d'une durée de conservation explicitée dans `docs/POLITIQUE_CLASSIFICATION_RETENTION.md` ;
3. d'un mécanisme de purge associé dans `src/services/purge.service.ts`.
