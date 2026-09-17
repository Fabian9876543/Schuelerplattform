-- Die Schule verwaltet ihren eigenen Bereich: Rollen, Freigaben, Faecher.
--
-- Additiv, aber mit einer wichtigen Entscheidung fuer die vorhandenen Daten:
-- Angebote, die es schon gibt, waren bisher sichtbar. Sie werden deshalb als
-- freigegeben eingetragen - sie stillschweigend verschwinden zu lassen waere
-- das Gegenteil dessen, was eine Migration tun soll. Neue Angebote beginnen
-- dagegen unfreigegeben.
--
-- Die Freigabepflicht selbst ist voreingestellt aus: Fuer jede bestehende
-- Schule aendert sich damit zunaechst gar nichts.

CREATE TYPE "UserRole" AS ENUM ('student', 'admin');

ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'student';

ALTER TABLE "School" ADD COLUMN "requiresApproval" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SchoolSubject" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    CONSTRAINT "SchoolSubject_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SchoolSubject_schoolId_subject_key" ON "SchoolSubject"("schoolId", "subject");
CREATE INDEX "SchoolSubject_schoolId_idx" ON "SchoolSubject"("schoolId");
ALTER TABLE "SchoolSubject" ADD CONSTRAINT "SchoolSubject_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TutorOffer"
  ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT;

-- Bestandsschutz: Was schon in der Suche stand, steht weiter drin.
UPDATE "TutorOffer" SET "approved" = true;

ALTER TABLE "TutorOffer" ADD CONSTRAINT "TutorOffer_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
