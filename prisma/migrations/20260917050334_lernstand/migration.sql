-- Lernstand je Teilthema und uebersprungene Lernaufgaben.
--
-- Der Anfangswert wird nicht pauschal auf "weak" gesetzt, sondern aus der
-- vorhandenen Auswertung abgeleitet: Themen ohne erkannte Luecke sitzen, eine
-- leichte Luecke ist "medium", alles darueber "weak". Sonst staenden nach der
-- Migration alle Ampeln auf Rot, auch die bereits sicheren Themen.

CREATE TYPE "MasteryLevel" AS ENUM ('weak', 'medium', 'strong');

ALTER TABLE "Topic"
  ADD COLUMN "mastery" "MasteryLevel" NOT NULL DEFAULT 'weak',
  ADD COLUMN "masteryUpdatedAt" TIMESTAMP(3);

ALTER TABLE "StudyTask" ADD COLUMN "skipped" BOOLEAN NOT NULL DEFAULT false;

-- Themen ohne Defizit gelten als sicher ...
UPDATE "Topic" t SET "mastery" = 'strong'
WHERE NOT EXISTS (SELECT 1 FROM "Deficit" d WHERE d."topicId" = t.id);

-- ... und eine nur leichte Luecke als mittel.
UPDATE "Topic" t SET "mastery" = 'medium'
WHERE EXISTS (SELECT 1 FROM "Deficit" d WHERE d."topicId" = t.id AND d.severity = 1)
  AND NOT EXISTS (SELECT 1 FROM "Deficit" d WHERE d."topicId" = t.id AND d.severity > 1);
