-- =============================================================================
-- Correctif : droits de lecture/purge sur la piste d'audit
-- =============================================================================
-- Contexte :
--   001_least_privilege_grants.sql accordait uniquement INSERT sur audit_log.
--   La page /admin/audit-logs (GET /api/admin/audit-logs) a besoin de SELECT,
--   et le job de retention a besoin de DELETE. Sans ces droits, l'API renvoie
--   une erreur 500 : "permission denied for table audit_log".
--
-- Ce script est idempotent : il peut etre rejoue sans risque.
--
-- Usage (compte administrateur PostgreSQL) :
--   psql -U postgres -d connecteo_db1 -f 002_fix_audit_log_grants.sql
-- =============================================================================

GRANT SELECT, INSERT, DELETE ON TABLE audit_log TO connecteo_http;

-- Verification
SELECT
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'audit_log'
  AND grantee = 'connecteo_http'
ORDER BY privilege_type;
