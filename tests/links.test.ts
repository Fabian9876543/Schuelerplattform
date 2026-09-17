import { describe, expect, it } from "vitest";

import { normalizeTopic } from "@/lib/constants";
import {
  canCurateLinks,
  hostOf,
  isSafeUrl,
  matchLinks,
  searchUrl,
  type CuratedLink,
} from "@/lib/links";

function link(teil: Partial<CuratedLink> & { topic: string }): CuratedLink {
  return {
    id: teil.topic,
    subject: teil.subject ?? "Mathematik",
    topicKey: normalizeTopic(teil.topic),
    topic: teil.topic,
    title: teil.title ?? `Video zu ${teil.topic}`,
    url: teil.url ?? "https://www.youtube.com/watch?v=abc",
    note: teil.note ?? null,
  };
}

describe("canCurateLinks", () => {
  it("laesst nur Lehrkraefte mit Verwaltungsrechten pflegen", () => {
    expect(canCurateLinks({ kind: "teacher", isAdmin: true })).toBe(true);
  });

  it("laesst eine Schuelerin mit Verwaltungsrechten nicht pflegen", () => {
    // Sie darf Angebote freigeben und Faecher pflegen - fuer fremde Inhalte
    // geradezustehen ist etwas anderes.
    expect(canCurateLinks({ kind: "student", isAdmin: true })).toBe(false);
  });

  it("laesst eine Lehrkraft ohne Verwaltungsrechte nicht pflegen", () => {
    expect(canCurateLinks({ kind: "teacher", isAdmin: false })).toBe(false);
  });
});

describe("isSafeUrl", () => {
  it("nimmt eine gewoehnliche https-Adresse", () => {
    expect(isSafeUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
  });

  it("weist http ab", () => {
    expect(isSafeUrl("http://example.org/video")).toBe(false);
  });

  it("weist javascript: ab", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });

  it("weist Adressen mit Anmeldedaten ab", () => {
    // "youtube.com" ist hier nur der Benutzername - das Ziel ist beispiel.tld.
    expect(isSafeUrl("https://youtube.com@beispiel.tld/video")).toBe(false);
  });

  it("weist Hosts ohne Punkt ab", () => {
    expect(isSafeUrl("https://localhost/video")).toBe(false);
  });

  it("weist Freitext ab", () => {
    expect(isSafeUrl("youtube kurvendiskussion")).toBe(false);
  });

  it("stoert sich nicht an Leerzeichen am Rand", () => {
    expect(isSafeUrl("  https://beispiel.tld/video  ")).toBe(true);
  });
});

describe("hostOf", () => {
  it("zeigt den Host ohne www", () => {
    expect(hostOf("https://www.youtube.com/watch?v=abc")).toBe("youtube.com");
  });

  it("laesst andere Hosts stehen", () => {
    expect(hostOf("https://www.ardmediathek.de/x")).toBe("ardmediathek.de");
    expect(hostOf("https://studyflix.de/x")).toBe("studyflix.de");
  });
});

describe("matchLinks", () => {
  const links = [
    link({ topic: "Kurvendiskussion", title: "B Kurvendiskussion" }),
    link({ topic: "Kurvendiskussion und Extremwerte", title: "A Extremwerte" }),
    link({ topic: "Vektoren" }),
    link({ topic: "Kurvendiskussion", subject: "Physik", title: "Physik-Video" }),
  ];

  it("findet den exakten Treffer zuerst", () => {
    const treffer = matchLinks(links, "Mathematik", "Kurvendiskussion");
    expect(treffer[0].title).toBe("B Kurvendiskussion");
    expect(treffer).toHaveLength(2);
  });

  it("nimmt Teiltreffer mit, aber dahinter", () => {
    const treffer = matchLinks(links, "Mathematik", "Kurvendiskussion");
    expect(treffer[1].title).toBe("A Extremwerte");
  });

  it("gleicht Gross- und Kleinschreibung an", () => {
    expect(matchLinks(links, "Mathematik", "  KURVENDISKUSSION ")).toHaveLength(2);
  });

  it("bleibt im Fach", () => {
    // Dasselbe Thema in Physik ist eine andere Sache.
    const treffer = matchLinks(links, "Mathematik", "Kurvendiskussion");
    expect(treffer.map((t) => t.title)).not.toContain("Physik-Video");
  });

  it("liefert nichts zu einem fremden Thema", () => {
    expect(matchLinks(links, "Mathematik", "Stochastik")).toHaveLength(0);
  });

  it("laesst sich von sehr kurzen Themen nicht alles einsammeln", () => {
    // "ab" steckt in vielem, meint aber nichts davon.
    expect(matchLinks(links, "Mathematik", "ab")).toHaveLength(0);
  });

  it("liefert nichts bei leerem Thema", () => {
    expect(matchLinks(links, "Mathematik", "   ")).toHaveLength(0);
  });
});

describe("searchUrl", () => {
  it("baut eine Suche aus Fach und Thema", () => {
    const url = new URL(searchUrl("Mathematik", "Kurvendiskussion"));
    expect(url.protocol).toBe("https:");
    expect(url.searchParams.get("search_query")).toBe("Mathematik Kurvendiskussion einfach erklaert");
  });

  it("kommt mit Sonderzeichen im Thema zurecht", () => {
    const url = new URL(searchUrl("Deutsch", "Faust & Gretchen"));
    expect(url.searchParams.get("search_query")).toContain("Faust & Gretchen");
  });
});
