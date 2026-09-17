-- Nachrichten zu einer Nachhilfe-Anfrage.
--
-- Rein additiv: eine neue Tabelle, keine Aenderung an vorhandenen Spalten.
-- Vorhandene Anfragen behalten ihre Eroeffnungsnachricht und die Antwort in
-- TutoringRequest; der Verlauf beginnt darunter und bleibt leer, bis jemand
-- schreibt. Es muss also nichts nachtraeglich befuellt werden.

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- NULL = von der Gegenseite noch nicht gelesen
    "readAt" TIMESTAMP(3),
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- Der Verlauf wird immer als Ganzes und in zeitlicher Reihenfolge gelesen.
CREATE INDEX "Message_requestId_createdAt_idx" ON "Message"("requestId", "createdAt");
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- Verschwindet die Anfrage, verschwindet der Verlauf mit ihr.
ALTER TABLE "Message" ADD CONSTRAINT "Message_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "TutoringRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
