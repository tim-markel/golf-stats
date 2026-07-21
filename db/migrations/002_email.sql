-- 002_email.sql :: login email for accounts
--
-- Adds an email used (with password_hash from 001) to log in. Unique when set,
-- case-insensitively; NULL until an admin/user assigns one.
ALTER TABLE golfers
    ADD COLUMN IF NOT EXISTS email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS golfers_email_lower_key
    ON golfers (lower(email))
    WHERE email IS NOT NULL;
