## Description

<!-- Décrivez brièvement les changements effectués -->

## Type de changement

- [ ] Nouvelle fonctionnalite
- [ ] Correction de bug
- [ ] Refactoring
- [ ] Mise a jour de dependances
- [ ] Securite / Correctif de securite
- [ ] Configuration / Infrastructure
- [ ] Documentation

## Checklist Securite

- [ ] Pas de secrets, cles ou tokens dans le code
- [ ] Input validation (Zod) appliquee sur toutes les nouvelles entrees
- [ ] Pas de `$queryRaw` / `$executeRaw` Prisma ajoute
- [ ] Pas de nouvelle injection SQL, XSS ou CSRF introduite
- [ ] Les endpoints sensibles utilisent bien le middleware d'auth
- [ ] Rate limiting applique sur les nouvelles routes publiques
- [ ] Pas de regression sur les tests de securite existants

## Checklist Qualite

- [ ] `npm run lint` passe sans erreur
- [ ] `npm run build` passe sans erreur
- [ ] `npm test` passe (tests existants + nouveaux si applicable)
- [ ] `npx prisma migrate dev` genere une migration si schema modifie
- [ ] Pas de nouvelles dependances non necessaires

## Checklist Dependances

- [ ] Pas de dependances ajoutees sans justification
- [ ] `npm audit` ne retourne pas de vulnerabilites critiques
- [ ] Dependances d'origine : registry npm officiel uniquement
- [ ] Aucune dependance devenue obslete ou non maintenue

## Captures d'ecran / Tests

<!-- Si applicable, ajouter des captures ou des logs de tests -->

## Notes supplementaires

<!-- Informations contextuelles utiles pour le reviewer -->
