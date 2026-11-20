-- Patient file: sessions (consultation), measurements, topic notes, life events and goals
-- replace clinical notes, nutritional profile/entries and appointment pre/post notes.
-- No data is carried over: no environment held real patient data when this was written.

-- Notifications about finalized notes keep existing, as plain system notifications
UPDATE "notification" SET "type" = 'SYSTEM' WHERE "type" = 'NOTE_FINALIZED';

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "PatientTopic" AS ENUM ('EATING', 'ACTIVITY', 'SLEEP', 'EMOTIONS', 'DIGESTION', 'HEALTH', 'LIFE');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('WEIGHT', 'HEIGHT', 'WAIST', 'HIP', 'BODY_FAT', 'MUSCLE_MASS', 'ENERGY', 'SLEEP_QUALITY', 'STRESS', 'HUNGER');

-- CreateEnum
CREATE TYPE "LifeEventCategory" AS ENUM ('HEALTH', 'TREATMENT', 'FAMILY', 'WORK', 'HOME', 'OTHER');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('IN_PROGRESS', 'ACHIEVED', 'PARTIAL', 'ABANDONED');

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('APPOINTMENT_CREATED', 'APPOINTMENT_CANCELLED', 'TASK_CREATED', 'TASK_DUE', 'CONSULTATION_FINALIZED', 'PATIENT_CREATED', 'SYSTEM');
ALTER TABLE "notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "clinical_note" DROP CONSTRAINT "clinical_note_appointment_id_fkey";

-- DropForeignKey
ALTER TABLE "clinical_note" DROP CONSTRAINT "clinical_note_author_id_fkey";

-- DropForeignKey
ALTER TABLE "clinical_note" DROP CONSTRAINT "clinical_note_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "nutritional_entry" DROP CONSTRAINT "nutritional_entry_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "nutritional_profile" DROP CONSTRAINT "nutritional_profile_patient_id_fkey";

-- AlterTable
ALTER TABLE "appointment" DROP COLUMN "post_notes",
DROP COLUMN "pre_notes";

-- AlterTable
ALTER TABLE "patient" ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "consultation_reason" TEXT,
ADD COLUMN     "dietary_restrictions" TEXT;

-- DropTable
DROP TABLE "clinical_note";

-- DropTable
DROP TABLE "nutritional_entry";

-- DropTable
DROP TABLE "nutritional_profile";

-- DropEnum
DROP TYPE "NoteStatus";

-- DropEnum
DROP TYPE "NoteType";

-- CreateTable
CREATE TABLE "consultation" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "advice" TEXT,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'DRAFT',
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "consultation_id" TEXT,
    "type" "MetricType" NOT NULL,
    "value" DECIMAL(6,2) NOT NULL,
    "measured_at" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_note" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "consultation_id" TEXT,
    "topic" "PatientTopic" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "life_event" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "consultation_id" TEXT,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "LifeEventCategory" NOT NULL DEFAULT 'OTHER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "life_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "consultation_id" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "status" "GoalStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_review" (
    "id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "consultation_id" TEXT NOT NULL,
    "status" "GoalStatus" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consultation_appointment_id_key" ON "consultation"("appointment_id");

-- CreateIndex
CREATE INDEX "consultation_patient_id_date_idx" ON "consultation"("patient_id", "date");

-- CreateIndex
CREATE INDEX "measurement_patient_id_type_measured_at_idx" ON "measurement"("patient_id", "type", "measured_at");

-- CreateIndex
CREATE INDEX "topic_note_patient_id_topic_created_at_idx" ON "topic_note"("patient_id", "topic", "created_at");

-- CreateIndex
CREATE INDEX "life_event_patient_id_date_idx" ON "life_event"("patient_id", "date");

-- CreateIndex
CREATE INDEX "goal_patient_id_status_idx" ON "goal"("patient_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "goal_review_goal_id_consultation_id_key" ON "goal_review"("goal_id", "consultation_id");

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement" ADD CONSTRAINT "measurement_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement" ADD CONSTRAINT "measurement_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_note" ADD CONSTRAINT "topic_note_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_note" ADD CONSTRAINT "topic_note_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "life_event" ADD CONSTRAINT "life_event_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "life_event" ADD CONSTRAINT "life_event_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal" ADD CONSTRAINT "goal_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal" ADD CONSTRAINT "goal_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_review" ADD CONSTRAINT "goal_review_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_review" ADD CONSTRAINT "goal_review_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

