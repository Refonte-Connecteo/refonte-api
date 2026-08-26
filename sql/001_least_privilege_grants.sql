-- =============================================================================
-- Moindre privilege : role PostgreSQL dedie au compte de service HTTP
-- =============================================================================
-- Ce script cree un role `connecteo_http` avec des droits fins par table,
-- puis revoke les privileges par defaut pour empecher tout acces non autorise.
--
-- Usage :
--   1. Definir la variable de connexion connecteo_admin pour se connecter en
--      tant qu'administrateur de la base (superuser ou owner du schema) :
--      \set connecteo_admin_user 'postgres'
--
--   2. Executer ce script :
--      psql -U <admin_user> -d connecteo -f 001_least_privilege_grants.sql
--
--   3. Modifier DATABASE_URL pour utiliser le role connecteo_http :
--      postgresql://connecteo_http:<password>@<host>:<port>/connecteo?sslmode=require
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Revocation des privileges par defaut
-- ---------------------------------------------------------------------------

-- Revoquer TOUT sur toutes les tables du schema public pour le role public
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE USAGE ON SCHEMA public FROM PUBLIC;

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

-- Genere un mot de passe aleatoire et l'affiche (a sauvegarder en secret)
DO $$
DECLARE
    new_password TEXT;
BEGIN
    new_password := encode(gen_random_bytes(24), 'base64');
    RAISE NOTICE '╔══════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  Mot de passe genere pour connecteo_http :          ║';
    RAISE NOTICE '║  %', RPAD(new_password, 51);
    RAISE NOTICE '║  Sauvegardez-le dans votre fichier .env en tant que ║';
    RAISE NOTICE '║  CONNECTEO_HTTP_PASSWORD                            ║';
    RAISE NOTICE '╚══════════════════════════════════════════════════════╝';

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

-- user : CRUD complet (gestion des administrateurs)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user TO connecteo_http;

-- revoked_token : SELECT, INSERT, DELETE (blacklist JWT, pas de UPDATE)
GRANT SELECT, INSERT, DELETE ON TABLE revoked_token TO connecteo_http;

-- audit_log : INSERT uniquement (piste d'audit append-only)
GRANT INSERT ON TABLE audit_log TO connecteo_http;

-- hero_slide : CRUD complet (gestion du carousel CMS)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hero_slide TO connecteo_http;

-- kpi_stat : CRUD complet (gestion des KPI)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE kpi_stat TO connecteo_http;

-- ceo_message : SELECT + UPDATE (message CEO, admins mettent a jour)
GRANT SELECT, UPDATE ON TABLE ceo_message TO connecteo_http;

-- reference : CRUD complet (logos clients)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE reference TO connecteo_http;

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

-- Revoquer le INSERT sur audit_log par defaut (append-only)
-- Note : Si une nouvelle table est creee, elle aura les droits par defaut.
-- Pour audit_log, le INSERT est explicite ci-dessus, les defaults seront
-- surchargees par les grants statiques.

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

-- Afficher les droits du role
DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Verification des privileges de connecteo_http ===';
    FOR r IN
        SELECT
            schemaname,
            tablename,
            privilege_type
        FROM pg_catalog.pg_statio_all_tables st
        JOIN information_schema.table_privileges tp
            ON tp.table_schema = st.schemaname AND tp.table_name = st.relname
        WHERE tp.grantee = 'connecteo_http'
        ORDER BY schemaname, tablename, privilege_type
    LOOP
        RAISE NOTICE '  %.% : %', r.schemaname, r.tablename, r.privilege_type;
    END LOOP;
END
$$;
