-- Nutzer gehoeren zu einer Schule.
--
-- In vier Schritten, damit vorhandene Konten erhalten bleiben: Prisma haette
-- eine Pflichtspalte ohne Vorgabewert angelegt und waere an den bestehenden
-- Zeilen gescheitert. Stattdessen erst nullable, dann befuellen, dann
-- verpflichtend machen.

-- 1. Die Tabelle selbst
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "School_joinCode_key" ON "School"("joinCode");

-- 2. Spalte zunaechst ohne Pflicht
ALTER TABLE "User" ADD COLUMN "schoolId" TEXT;

-- 3. Bestehende Konten einer Uebergangsschule zuordnen. Die gibt es nur, wenn
--    ueberhaupt Konten vorhanden sind - eine leere Datenbank bleibt leer.
INSERT INTO "School" ("id", "name", "joinCode", "createdAt")
SELECT 'school_uebergang', 'Beispielschule', 'BEISPIEL', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "User");

UPDATE "User" SET "schoolId" = 'school_uebergang' WHERE "schoolId" IS NULL;

-- 4. Jetzt darf die Spalte Pflicht werden
ALTER TABLE "User" ALTER COLUMN "schoolId" SET NOT NULL;

ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");
