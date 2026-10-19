import { describe, expect, it } from "vitest";

import {
  contentDisposition,
  csvCell,
  DEFAULT_EXPORT_STATUSES,
  type ExportRow,
  exportFileNames,
  exportUrl,
  formatCsv,
  formatExportDateTime,
  formatExportDay,
  formatTxt,
  parseExportQuery,
  selectExportRows,
  slugify,
} from "@/lib/export";

let seq = 0;
function row(overrides: Partial<ExportRow> = {}): ExportRow {
  seq += 1;
  return {
    id: `r${String(seq).padStart(3, "0")}`,
    title: `Utwór ${seq}`,
    artist: "sanah",
    status: "PENDING",
    voteCount: 0,
    createdAt: new Date(Date.UTC(2026, 9, 24, 19, seq)),
    playedAt: null,
    ...overrides,
  };
}

const query = (search: string) => parseExportQuery(new URLSearchParams(search));

describe("parseExportQuery", () => {
  it("defaults to every status except REJECTED", () => {
    expect(query("format=csv")).toMatchObject({ success: true, data: { format: "csv", status: ["PENDING", "ACCEPTED", "PLAYED"] } });
    expect(DEFAULT_EXPORT_STATUSES).not.toContain("REJECTED");
  });

  it("accepts repeated and comma-separated statuses, without duplicates, in a fixed order", () => {
    expect(query("format=txt&status=PLAYED&status=REJECTED,PLAYED")).toMatchObject({
      success: true,
      data: { format: "txt", status: ["REJECTED", "PLAYED"] },
    });
    expect(query("format=txt&status=")).toMatchObject({ success: true, data: { status: ["PENDING", "ACCEPTED", "PLAYED"] } });
  });

  it("rejects an unknown format or status", () => {
    expect(query("").success).toBe(false);
    expect(query("format=xlsx").success).toBe(false);
    expect(query("format=csv&status=DONE").success).toBe(false);
    expect(query("format=csv&status=pending").success).toBe(false);
  });
});

describe("exportUrl", () => {
  it("builds the API link with the chosen statuses", () => {
    expect(exportUrl("ev1", "csv", ["PLAYED", "PENDING"])).toBe("/api/events/ev1/export?format=csv&status=PENDING&status=PLAYED");
    const parsed = parseExportQuery(new URL(exportUrl("ev1", "txt", ["REJECTED"]), "http://x").searchParams);
    expect(parsed).toMatchObject({ success: true, data: { format: "txt", status: ["REJECTED"] } });
  });
});

describe("selectExportRows", () => {
  it("filters by status and orders by votes, then the oldest request first", () => {
    const older = row({ title: "Starszy", voteCount: 2 });
    const top = row({ title: "Top", voteCount: 5, status: "PLAYED" });
    const newer = row({ title: "Nowszy", voteCount: 2, status: "ACCEPTED" });
    const rejected = row({ title: "Odrzucony", voteCount: 9, status: "REJECTED" });
    expect(selectExportRows([newer, rejected, older, top], DEFAULT_EXPORT_STATUSES).map((r) => r.title)).toEqual([
      "Top",
      "Starszy",
      "Nowszy",
    ]);
    expect(selectExportRows([newer, rejected], ["REJECTED"]).map((r) => r.title)).toEqual(["Odrzucony"]);
  });
});

describe("dates", () => {
  it("formats in Europe/Warsaw, summer and winter time", () => {
    expect(formatExportDateTime(new Date("2026-07-04T19:05:00Z"))).toBe("2026-07-04 21:05");
    expect(formatExportDateTime(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01 00:30");
    expect(formatExportDay(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
});

describe("csvCell", () => {
  it("leaves plain text alone", () => {
    expect(csvCell("Ona tańczy dla mnie")).toBe("Ona tańczy dla mnie");
  });

  it("quotes commas, quotes and line breaks, doubling quotes", () => {
    expect(csvCell("Kayah, Bregović")).toBe('"Kayah, Bregović"');
    expect(csvCell('Piosenka "na bis"')).toBe('"Piosenka ""na bis"""');
    expect(csvCell("dwie\nlinie")).toBe('"dwie\nlinie"');
    expect(csvCell("a\r\nb")).toBe('"a\r\nb"');
  });

  it("neutralises formula injection with a leading apostrophe", () => {
    expect(csvCell("=HYPERLINK(\"http://zlo\")")).toBe(`"'=HYPERLINK(""http://zlo"")"`);
    expect(csvCell("+48 123")).toBe("'+48 123");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tukryte")).toBe("'\tukryte");
    expect(csvCell("\rx")).toBe(`"'\rx"`);
    expect(csvCell("a=b")).toBe("a=b");
  });
});

describe("formatCsv", () => {
  it("writes a BOM, the Polish header, Polish status labels and CRLF line endings", () => {
    const csv = formatCsv([
      row({
        title: 'Zażółć, "gęślą"',
        artist: "Łzy",
        status: "PLAYED",
        voteCount: 3,
        createdAt: new Date("2026-10-24T19:05:00Z"),
        playedAt: new Date("2026-10-24T20:40:00Z"),
      }),
      row({ title: "=1+1", artist: "Kult", status: "PENDING", voteCount: 0, createdAt: new Date("2026-10-24T19:10:00Z") }),
      row({ title: "Bitwa", artist: "X", status: "ACCEPTED", voteCount: 1, createdAt: new Date("2026-10-24T19:11:00Z") }),
      row({ title: "Nie", artist: "Y", status: "REJECTED", voteCount: 1, createdAt: new Date("2026-10-24T19:12:00Z") }),
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "tytuł,artysta,status,głosy,dodano,zagrano",
      '"Zażółć, ""gęślą""",Łzy,Zagrane,3,2026-10-24 21:05,2026-10-24 22:40',
      "'=1+1,Kult,Nowe,0,2026-10-24 21:10,",
      "Bitwa,X,Zaakceptowane,1,2026-10-24 21:11,",
      "Nie,Y,Odrzucone,1,2026-10-24 21:12,",
      "",
    ]);
  });

  it("keeps a line break inside a quoted cell (one record per request)", () => {
    const csv = formatCsv([row({ title: "a\nb", artist: "c" })]);
    expect(csv).toContain('"a\nb",c,Nowe');
  });

  it("is just the header for an empty list", () => {
    expect(formatCsv([])).toBe("﻿tytuł,artysta,status,głosy,dodano,zagrano\r\n");
  });
});

describe("formatTxt", () => {
  it('writes "Artysta – Tytuł" lines with an en dash, one line per track, no BOM', () => {
    const txt = formatTxt([row({ artist: "Kayah, Bregović", title: "Prawy do lewego" }), row({ artist: "  sanah ", title: "Szam\npan" })]);
    expect(txt).toBe("Kayah, Bregović – Prawy do lewego\nsanah – Szam pan\n");
    expect(txt.startsWith("﻿")).toBe(false);
    expect(formatTxt([])).toBe("");
  });
});

describe("file names", () => {
  it("slugifies Polish names to ASCII", () => {
    expect(slugify("Wesele Łucji & Michała — Żółć!")).toBe("wesele-lucji-michala-zolc");
    expect(slugify("🎉🎉")).toBe("wydarzenie");
    expect(slugify("a".repeat(100))).toHaveLength(60);
  });

  it("builds an ASCII filename and an RFC 5987 filename*", () => {
    expect(exportFileNames('Wesele "Ani"/Łodź', "2026-10-24", "csv")).toEqual({
      ascii: "wesele-ani-lodz-2026-10-24.csv",
      unicode: "Wesele Ani Łodź 2026-10-24.csv",
    });
    const header = contentDisposition("Wesele Łucji (sobota)", "2026-10-24", "txt");
    expect(header).toBe(
      "attachment; filename=\"wesele-lucji-sobota-2026-10-24.txt\"; filename*=UTF-8''Wesele%20%C5%81ucji%20%28sobota%29%202026-10-24.txt",
    );
    expect(contentDisposition("a\r\nb\";", "2026-10-24", "csv")).not.toMatch(/[\r\n]/);
  });
});
