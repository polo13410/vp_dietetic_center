-- Invoicing (docs/REFONTE.md lot 5): invoices and credit notes, numbered per practitioner, year
-- and type. They keep copies of the practice, patient and session, so deleting those leaves them
-- whole (links become NULL).

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('INVOICE', 'CREDIT_NOTE');

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "patient_id" TEXT,
    "consultation_id" TEXT,
    "type" "InvoiceType" NOT NULL,
    "year" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "service_label" TEXT NOT NULL,
    "service_date" TIMESTAMP(3) NOT NULL,
    "practice_name" TEXT NOT NULL,
    "practice_address" TEXT,
    "practice_zip_code" TEXT,
    "practice_city" TEXT,
    "siret" TEXT,
    "adeli_rpps" TEXT,
    "vat_mention" TEXT,
    "invoice_footer" TEXT,
    "patient_first_name" TEXT NOT NULL,
    "patient_last_name" TEXT NOT NULL,
    "patient_address" TEXT,
    "patient_zip_code" TEXT,
    "patient_city" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "credit_note_id" TEXT,
    "replaced_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_credit_note_id_key" ON "invoice"("credit_note_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_replaced_by_id_key" ON "invoice"("replaced_by_id");

-- CreateIndex
CREATE INDEX "invoice_practitioner_id_issued_at_idx" ON "invoice"("practitioner_id", "issued_at");

-- CreateIndex
CREATE INDEX "invoice_patient_id_idx" ON "invoice"("patient_id");

-- CreateIndex
CREATE INDEX "invoice_consultation_id_idx" ON "invoice"("consultation_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_practitioner_id_type_year_sequence_key" ON "invoice"("practitioner_id", "type", "year", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_practitioner_id_number_key" ON "invoice"("practitioner_id", "number");

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An issued invoice is never deleted nor changed (legal rule): only its cancellation (credit
-- note, replacing invoice, reason) is recorded, and its links become NULL when the session or the
-- patient goes. Local demo data can be reset with SET LOCAL app.allow_invoice_delete = 'on'.
CREATE FUNCTION invoice_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.allow_invoice_delete', true) = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'An issued invoice cannot be deleted (%)', OLD.number;
  END IF;
  IF (NEW.practitioner_id, NEW.type, NEW.year, NEW.sequence, NEW.number, NEW.issued_at,
      NEW.amount_cents, NEW.payment_method, NEW.service_label, NEW.service_date,
      NEW.practice_name, NEW.practice_address, NEW.practice_zip_code, NEW.practice_city,
      NEW.siret, NEW.adeli_rpps, NEW.vat_mention, NEW.invoice_footer,
      NEW.patient_first_name, NEW.patient_last_name, NEW.patient_address,
      NEW.patient_zip_code, NEW.patient_city)
     IS DISTINCT FROM
     (OLD.practitioner_id, OLD.type, OLD.year, OLD.sequence, OLD.number, OLD.issued_at,
      OLD.amount_cents, OLD.payment_method, OLD.service_label, OLD.service_date,
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

CREATE TRIGGER invoice_guard
BEFORE UPDATE OR DELETE ON "invoice"
FOR EACH ROW EXECUTE FUNCTION invoice_guard();
