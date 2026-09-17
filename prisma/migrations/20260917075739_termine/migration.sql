-- Feste Lerntermine zu einer Nachhilfe-Anfrage.
--
-- Additiv: neuer Aufzaehlungstyp und neue Tabelle, nichts Vorhandenes wird
-- angefasst. Bisherige Absprachen stehen weiter im Nachrichtenverlauf und
-- bleiben dort - nachtraeglich Termine daraus zu raten waere geraten, nicht
-- gewusst.

CREATE TYPE "AppointmentStatus" AS ENUM ('proposed', 'confirmed', 'cancelled');

CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "place" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'proposed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id"),
    -- Eine Lerneinheit von zwei Minuten oder von zwei Tagen ist keine.
    -- Die Grenze steht in der Datenbank, nicht nur in der Eingabepruefung.
    CONSTRAINT "Appointment_duration_check" CHECK ("durationMinutes" BETWEEN 15 AND 240)
);

-- Der Verlauf zeigt die Termine einer Anfrage in zeitlicher Reihenfolge ...
CREATE INDEX "Appointment_requestId_startsAt_idx" ON "Appointment"("requestId", "startsAt");
-- ... der Kalender die eines Zeitraums ueber alle Anfragen hinweg.
CREATE INDEX "Appointment_startsAt_idx" ON "Appointment"("startsAt");
CREATE INDEX "Appointment_proposedById_idx" ON "Appointment"("proposedById");

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "TutoringRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_proposedById_fkey"
  FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
