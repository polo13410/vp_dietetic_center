-- Several practices and appointment types (docs/REFONTE.md lot 15). Staging has real accounts:
-- the address of each practitioner moves into her first practice, which becomes her default one,
-- and her existing sessions (and in-person appointments) are placed in it. Issued invoices keep
-- their own copies and are left untouched.

-- CreateTable
CREATE TABLE "practice" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "zip_code" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "siret" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "practice_practitioner_id_idx" ON "practice"("practitioner_id");

-- AddForeignKey
ALTER TABLE "practice" ADD CONSTRAINT "practice_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: one default practice per practitioner (or per user who filled in « Mon cabinet »), with
-- the address she had entered. Named after its city, « Mon cabinet » when there is none yet.
INSERT INTO "practice" ("id", "practitioner_id", "name", "address", "zip_code", "city", "is_default", "updated_at")
SELECT gen_random_uuid()::text,
       u."id",
       COALESCE(NULLIF(TRIM(p."city"), ''), 'Mon cabinet'),
       p."address",
       p."zip_code",
       p."city",
       true,
       CURRENT_TIMESTAMP
FROM "user" u
LEFT JOIN "practitioner_profile" p ON p."user_id" = u."id"
WHERE u."role" = 'PRATICIENNE' OR p."id" IS NOT NULL;

-- AlterTable: the address now belongs to the practice
ALTER TABLE "practitioner_profile" DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "zip_code";

-- AlterTable: a formula is also a type of appointment, with its duration
ALTER TABLE "formula" ADD COLUMN     "duration_minutes" INTEGER NOT NULL DEFAULT 45;

-- Data: a « Bilan » lasts one hour, the other formulas 45 minutes (she can change them)
UPDATE "formula" SET "duration_minutes" = 60 WHERE LOWER(TRIM("label")) LIKE 'bilan%';

-- AlterTable
ALTER TABLE "appointment" ADD COLUMN     "formula_id" TEXT,
ADD COLUMN     "practice_id" TEXT;

-- AlterTable
ALTER TABLE "consultation" ADD COLUMN     "practice_id" TEXT;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_formula_id_fkey" FOREIGN KEY ("formula_id") REFERENCES "formula"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: existing sessions and in-person appointments took place in her (only) practice
UPDATE "consultation" c SET "practice_id" = pr."id"
FROM "practice" pr
WHERE pr."practitioner_id" = c."practitioner_id" AND pr."is_default";

UPDATE "appointment" a SET "practice_id" = pr."id"
FROM "practice" pr
WHERE pr."practitioner_id" = a."practitioner_id" AND pr."is_default" AND a."type" = 'IN_PERSON';
