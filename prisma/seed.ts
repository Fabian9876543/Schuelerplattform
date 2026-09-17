/**
 * Beispieldaten zum Ausprobieren.
 *
 * Alle Konten haben dasselbe Passwort: geheim123
 *
 * Enthalten ist ein vollstaendig ausgewertetes Lernvorhaben von Lena, damit
 * man Auswertung, Lernplan und die Nachhilfesuche sofort sehen kann, ohne
 * erst einen Selbsttest ausfuellen zu muessen.
 */
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../lib/generated/prisma/client.js";
import { normalizeTopic } from "../lib/constants.js";
import { buildStudyPlan } from "../lib/planning.js";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // ohne .env wird der Standardpfad unten benutzt
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL fehlt - siehe .env.example.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const PASSWORD = "geheim123";

function inDays(days: number): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

async function main() {
  console.log("Setze Beispieldaten ...");

  // Alles Alte weg, damit der Seed wiederholbar ist.
  // Die Reihenfolge folgt den Fremdschluesseln.
  // Auch die Anmeldeversuche: Sonst bleibt nach dem Seeding eine Sperre aus
  // einem frueheren Lauf bestehen, und die Beispielkonten kommen nicht herein.
  await prisma.loginAttempt.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.message.deleteMany();
  await prisma.tutoringRequest.deleteMany();
  await prisma.studyTask.deleteMany();
  await prisma.deficit.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.selfRating.deleteMany();
  await prisma.question.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.learningGoal.deleteMany();
  await prisma.tutorOfferTopic.deleteMany();
  await prisma.tutorOffer.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Zwei Schulen, damit sich vorfuehren laesst, dass die Suche an der
  // Schulgrenze endet: Die Humboldt-Schule hat ebenfalls Mathe-Nachhilfe -
  // fuer Konten des Goethe-Gymnasiums ist sie unsichtbar.
  const goethe = await prisma.school.create({
    data: { name: "Goethe-Gymnasium", joinCode: "GOETHE" },
  });
  const humboldt = await prisma.school.create({
    data: { name: "Humboldt-Schule", joinCode: "HUMBOLDT" },
  });

  const people = [
    { email: "lena@schule.de", name: "Lena Bergmann", gradeLevel: 11, schoolId: goethe.id },
    { email: "jonas@schule.de", name: "Jonas Weber", gradeLevel: 12, schoolId: goethe.id },
    { email: "mira@schule.de", name: "Mira Sahin", gradeLevel: 13, schoolId: goethe.id },
    { email: "tom@schule.de", name: "Tom Krueger", gradeLevel: 11, schoolId: goethe.id },
    { email: "aylin@schule.de", name: "Aylin Kaya", gradeLevel: 12, schoolId: goethe.id },
    { email: "paul@schule.de", name: "Paul Hoffmann", gradeLevel: 10, schoolId: goethe.id },
    // Andere Schule - taucht bei den Konten oben nie in der Suche auf
    { email: "nils@humboldt.de", name: "Nils Brandt", gradeLevel: 12, schoolId: humboldt.id },
    { email: "sara@humboldt.de", name: "Sara Lindqvist", gradeLevel: 13, schoolId: humboldt.id },
  ];

  const users: Record<string, string> = {};
  for (const person of people) {
    const user = await prisma.user.create({ data: { ...person, passwordHash } });
    users[person.email] = user.id;
  }

  // --- Nachhilfe-Angebote ---------------------------------------------------

  const offers = [
    {
      email: "jonas@schule.de",
      subject: "Mathematik",
      maxGradeLevel: 12,
      description:
        "Ich erklaere gern Schritt fuer Schritt und rechne Aufgaben gemeinsam durch, bis es sitzt.",
      topics: ["Kurvendiskussion", "Ableitungsregeln", "Integralrechnung"],
    },
    {
      email: "mira@schule.de",
      subject: "Mathematik",
      maxGradeLevel: 13,
      description:
        "Leistungskurs Mathe. Besonders stark bei Analysis und allem, was mit Beweisen zu tun hat.",
      topics: ["Integralrechnung", "Extremwertaufgaben", "Kurvendiskussion", "Stochastik"],
    },
    {
      email: "tom@schule.de",
      subject: "Mathematik",
      maxGradeLevel: 10,
      description: "Ich helfe bei den Grundlagen: Bruchrechnen, Gleichungen, Geometrie.",
      topics: ["Gleichungen", "Bruchrechnen", "Geometrie"],
    },
    {
      email: "aylin@schule.de",
      subject: "Englisch",
      maxGradeLevel: 12,
      description: "Ich war ein Jahr in Irland und helfe bei Textanalyse und beim freien Sprechen.",
      topics: ["Textanalyse", "Grammatik", "Vokabeltraining"],
    },
    {
      email: "nils@humboldt.de",
      subject: "Mathematik",
      maxGradeLevel: 12,
      description:
        "Andere Schule: Dieses Angebot darf fuer das Goethe-Gymnasium nicht auftauchen.",
      topics: ["Kurvendiskussion", "Ableitungsregeln", "Extremwertaufgaben"],
    },
    {
      email: "sara@humboldt.de",
      subject: "Mathematik",
      maxGradeLevel: 13,
      description: "Andere Schule: ebenfalls Analysis, ebenfalls unsichtbar von aussen.",
      topics: ["Integralrechnung", "Kurvendiskussion"],
    },
    {
      email: "jonas@schule.de",
      subject: "Physik",
      maxGradeLevel: 11,
      description: "Mechanik und Elektrizitaetslehre erklaere ich am liebsten mit Alltagsbeispielen.",
      topics: ["Mechanik", "Elektrizitaetslehre"],
    },
  ];

  const offerIds: Record<string, string> = {};
  for (const offer of offers) {
    const created = await prisma.tutorOffer.create({
      data: {
        userId: users[offer.email],
        subject: offer.subject,
        maxGradeLevel: offer.maxGradeLevel,
        description: offer.description,
        topics: {
          create: offer.topics.map((name) => ({ name, normalized: normalizeTopic(name) })),
        },
      },
    });
    offerIds[`${offer.email}:${offer.subject}`] = created.id;
  }

  // --- Lenas ausgewertete Mathe-Klausur ------------------------------------

  const examDate = inDays(12);
  const goal = await prisma.learningGoal.create({
    data: {
      userId: users["lena@schule.de"],
      title: "Mathe-Klausur Analysis",
      subject: "Mathematik",
      examDate,
      topics: {
        create: [
          { name: "Ableitungsregeln", normalized: normalizeTopic("Ableitungsregeln"), position: 0 },
          { name: "Kurvendiskussion", normalized: normalizeTopic("Kurvendiskussion"), position: 1 },
          { name: "Extremwertaufgaben", normalized: normalizeTopic("Extremwertaufgaben"), position: 2 },
        ],
      },
    },
    include: { topics: { orderBy: { position: "asc" } } },
  });

  const [ableitungen, kurven, extremwerte] = goal.topics;

  const assessment = await prisma.assessment.create({
    data: {
      learningGoalId: goal.id,
      status: "evaluated",
      submittedAt: new Date(),
      questions: {
        create: [
          {
            topicId: ableitungen.id,
            kind: "multiple_choice",
            prompt: "Wie lautet die Ableitung von f(x) = 3x^4?",
            position: 0,
            optionsJson: JSON.stringify(["12x^3", "3x^3", "12x^4", "4x^3"]),
            correctIndex: 0,
            answerIndex: 0,
            isCorrect: true,
            score: 100,
            feedback: "Richtig - Faktor mal Exponent, Exponent um eins kleiner.",
          },
          {
            topicId: kurven.id,
            kind: "multiple_choice",
            prompt: "Woran erkennt man einen Wendepunkt?",
            position: 1,
            optionsJson: JSON.stringify([
              "Die erste Ableitung ist null",
              "Die zweite Ableitung wechselt das Vorzeichen",
              "Die Funktion schneidet die x-Achse",
              "Die Funktion hat dort ein Maximum",
            ]),
            correctIndex: 1,
            answerIndex: 0,
            isCorrect: false,
            score: 0,
            feedback:
              "Nicht richtig. Bei einem Wendepunkt wechselt die zweite Ableitung das Vorzeichen - die erste Ableitung null zu setzen findet Extremstellen.",
          },
          {
            topicId: extremwerte.id,
            kind: "free_text",
            prompt:
              "Beschreibe, wie du bei einer Extremwertaufgabe vorgehst - von der Textaufgabe bis zur Loesung.",
            position: 2,
            expectedPoints:
              "Hauptbedingung und Nebenbedingung aufstellen, einsetzen, ableiten, null setzen, Randwerte pruefen.",
            answerText:
              "Ich stelle erst eine Gleichung auf und leite dann ab. Danach setze ich null. Bei der Nebenbedingung bin ich mir aber oft unsicher.",
            score: 55,
            feedback:
              "Der Ablauf stimmt im Kern. Der entscheidende Schritt fehlt aber: die Nebenbedingung nach einer Variablen aufloesen und in die Hauptbedingung einsetzen.",
          },
        ],
      },
      selfRatings: {
        create: [
          { topicId: ableitungen.id, confidence: 4 },
          { topicId: kurven.id, confidence: 2 },
          { topicId: extremwerte.id, confidence: 1 },
        ],
      },
    },
  });

  const deficits = [
    {
      topicId: extremwerte.id,
      topicName: extremwerte.name,
      severity: 3,
      explanation:
        "Der Weg von der Textaufgabe zur Gleichung fehlt noch: Haupt- und Nebenbedingung werden nicht sauber getrennt.",
      focus: "Haupt- und Nebenbedingung aufstellen und ineinander einsetzen",
    },
    {
      topicId: kurven.id,
      topicName: kurven.name,
      severity: 2,
      explanation:
        "Extremstellen und Wendepunkte werden verwechselt - welche Ableitung wofuer zustaendig ist, sitzt noch nicht.",
      focus: "Erste und zweite Ableitung den richtigen Punkttypen zuordnen",
    },
  ];

  const plan = buildStudyPlan(deficits, examDate);

  await prisma.evaluation.create({
    data: {
      assessmentId: assessment.id,
      summary:
        "Die Ableitungsregeln sitzen schon gut. Bei der Kurvendiskussion bringst du Extremstellen und Wendepunkte noch durcheinander, und bei den Extremwertaufgaben fehlt dir der Weg von der Textaufgabe zur Gleichung. Genau da setzt dein Lernplan an - beides ist in zwoelf Tagen gut zu schaffen.",
      overallScore: 52,
      source: "rule",
      deficits: {
        create: deficits.map((deficit) => ({
          topicId: deficit.topicId,
          severity: deficit.severity,
          explanation: deficit.explanation,
        })),
      },
      studyTasks: {
        create: plan.map((task) => ({
          topicId: task.topicId,
          dueDate: task.dueDate,
          title: task.title,
          description: task.description,
          estimatedMinutes: task.estimatedMinutes,
        })),
      },
    },
  });

  // --- Eine offene Anfrage, damit der Ablauf sichtbar ist -------------------

  await prisma.tutoringRequest.create({
    data: {
      requesterId: users["paul@schule.de"],
      tutorOfferId: offerIds["jonas@schule.de:Mathematik"],
      topic: "Ableitungsregeln",
      message:
        "Hallo Jonas, ich komme bei den Ableitungsregeln nicht weiter, vor allem bei der Kettenregel. Haettest du diese Woche Zeit?",
    },
  });

  // Eine bereits angenommene Anfrage, spaeter mit Verlauf und Bewertung.
  const angenommen = await prisma.tutoringRequest.create({
    data: {
      requesterId: users["tom@schule.de"],
      tutorOfferId: offerIds["mira@schule.de:Mathematik"],
      topic: "Integralrechnung",
      message: "Hi Mira, kannst du mir die Stammfunktionen nochmal erklaeren?",
      status: "accepted",
      responseMessage: "Klar, melde dich einfach.",
      respondedAt: new Date(),
    },
  });

  // ... mit angefangenem Verlauf. Miras letzte Nachricht bleibt ungelesen,
  // damit sich der Zaehler in der Navigation gleich nach der Anmeldung als
  // Tom zeigt.
  const vorhin = (minuten: number) => new Date(Date.now() - minuten * 60_000);

  await prisma.message.create({
    data: {
      requestId: angenommen.id,
      senderId: users["tom@schule.de"],
      body: "Super, danke dir! Passt dir Mittwoch nach der sechsten Stunde?",
      createdAt: vorhin(90),
      readAt: vorhin(80),
    },
  });
  await prisma.message.create({
    data: {
      requestId: angenommen.id,
      senderId: users["mira@schule.de"],
      body: "Mittwoch geht bei mir. Bring die letzte Klausur mit, dann gehen wir die Aufgaben durch.",
      createdAt: vorhin(45),
    },
  });

  // --- Bewertungen ---------------------------------------------------------
  //
  // Damit sich die Wirkung in der Suche nachsehen laesst: Mira ist zweimal
  // gut bewertet, Tom einmal maessig, Jonas noch gar nicht. In der Suche
  // nach Mathematik steht Mira dadurch vor Jonas - bei sonst gleicher
  // Passung. Jonas rutscht dabei nicht nach unten, weil ihm eine Bewertung
  // fehlt, sondern weil Mira eine hat.

  await prisma.rating.create({
    data: {
      requestId: angenommen.id,
      tutorOfferId: offerIds["mira@schule.de:Mathematik"],
      raterId: users["tom@schule.de"],
      stars: 5,
      comment:
        "Mira hat sich zweimal Zeit genommen und so lange nachgefragt, bis ich es selbst erklaeren konnte.",
    },
  });

  const zweiteZusage = await prisma.tutoringRequest.create({
    data: {
      requesterId: users["aylin@schule.de"],
      tutorOfferId: offerIds["mira@schule.de:Mathematik"],
      topic: "Kurvendiskussion",
      message: "Hi Mira, ich haenge bei den Wendepunkten. Schaffst du das vor der Klausur?",
      status: "accepted",
      responseMessage: "Ja, komm einfach Freitag in der Freistunde.",
      respondedAt: new Date(),
    },
  });
  await prisma.rating.create({
    data: {
      requestId: zweiteZusage.id,
      tutorOfferId: offerIds["mira@schule.de:Mathematik"],
      raterId: users["aylin@schule.de"],
      stars: 4,
      comment: "Gut erklaert, nur ging es mir stellenweise etwas schnell.",
    },
  });

  const dritteZusage = await prisma.tutoringRequest.create({
    data: {
      requesterId: users["paul@schule.de"],
      tutorOfferId: offerIds["tom@schule.de:Mathematik"],
      topic: "Gleichungen",
      message: "Hallo Tom, kriegst du mir das Umstellen von Gleichungen beigebracht?",
      status: "accepted",
      responseMessage: "Klar, machen wir.",
      respondedAt: new Date(),
    },
  });
  await prisma.rating.create({
    data: {
      requestId: dritteZusage.id,
      tutorOfferId: offerIds["tom@schule.de:Mathematik"],
      raterId: users["paul@schule.de"],
      stars: 2,
      comment: "Tom hat mir die Aufgaben vorgerechnet, verstanden habe ich es danach trotzdem nicht.",
    },
  });

  console.log("Fertig: 2 Schulen (Beitrittscodes GOETHE und HUMBOLDT),");
  console.log(`${people.length} Konten, ${offers.length} Nachhilfe-Angebote,`);
  console.log(`1 ausgewertetes Lernvorhaben mit ${plan.length} Lernaufgaben,`);
  console.log("3 angenommene Anfragen, davon eine mit Nachrichtenverlauf,");
  console.log("3 Bewertungen (Mira 5 und 4, Tom 2, Jonas noch keine).");
  console.log(`Passwort fuer alle Konten: ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
