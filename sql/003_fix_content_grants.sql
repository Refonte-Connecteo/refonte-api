-- =============================================================================
-- Correctif : droits manquants sur ceo_message et page_view
-- =============================================================================
-- Contexte :
--   001_least_privilege_grants.sql n'accordait que SELECT et UPDATE sur
--   ceo_message, alors que l'admin crée et supprime ces messages. Sans ces
--   droits, l'API renvoie une erreur 500 : "permission denied for table
--   ceo_message".
--
--   page_view n'avait pas DELETE, alors que la purge RGPD doit supprimer les
--   vues plus anciennes que PAGE_VIEW_RETENTION_DAYS.
--
-- Ce script est idempotent : il peut être rejoué sans risque.
--
-- Usage (compte administrateur PostgreSQL) :
--   psql -U postgres -d connecteo_db1 -f 003_fix_content_grants.sql
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ceo_message TO connecteo_http;
GRANT SELECT, INSERT, DELETE ON TABLE page_view TO connecteo_http;

-- Vérification
SELECT
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_name IN ('ceo_message', 'page_view')
  AND grantee = 'connecteo_http'
ORDER BY table_name, privilege_type;
