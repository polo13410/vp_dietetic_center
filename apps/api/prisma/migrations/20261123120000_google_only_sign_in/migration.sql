-- Google-only sign-in (docs/REFONTE.md lot 14): no more passwords, lockout or reset links
DROP INDEX IF EXISTS "user_password_reset_token_key";

ALTER TABLE "user"
  DROP COLUMN "password_hash",
  DROP COLUMN "login_attempts",
  DROP COLUMN "locked_until",
  DROP COLUMN "password_reset_token",
  DROP COLUMN "password_reset_expires_at";
