-- Discount and third-party payers (docs/REFONTE.md lot 16). Staging has real accounts: existing
-- sessions get their split (no discount, no payer: net = patient part = price) and existing
-- invoices are left as they were (their new copies stay NULL). Payer invoices share the invoice
-- table, and so the numbering, with patient invoices; their sessions are copied in invoice_line.

-- CreateEnum
CREATE TYPE "InvoiceRecipient" AS ENUM ('PATIENT', 'PAYER');

-- CreateEnum
CREATE TYPE "ShareKind" AS ENUM ('AMOUNT', 'PERCENT');

-- CreateEnum
CREATE TYPE "BillingRhythm" AS ENUM ('MONTHLY', 'EVERY_N_MONTHS', 'ON_DEMAND');

-- AlterTable
ALTER TABLE "consultation" ADD COLUMN     "coverage_id" TEXT,
ADD COLUMN     "discount_cents" INTEGER,
ADD COLUMN     "discount_kind" "ShareKind",
ADD COLUMN     "discount_reason" TEXT,
ADD COLUMN     "discount_value" INTEGER,
ADD COLUMN     "net_cents" INTEGER,
ADD COLUMN     "patient_cents" INTEGER,
ADD COLUMN     "payer_cents" INTEGER,
ADD COLUMN     "payer_id" TEXT;

-- AlterTable
ALTER TABLE "invoice" ADD COLUMN     "convention_reference" TEXT,
ADD COLUMN     "discount_cents" INTEGER,
ADD COLUMN     "discount_reason" TEXT,
ADD COLUMN     "paid_at" DATE,
ADD COLUMN     "payer_address" TEXT,
ADD COLUMN     "payer_cents" INTEGER,
ADD COLUMN     "payer_city" TEXT,
ADD COLUMN     "payer_contact" TEXT,
ADD COLUMN     "payer_id" TEXT,
ADD COLUMN     "payer_name" TEXT,
ADD COLUMN     "payer_zip_code" TEXT,
ADD COLUMN     "period_end" DATE,
ADD COLUMN     "period_start" DATE,
ADD COLUMN     "price_cents" INTEGER,
ADD COLUMN     "recipient" "InvoiceRecipient" NOT NULL DEFAULT 'PATIENT',
ALTER COLUMN "patient_first_name" DROP NOT NULL,
ALTER COLUMN "patient_last_name" DROP NOT NULL;

-- CreateTable
CREATE TABLE "payer" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "zip_code" TEXT,
    "city" TEXT,
    "contact" TEXT,
    "convention_reference" TEXT,
    "billing_rhythm" "BillingRhythm" NOT NULL DEFAULT 'MONTHLY',
    "rhythm_months" INTEGER,
    "notes" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_coverage" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "payer_id" TEXT NOT NULL,
    "kind" "ShareKind" NOT NULL,
    "value" INTEGER NOT NULL,
    "max_sessions" INTEGER,
    "start_date" DATE,
    "end_date" DATE,
    "coverage_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_coverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "consultation_id" TEXT,
    "position" INTEGER NOT NULL,
    "service_date" TIMESTAMP(3) NOT NULL,
    "service_label" TEXT NOT NULL,
    "patient_first_name" TEXT NOT NULL,
    "patient_last_name" TEXT NOT NULL,
    "coverage_number" TEXT,
    "amount_cents" INTEGER NOT NULL,

    CONSTRAINT "invoice_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payer_practitioner_id_idx" ON "payer"("practitioner_id");

-- CreateIndex
CREATE INDEX "patient_coverage_patient_id_idx" ON "patient_coverage"("patient_id");

-- CreateIndex
CREATE INDEX "patient_coverage_payer_id_idx" ON "patient_coverage"("payer_id");

-- CreateIndex
CREATE INDEX "invoice_line_consultation_id_idx" ON "invoice_line"("consultation_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_line_invoice_id_position_key" ON "invoice_line"("invoice_id", "position");

-- CreateIndex
CREATE INDEX "consultation_payer_id_date_idx" ON "consultation"("payer_id", "date");

-- CreateIndex
CREATE INDEX "invoice_payer_id_idx" ON "invoice"("payer_id");

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "payer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_coverage_id_fkey" FOREIGN KEY ("coverage_id") REFERENCES "patient_coverage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payer" ADD CONSTRAINT "payer_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_coverage" ADD CONSTRAINT "patient_coverage_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_coverage" ADD CONSTRAINT "patient_coverage_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "payer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "payer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: the split of existing sessions (they had neither discount nor payer)
UPDATE "consultation"
SET "discount_cents" = 0, "net_cents" = "price_cents", "payer_cents" = 0, "patient_cents" = "price_cents"
WHERE "price_cents" IS NOT NULL;

-- Checks: amounts and percentages that make sense
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_discount_check"
  CHECK ("discount_value" IS NULL OR ("discount_value" >= 0 AND ("discount_kind" <> 'PERCENT' OR "discount_value" <= 100)));
ALTER TABLE "patient_coverage" ADD CONSTRAINT "patient_coverage_value_check"
  CHECK ("value" > 0 AND ("kind" <> 'PERCENT' OR "value" <= 100));
ALTER TABLE "payer" ADD CONSTRAINT "payer_rhythm_months_check"
  CHECK ("rhythm_months" IS NULL OR "rhythm_months" BETWEEN 2 AND 12);

-- An issued invoice is never deleted nor changed (lot 5), new copies included. Only its
-- cancellation, its links (NULL when the session, patient or payer goes) and, for a payer
-- invoice, the day it was paid (« réglée le … ») are recorded afterwards.
CREATE OR REPLACE FUNCTION invoice_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.allow_invoice_delete', true) = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'An issued invoice cannot be deleted (%)', OLD.number;
  END IF;
  IF (NEW.practitioner_id, NEW.type, NEW.recipient, NEW.year, NEW.sequence, NEW.number, NEW.issued_at,
      NEW.amount_cents, NEW.payment_method, NEW.service_label, NEW.service_date,
      NEW.price_cents, NEW.discount_cents, NEW.discount_reason, NEW.payer_cents, NEW.payer_name,
      NEW.payer_address, NEW.payer_zip_code, NEW.payer_city, NEW.payer_contact,
      NEW.convention_reference, NEW.period_start, NEW.period_end,
      NEW.practice_name, NEW.practice_address, NEW.practice_zip_code, NEW.practice_city,
      NEW.siret, NEW.adeli_rpps, NEW.vat_mention, NEW.invoice_footer,
      NEW.patient_first_name, NEW.patient_last_name, NEW.patient_address,
      NEW.patient_zip_code, NEW.patient_city)
     IS DISTINCT FROM
     (OLD.practitioner_id, OLD.type, OLD.recipient, OLD.year, OLD.sequence, OLD.number, OLD.issued_at,
      OLD.amount_cents, OLD.payment_method, OLD.service_label, OLD.service_date,
      OLD.price_cents, OLD.discount_cents, OLD.discount_reason, OLD.payer_cents, OLD.payer_name,
      OLD.payer_address, OLD.payer_zip_code, OLD.payer_city, OLD.payer_contact,
      OLD.convention_reference, OLD.period_start, OLD.period_end,
      OLD.practice_name, OLD.practice_address, OLD.practice_zip_code, OLD.practice_city,
      OLD.siret, OLD.adeli_rpps, OLD.vat_mention, OLD.invoice_footer,
      OLD.patient_first_name, OLD.patient_last_name, OLD.patient_address,
      OLD.patient_zip_code, OLD.patient_city)
     OR (OLD.cancelled_at IS NOT NULL AND NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at)
     OR (OLD.credit_note_id IS NOT NULL AND NEW.credit_note_id IS DISTINCT FROM OLD.credit_note_id)
     OR (OLD.replaced_by_id IS NOT NULL AND NEW.replaced_by_id IS DISTINCT FROM OLD.replaced_by_id)
  THEN
    RAISE EXCEPTION 'An issued invoice cannot be changed (%)', OLD.number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The lines of a payer invoice are part of it: never deleted nor changed, except their link to
-- a deleted session (NULL). Same switch as invoices to reset local demo data.
CREATE FUNCTION invoice_line_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.allow_invoice_delete', true) = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'A line of an issued invoice cannot be deleted';
  END IF;
  IF (NEW.invoice_id, NEW.position, NEW.service_date, NEW.service_label, NEW.patient_first_name,
      NEW.patient_last_name, NEW.coverage_number, NEW.amount_cents)
     IS DISTINCT FROM
     (OLD.invoice_id, OLD.position, OLD.service_date, OLD.service_label, OLD.patient_first_name,
      OLD.patient_last_name, OLD.coverage_number, OLD.amount_cents)
     OR (NEW.consultation_id IS NOT NULL AND NEW.consultation_id IS DISTINCT FROM OLD.consultation_id)
  THEN
    RAISE EXCEPTION 'A line of an issued invoice cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_line_guard
BEFORE UPDATE OR DELETE ON "invoice_line"
FOR EACH ROW EXECUTE FUNCTION invoice_line_guard();
