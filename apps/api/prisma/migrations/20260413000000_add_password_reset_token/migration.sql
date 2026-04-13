-- AlterTable
ALTER TABLE "user"
  ADD COLUMN "password_reset_token"      TEXT,
  ADD COLUMN "password_reset_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "user_password_reset_token_key" ON "user"("password_reset_token");
