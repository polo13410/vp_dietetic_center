-- Settings (docs/REFONTE.md lot 3): phone, password optional (Google-only accounts), appearance
-- stored per user, practice details printed on invoices.

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "phone" TEXT,
ALTER COLUMN "password_hash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user_preferences" DROP COLUMN "default_view",
DROP COLUMN "email_notifications",
DROP COLUMN "language",
DROP COLUMN "timezone",
ADD COLUMN     "theme" "Theme" NOT NULL DEFAULT 'SYSTEM';

-- CreateTable
CREATE TABLE "practitioner_profile" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "practice_name" TEXT,
    "address" TEXT,
    "zip_code" TEXT,
    "city" TEXT,
    "siret" TEXT,
    "adeli_rpps" TEXT,
    "vat_mention" TEXT,
    "invoice_footer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practitioner_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "practitioner_profile_user_id_key" ON "practitioner_profile"("user_id");

-- AddForeignKey
ALTER TABLE "practitioner_profile" ADD CONSTRAINT "practitioner_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Practitioners who have no formula yet get the default ones, prices to fill in
INSERT INTO "formula" ("id", "practitioner_id", "label", "position", "updated_at")
SELECT gen_random_uuid(), u."id", d."label", d."position", CURRENT_TIMESTAMP
FROM "user" u
CROSS JOIN (VALUES ('Bilan', 0), ('Suivi', 1)) AS d("label", "position")
WHERE u."role" = 'PRATICIENNE'
  AND NOT EXISTS (SELECT 1 FROM "formula" f WHERE f."practitioner_id" = u."id");
