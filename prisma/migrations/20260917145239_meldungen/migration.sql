-- Meldungen ueber Inhalte, und die Sperre als moegliche Folge.
--
-- Additiv: neue Aufzaehlungstypen, eine neue Tabelle, zwei neue Spalten an
-- "User". Vorhandene Daten bleiben unberuehrt; gesperrt ist zunaechst niemand.

CREATE TYPE "ReportTargetType" AS ENUM ('offer', 'message', 'rating');
CREATE TYPE "ReportReason" AS ENUM ('insult', 'inappropriate', 'spam', 'other');
CREATE TYPE "ReportStatus" AS ENUM ('open', 'resolved', 'rejected');

CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    -- Ohne Fremdschluessel: Wird der gemeldete Inhalt geloescht, bleibt die
    -- Meldung samt Wortlaut bestehen. Andernfalls koennte man eine Meldung
    -- durch Loeschen des eigenen Beitrags verschwinden lassen.
    "targetId" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "note" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- Eine Meldung je Person und Inhalt.
CREATE UNIQUE INDEX "Report_reporterId_targetType_targetId_key"
  ON "Report"("reporterId", "targetType", "targetId");
-- Die Verwaltung sieht die offenen Meldungen ihrer Schule.
CREATE INDEX "Report_schoolId_status_idx" ON "Report"("schoolId", "status");
CREATE INDEX "Report_authorId_idx" ON "Report"("authorId");

ALTER TABLE "Report" ADD CONSTRAINT "Report_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_handledById_fkey"
  FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Die Sperre.
ALTER TABLE "User"
  ADD COLUMN "blockedAt" TIMESTAMP(3),
  ADD COLUMN "blockedById" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_blockedById_fkey"
  FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
