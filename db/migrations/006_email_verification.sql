-- 006_email_verification.sql :: pending email-verification signups
--
-- A signup is held here (not yet a real golfer) until the 6-digit code emailed
-- to the address is confirmed. code_hash and password_hash are PBKDF2 hashes;
-- the row is deleted on success or when it expires.
CREATE TABLE IF NOT EXISTS email_verifications (
    email         TEXT PRIMARY KEY,       -- lower(email)
    name          TEXT        NOT NULL,
    password_hash TEXT        NOT NULL,
    code_hash     TEXT        NOT NULL,
    attempts      SMALLINT    NOT NULL DEFAULT 0,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
