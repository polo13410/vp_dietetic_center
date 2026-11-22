-- Business overhaul (docs/REFONTE.md § 3.2). Destructive on purpose: there is no real data yet.

-- Rows using enum values that disappear: finalizing a session no longer exists, nor do 1-10 scales
UPDATE "audit_log" SET "action" = 'UPDATE' WHERE "action" = 'FINALIZE';
DELETE FROM "measurement" WHERE "type" IN ('ENERGY', 'SLEEP_QUALITY', 'STRESS', 'HUNGER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('F', 'M');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CHECK', 'CARD', 'TRANSFER', 'NONE');

-- CreateEnum
CREATE TYPE "FileField" AS ENUM ('HEALTH', 'FAMILY_HISTORY', 'PSYCHOLOGY', 'PHYSICAL_ACTIVITY', 'WEIGHT_HISTORY', 'ALLERGIES', 'BLOOD_GLUCOSE', 'CHOLESTEROL_TRIGLYCERIDES', 'AVERSIONS', 'TASTES');

-- CreateEnum
CREATE TYPE "GpReportStatus" AS ENUM ('DRAFT', 'SENT');

-- AlterEnum
BEGIN;
CREATE TYPE "AuditAction_new" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT');
ALTER TABLE "audit_log" ALTER COLUMN "action" TYPE "AuditAction_new" USING ("action"::text::"AuditAction_new");
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";
DROP TYPE "public"."AuditAction_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "MetricType_new" AS ENUM ('WEIGHT', 'HEIGHT', 'WAIST', 'HIP', 'BODY_FAT', 'MUSCLE_MASS');
ALTER TABLE "measurement" ALTER COLUMN "type" TYPE "MetricType_new" USING ("type"::text::"MetricType_new");
ALTER TYPE "MetricType" RENAME TO "MetricType_old";
ALTER TYPE "MetricType_new" RENAME TO "MetricType";
DROP TYPE "public"."MetricType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "goal" DROP CONSTRAINT "goal_consultation_id_fkey";

-- DropForeignKey
ALTER TABLE "goal" DROP CONSTRAINT "goal_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "goal_review" DROP CONSTRAINT "goal_review_consultation_id_fkey";

-- DropForeignKey
ALTER TABLE "goal_review" DROP CONSTRAINT "goal_review_goal_id_fkey";

-- DropForeignKey
ALTER TABLE "notification" DROP CONSTRAINT "notification_user_id_fkey";

-- DropForeignKey
ALTER TABLE "patient_tag" DROP CONSTRAINT "patient_tag_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "patient_tag" DROP CONSTRAINT "patient_tag_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "topic_note" DROP CONSTRAINT "topic_note_consultation_id_fkey";

-- DropForeignKey
ALTER TABLE "topic_note" DROP CONSTRAINT "topic_note_patient_id_fkey";

-- AlterTable
ALTER TABLE "consultation" DROP COLUMN "finalized_at",
DROP COLUMN "status",
ADD COLUMN     "formula_id" TEXT,
ADD COLUMN     "formula_label" TEXT,
ADD COLUMN     "habits" TEXT,
ADD COLUMN     "payment_method" "PaymentMethod" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "price_cents" INTEGER;

-- "summary" becomes "Travail en consultation"
ALTER TABLE "consultation" RENAME COLUMN "summary" TO "session_work";

-- AlterTable
ALTER TABLE "life_event" DROP COLUMN "description",
ALTER COLUMN "category" DROP NOT NULL,
ALTER COLUMN "category" DROP DEFAULT;

-- AlterTable
ALTER TABLE "patient" DROP COLUMN "allergies",
DROP COLUMN "dietary_restrictions",
DROP COLUMN "emergency_contact_name",
DROP COLUMN "emergency_contact_phone",
DROP COLUMN "emergency_contact_relationship",
DROP COLUMN "private_note",
DROP COLUMN "status",
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "birth_date_estimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "family_situation" TEXT,
ADD COLUMN     "gp_name" TEXT,
ADD COLUMN     "profession" TEXT,
ADD COLUMN     "sex" "Sex";

-- DropTable
DROP TABLE "goal";

-- DropTable
DROP TABLE "goal_review";

-- DropTable
DROP TABLE "notification";

-- DropTable
DROP TABLE "patient_tag";

-- DropTable
DROP TABLE "tag";

-- DropTable
DROP TABLE "topic_note";

-- DropEnum
DROP TYPE "ConsultationStatus";

-- DropEnum
DROP TYPE "GoalStatus";

-- DropEnum
DROP TYPE "NotificationType";

-- DropEnum
DROP TYPE "PatientStatus";

-- DropEnum
DROP TYPE "PatientTopic";

-- CreateTable
CREATE TABLE "formula" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price_cents" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_entry" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "consultation_id" TEXT,
    "field" "FileField" NOT NULL,
    "content" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gp_report" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "status" "GpReportStatus" NOT NULL DEFAULT 'DRAFT',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gp_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "formula_practitioner_id_position_idx" ON "formula"("practitioner_id", "position");

-- CreateIndex
CREATE INDEX "file_entry_patient_id_field_date_idx" ON "file_entry"("patient_id", "field", "date");

-- CreateIndex
CREATE INDEX "gp_report_patient_id_date_idx" ON "gp_report"("patient_id", "date");

-- AddForeignKey
ALTER TABLE "formula" ADD CONSTRAINT "formula_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_formula_id_fkey" FOREIGN KEY ("formula_id") REFERENCES "formula"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_entry" ADD CONSTRAINT "file_entry_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_entry" ADD CONSTRAINT "file_entry_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gp_report" ADD CONSTRAINT "gp_report_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gp_report" ADD CONSTRAINT "gp_report_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

