import { describe, expect, it } from "vitest";

import { boardIds, formatAgo, moveBoardItem, spotifySearchUrl, unseenIds } from "@/lib/board-view";
import { type BoardItem, type BoardRow, buildBoardColumns, type DjBoard } from "@/lib/dj-board";

const at = (minute: number) => new Date(Date.UTC(2026, 9, 24, 21, minute));

let seq = 0;
function row(overrides: Partial<BoardRow> = {}): BoardRow {
  seq += 1;
  return {
    id: `r${String(seq).padStart(3, "0")}`,
    trackId: `t${seq}`,
    title: `Utwór ${seq}`,
    artist: "Sanah",
    coverUrl: null,
    durationSec: 200,
    status: "PENDING",
    createdAt: at(seq % 60),
    playedAt: null,
    voteCount: 1,
    ...overrides,
  };
}

describe("spotifySearchUrl", () => {
  it("searches for 'artist title', URL-encoded", () => {
    expect(spotifySearchUrl("sanah", "Szampan")).toBe("https://open.spotify.com/search/sanah%20Szampan");
    expect(spotifySearchUrl("Kult", "Arahja / Polska & ?#")).toBe(
      `https://open.spotify.com/search/${encodeURIComponent("Kult Arahja / Polska & ?#")}`,
    );
    expect(spotifySearchUrl("Kult", "A/B?c#d")).not.toMatch(/search\/Kult%20A\/B/);
  });
});

describe("formatAgo", () => {
  const now = at(30).getTime();
  it.each([
    [at(30), "przed chwilą"],
    [new Date(now - 59_000), "przed chwilą"],
    [at(25), "5 min temu"],
    [new Date(now - 60 * 60_000), "1 godz. temu"],
    [new Date(now - 75 * 60_000), "1 godz. 15 min temu"],
    [new Date(now - 4 * 60 * 60_000 - 7 * 60_000), "4 godz. temu"],
  ])("%s → %s", (createdAt, expected) => {
    expect(formatAgo(createdAt.toISOString(), now)).toBe(expected);
  });
});

describe("buildBoardColumns", () => {
  it("puts every status (REJECTED included) in its own column, each sorted by votes then oldest first", () => {
    const columns = buildBoardColumns([
      row({ id: "p-1", voteCount: 1, createdAt: at(1) }),
      row({ id: "p-5", voteCount: 5, createdAt: at(9) }),
      row({ id: "p-3-late", voteCount: 3, createdAt: at(8) }),
      row({ id: "p-3-early", voteCount: 3, createdAt: at(2) }),
      row({ id: "a-2", status: "ACCEPTED", voteCount: 2 }),
      row({ id: "a-7", status: "ACCEPTED", voteCount: 7 }),
      row({ id: "pl-1", status: "PLAYED", voteCount: 1, playedAt: at(50) }),
      row({ id: "pl-4", status: "PLAYED", voteCount: 4, playedAt: at(40) }),
      row({ id: "rej", status: "REJECTED", voteCount: 50 }),
    ]);
    const ids = (status: keyof typeof columns) => columns[status].map((item) => item.id);
    expect(ids("PENDING")).toEqual(["p-5", "p-3-early", "p-3-late", "p-1"]);
    expect(ids("ACCEPTED")).toEqual(["a-7", "a-2"]);
    expect(ids("PLAYED")).toEqual(["pl-4", "pl-1"]);
    expect(ids("REJECTED")).toEqual(["rej"]);
  });

  it("serializes to the API shape: votes, ISO dates", () => {
    const { PLAYED } = buildBoardColumns([row({ id: "x", status: "PLAYED", voteCount: 3, createdAt: at(1), playedAt: at(2) })]);
    expect(PLAYED[0]).toEqual({
      id: "x",
      trackId: expect.any(String),
      title: expect.any(String),
      artist: "Sanah",
      coverUrl: null,
      durationSec: 200,
      status: "PLAYED",
      votes: 3,
      createdAt: at(1).toISOString(),
      playedAt: at(2).toISOString(),
    });
  });
});

function board(rows: BoardRow[]): DjBoard {
  return { event: { id: "e1", status: "LIVE", requestsOpen: true }, columns: buildBoardColumns(rows) };
}

describe("moveBoardItem (optimistic board action)", () => {
  it("moves a request to the target column at its vote rank and stamps playedAt for Zagrane", () => {
    const before = board([
      row({ id: "new", voteCount: 4 }),
      row({ id: "played-9", status: "PLAYED", voteCount: 9, playedAt: at(5) }),
      row({ id: "played-1", status: "PLAYED", voteCount: 1, playedAt: at(6) }),
    ]);
    const after = moveBoardItem(before, "new", "PLAYED", at(30));
    expect(after.columns.PENDING).toEqual([]);
    expect(after.columns.PLAYED.map((item) => item.id)).toEqual(["played-9", "new", "played-1"]);
    expect(after.columns.PLAYED[1]).toMatchObject({ status: "PLAYED", playedAt: at(30).toISOString() });
    // The original board is not mutated (SWR keeps it for rollback).
    expect(before.columns.PENDING.map((item) => item.id)).toEqual(["new"]);
  });

  it("clears playedAt when a track goes back to Nowe", () => {
    const after = moveBoardItem(board([row({ id: "x", status: "PLAYED", playedAt: at(5) })]), "x", "PENDING", at(30));
    expect(after.columns.PLAYED).toEqual([]);
    expect(after.columns.PENDING[0]).toMatchObject<Partial<BoardItem>>({ id: "x", status: "PENDING", playedAt: null });
  });

  it("leaves the board unchanged for an unknown id", () => {
    const before = board([row({ id: "x" })]);
    expect(moveBoardItem(before, "nope", "PLAYED", at(1))).toBe(before);
  });
});

describe("new requests since the last refresh", () => {
  it("marks ids that are not in the seen set", () => {
    expect(unseenIds(["a", "b", "c"], new Set(["a", "c"]))).toEqual(["b"]);
    expect(unseenIds(["a"], new Set(["a"]))).toEqual([]);
  });

  it("marks nothing on the very first visit (nothing remembered yet)", () => {
    expect(unseenIds(["a", "b"], null)).toEqual([]);
  });

  it("collects every id on the board, from all columns", () => {
    const b = board([row({ id: "p" }), row({ id: "a", status: "ACCEPTED" }), row({ id: "r", status: "REJECTED" })]);
    expect(boardIds(b).sort()).toEqual(["a", "p", "r"]);
  });
});
