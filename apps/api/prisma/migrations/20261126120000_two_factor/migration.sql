-- Two-step verification (TOTP) after the Google sign-in
ALTER TABLE "user"
  ADD COLUMN "two_factor_secret" TEXT,
  ADD COLUMN "two_factor_enabled_at" TIMESTAMP(3),
  ADD COLUMN "two_factor_last_step" INTEGER,
  ADD COLUMN "two_factor_recovery_codes" TEXT[] DEFAULT ARRAY[]::TEXT[];
