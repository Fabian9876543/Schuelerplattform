-- Status- und Typspalten von String auf echte enum-Typen umstellen.
--
-- Bewusst von Hand geschrieben: Prisma haette hier DROP COLUMN + ADD COLUMN
-- erzeugt und damit alle vorhandenen Werte verworfen. Die USING-Klausel
-- wandelt sie stattdessen um, sodass bestehende Daten erhalten bleiben.
-- Der Vorgabewert muss dafuer kurz weichen, weil der alte noch Text ist.

CREATE TYPE "AssessmentStatus" AS ENUM ('draft', 'submitted', 'evaluated');
CREATE TYPE "QuestionKind" AS ENUM ('multiple_choice', 'free_text');
CREATE TYPE "EvaluationSource" AS ENUM ('ai', 'rule');
CREATE TYPE "RequestStatus" AS ENUM ('open', 'accepted', 'declined', 'withdrawn');

ALTER TABLE "Assessment"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "AssessmentStatus" USING "status"::"AssessmentStatus",
  ALTER COLUMN "status" SET DEFAULT 'draft';

ALTER TABLE "Question"
  ALTER COLUMN "kind" TYPE "QuestionKind" USING "kind"::"QuestionKind";

ALTER TABLE "Evaluation"
  ALTER COLUMN "source" TYPE "EvaluationSource" USING "source"::"EvaluationSource";

ALTER TABLE "TutoringRequest"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "RequestStatus" USING "status"::"RequestStatus",
  ALTER COLUMN "status" SET DEFAULT 'open';
