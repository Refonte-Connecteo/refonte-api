-- =============================================================================
-- Moindre privilege : role PostgreSQL dedie au compte de service HTTP
-- =============================================================================
-- Ce script cree un role `connecteo_http` avec des droits fins par table,
-- puis revoke les privileges par defaut pour empecher tout acces non autorise.
--
-- Usage :
--   psql -U postgres -d connecteo_db1 -f 001_least_privilege_grants.sql
--
--   3. Modifier DATABASE_URL pour utiliser le role connecteo_http :
--      postgresql://connecteo_http:<password>@<host>:<port>/connecteo_db1
-- =============================================================================

-- Activation de pgcrypto pour gen_random_bytes()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Revocation des privileges par defaut
-- ---------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

-- Supprimer le role s'il existe deja (pour re-execution securisee)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'connecteo_http') THEN
        REASSIGN OWNED BY connecteo_http TO postgres;
        DROP OWNED BY connecteo_http;
        DROP ROLE connecteo_http;
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Creation du role de service HTTP (non privilegie)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    new_password TEXT;
BEGIN
    new_password := encode(gen_random_bytes(24), 'base64');
    RAISE NOTICE '=== Mot de passe genere pour connecteo_http ===';
    RAISE NOTICE '%', new_password;
    RAISE NOTICE 'Sauvegardez-le dans votre fichier .env';

    EXECUTE format(
        'CREATE ROLE connecteo_http WITH LOGIN PASSWORD %L NOINHERIT',
        new_password
    );
END
$$;

-- ---------------------------------------------------------------------------
-- 3. Privileges sur le schema
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO connecteo_http;

-- ---------------------------------------------------------------------------
-- 4. Privileges fins par table
-- ---------------------------------------------------------------------------

-- user_type : SELECT uniquement (table de reference, lecture seule)
GRANT SELECT ON TABLE user_type TO connecteo_http;

-- "user" : CRUD complet (gestion des administrateurs) — mot reserve, guillemets obligatoires
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "user" TO connecteo_http;

-- revoked_token : SELECT, INSERT, DELETE (blacklist JWT, pas de UPDATE)
GRANT SELECT, INSERT, DELETE ON TABLE revoked_token TO connecteo_http;

-- audit_log : SELECT + INSERT + DELETE
--   - INSERT : journalisation des evenements
--   - SELECT : consultation de la piste d'audit par le superAdmin
--   - DELETE : purge automatique selon la retention (AUDIT_RETENTION_DAYS)
--   Pas de UPDATE : la piste reste append-only.
GRANT SELECT, INSERT, DELETE ON TABLE audit_log TO connecteo_http;

-- hero_slide : CRUD complet (gestion du carousel CMS)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hero_slide TO connecteo_http;

-- kpi_stat : CRUD complet (gestion des KPI)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE kpi_stat TO connecteo_http;

-- ceo_message : SELECT + UPDATE (message CEO, admins mettent a jour)
GRANT SELECT, UPDATE ON TABLE ceo_message TO connecteo_http;

-- reference : CRUD complet (logos clients)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "reference" TO connecteo_http;

-- catalogue : CRUD complet (catalogues telechargeables)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE catalogue TO connecteo_http;

-- job_posting : CRUD complet (offres d'emploi)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE job_posting TO connecteo_http;

-- application : CRUD complet (candidatures)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE application TO connecteo_http;

-- spontaneous_application : CRUD complet (candidatures spontanees)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE spontaneous_application TO connecteo_http;

-- article : CRUD complet (articles/actualites)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE article TO connecteo_http;

-- event : CRUD complet (evenements)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE event TO connecteo_http;

-- event_image : CRUD complet (galerie photos evenements)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE event_image TO connecteo_http;

-- contact_message : CRUD complet (formulaire de contact)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE contact_message TO connecteo_http;

-- page_view : SELECT + INSERT (analytics, ecriture + lecture dashboard)
GRANT SELECT, INSERT ON TABLE page_view TO connecteo_http;

-- ---------------------------------------------------------------------------
-- 5. Privileges sur les sequences (auto-increment IDs)
-- ---------------------------------------------------------------------------

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO connecteo_http;

-- ---------------------------------------------------------------------------
-- 6. Privileges futurs (pour les prochaines tables creees via Prisma)
-- ---------------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO connecteo_http;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO connecteo_http;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Verification des privileges de connecteo_http ===';
    FOR r IN
        SELECT
            tp.table_schema,
            tp.table_name,
            tp.privilege_type
        FROM information_schema.table_privileges tp
        WHERE tp.grantee = 'connecteo_http'
        ORDER BY tp.table_schema, tp.table_name, tp.privilege_type
    LOOP
        RAISE NOTICE '  %.% : %', r.table_schema, r.table_name, r.privilege_type;
    END LOOP;
END
$$;
