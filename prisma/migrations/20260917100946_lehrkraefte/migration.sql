-- Lehrkraefte: Konten ohne Klassenstufe.
--
-- Zwei Fragen, die bisher in einer Spalte steckten, werden hier getrennt:
--   "Was bin ich?"   -> User.kind    (student | teacher)
--   "Was darf ich?"  -> User.isAdmin (verwaltet die eigene Schule)
-- Vorher hiess beides "role". Damit liess sich von einem Verwalter nicht mehr
-- sagen, ob er eine Klasse hat - und genau das braucht die Nachhilfesuche.

CREATE TYPE "UserKind" AS ENUM ('student', 'teacher');

ALTER TABLE "User" ADD COLUMN "kind" "UserKind" NOT NULL DEFAULT 'student';
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Bestehende Verwalter behalten ihre Rechte.
UPDATE "User" SET "isAdmin" = true WHERE "role" = 'admin';

ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "UserRole";

-- Die Klassenstufe wird optional - aber nicht beliebig: Ein Schuelerkonto
-- ohne Klasse und eine Lehrkraft mit Klasse sind beides Unsinn, und die
-- Datenbank laesst beides nicht zu.
ALTER TABLE "User" ALTER COLUMN "gradeLevel" DROP NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_gradeLevel_check" CHECK (
  ("kind" = 'student' AND "gradeLevel" IS NOT NULL)
  OR ("kind" = 'teacher' AND "gradeLevel" IS NULL)
);

-- Eigener Beitrittscode fuer Lehrkraefte. Fuer bestehende Schulen wird einer
-- erzeugt; die Verwaltung sieht ihn auf ihrer Seite. Bewusst nicht aus dem
-- Schuelercode abgeleitet - sonst koennte ihn jeder Schueler erraten.
ALTER TABLE "School" ADD COLUMN "teacherJoinCode" TEXT;
UPDATE "School" SET "teacherJoinCode" = upper(substr(md5(random()::text || "id"), 1, 8));
ALTER TABLE "School" ALTER COLUMN "teacherJoinCode" SET NOT NULL;
CREATE UNIQUE INDEX "School_teacherJoinCode_key" ON "School"("teacherJoinCode");
