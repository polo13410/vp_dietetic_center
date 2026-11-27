ALTER TABLE "formula" ADD COLUMN "first_appointment" BOOLEAN NOT NULL DEFAULT false;
UPDATE "formula" SET "first_appointment" = true WHERE lower(trim("label")) LIKE 'bilan%';

ALTER TABLE "consultation" ADD COLUMN "payer_override_cents" INTEGER
    CHECK ("payer_override_cents" BETWEEN 0 AND 1000000);
