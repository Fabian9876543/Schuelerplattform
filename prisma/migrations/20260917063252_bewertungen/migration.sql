-- Rueckmeldung nach einer Nachhilfe.
--
-- Additiv: neue Tabelle, nichts Vorhandenes wird angefasst. Bereits
-- angenommene Anfragen bleiben unbewertet, bis jemand etwas eintraegt.

CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "tutorOfferId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id"),
    -- Die Sterne stehen in der Anzeige und im Schnitt. Eine 7 oder eine 0
    -- wuerde beides unbrauchbar machen, deshalb weist die Datenbank sie ab -
    -- unabhaengig davon, ueber welchen Weg jemand schreibt.
    CONSTRAINT "Rating_stars_check" CHECK ("stars" BETWEEN 1 AND 5)
);

-- Eine Bewertung je Anfrage.
CREATE UNIQUE INDEX "Rating_requestId_key" ON "Rating"("requestId");
-- Der Schnitt je Angebot ist die haeufigste Abfrage.
CREATE INDEX "Rating_tutorOfferId_idx" ON "Rating"("tutorOfferId");
CREATE INDEX "Rating_raterId_idx" ON "Rating"("raterId");

ALTER TABLE "Rating" ADD CONSTRAINT "Rating_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "TutoringRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_tutorOfferId_fkey"
  FOREIGN KEY ("tutorOfferId") REFERENCES "TutorOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_raterId_fkey"
  FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
