-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN     "patient_id" TEXT;

-- CreateIndex
CREATE INDEX "audit_log_patient_id_created_at_idx" ON "audit_log"("patient_id", "created_at");

