-- Erklaerungen zu einem Thema und von Lehrkraeften gepruefte Links.
--
-- Rein additiv: Ohne einen einzigen Eintrag verhaelt sich die App wie vorher.

-- Eine Erklaerung je Fach, Thema und Klassenstufe - plattformweit, weil die
-- Frage fuer alle dieselbe ist und der Eintrag nichts Persoenliches enthaelt.
CREATE TABLE "Explanation" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    -- ueber normalizeTopic() vereinheitlicht
    "topicKey" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "gradeLevel" INTEGER NOT NULL,
    "bodyJson" TEXT NOT NULL,
    "source" "EvaluationSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Explanation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Explanation_subject_topicKey_gradeLevel_key"
  ON "Explanation"("subject", "topicKey", "gradeLevel");

-- Wer welche Erklaerung gesehen hat, ob sie ueber die KI entstanden ist und ob
-- sie geholfen hat. `generated` ist der Zaehler fuer das Tageskontingent.
CREATE TABLE "ExplanationView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "explanationId" TEXT NOT NULL,
    "generated" BOOLEAN NOT NULL DEFAULT false,
    -- NULL heisst "noch nichts gesagt" und ist etwas anderes als "nein"
    "helpful" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExplanationView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExplanationView_userId_explanationId_key"
  ON "ExplanationView"("userId", "explanationId");
CREATE INDEX "ExplanationView_explanationId_idx" ON "ExplanationView"("explanationId");

ALTER TABLE "ExplanationView" ADD CONSTRAINT "ExplanationView_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExplanationView" ADD CONSTRAINT "ExplanationView_explanationId_fkey"
  FOREIGN KEY ("explanationId") REFERENCES "Explanation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Gepruefte Links je Schule und Thema.
CREATE TABLE "TopicLink" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topicKey" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "note" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TopicLink_pkey" PRIMARY KEY ("id"),
    -- Nur https. Nicht bloss im Formular geprueft, sondern hier: Was in der
    -- Datenbank steht, wird Schuelern als geprueft angezeigt - dann soll es
    -- auch dann stimmen, wenn ein Aufruf einmal an der Oberflaeche vorbeigeht.
    CONSTRAINT "TopicLink_url_https" CHECK ("url" LIKE 'https://%')
);

CREATE UNIQUE INDEX "TopicLink_schoolId_subject_topicKey_url_key"
  ON "TopicLink"("schoolId", "subject", "topicKey", "url");
CREATE INDEX "TopicLink_schoolId_subject_topicKey_idx"
  ON "TopicLink"("schoolId", "subject", "topicKey");

ALTER TABLE "TopicLink" ADD CONSTRAINT "TopicLink_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicLink" ADD CONSTRAINT "TopicLink_addedById_fkey"
  FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
