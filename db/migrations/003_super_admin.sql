-- 003_super_admin.sql :: the exclusive super-admin role
--
-- Roles now form a hierarchy: normal < admin < super_admin.
--   is_super_admin : Tim Markel only. Implies admin, can never be revoked, and
--                    is never grantable through the API (set here, in the DB,
--                    on purpose). Super admins always see every dev ability.
ALTER TABLE golfers
    ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Seed the single super admin (also an admin).
UPDATE golfers
   SET is_super_admin = true,
       is_admin       = true
 WHERE name = 'Tim Markel';

-- Guardrail: at most one super admin can ever exist.
CREATE UNIQUE INDEX IF NOT EXISTS golfers_single_super_admin
    ON golfers ((is_super_admin))
    WHERE is_super_admin;
