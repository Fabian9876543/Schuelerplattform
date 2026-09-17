-- Wann eine Lernaufgabe abgehakt wurde.
--
-- Bewusst **ohne** Nachtragen fuer bereits erledigte Aufgaben: Wann sie
-- abgehakt wurden, weiss niemand. Das Faelligkeitsdatum einzusetzen waere
-- geraten, und eine erfundene Serie ist schlechter als gar keine. Wer vor
-- dieser Aenderung abgehakt hat, faengt seine Serie neu an.

ALTER TABLE "StudyTask" ADD COLUMN "doneAt" TIMESTAMP(3);
