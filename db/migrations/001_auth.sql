-- 001_auth.sql :: accounts + admin flag
--
-- Adds authentication + a single admin/normal role to golfers.
--   password_hash : PBKDF2 hash set when an account gets a password (login).
--   is_admin      : admins (Tim Markel) can manage accounts and flags;
--                   everyone else is a normal user.
ALTER TABLE golfers
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS is_admin       BOOLEAN NOT NULL DEFAULT false;

-- Seed the initial admin.
UPDATE golfers SET is_admin = true WHERE name = 'Tim Markel';
