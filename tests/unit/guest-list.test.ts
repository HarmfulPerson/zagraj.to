import { describe, expect, it } from "vitest";

import { polishPlural, votesLabel } from "@/components/guest/GuestRequestList";
import { isJsonContentType, requireJsonContentType } from "@/lib/api-responses";
import { buildGuestList, type GuestListRow, PLAYED_LIST_LIMIT } from "@/lib/guest-list";

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let seq = 0;
function row(overrides: Partial<GuestListRow> = {}): GuestListRow {
  seq += 1;
  return {
    id: `r${String(seq).padStart(3, "0")}`,
    trackId: `t${seq}`,
    title: `Utwór ${seq}`,
    artist: "Sanah",
    coverUrl: null,
    durationSec: 200,
    status: "PENDING",
    createdByGuestId: OTHER,
    createdAt: new Date(Date.UTC(2026, 5, 1, 20, 0, seq)),
    playedAt: null,
    voteCount: 1,
    votedByMe: false,
    ...overrides,
  };
}

const at = (minute: number) => new Date(Date.UTC(2026, 5, 1, 21, minute));

describe("buildGuestList: sorting", () => {
  it("sorts the queue by votes (descending), then by date (oldest first)", () => {
    const rows = [
      row({ id: "late-3", voteCount: 3, createdAt: at(30) }),
      row({ id: "one", voteCount: 1, createdAt: at(1) }),
      row({ id: "five", voteCount: 5, createdAt: at(40), status: "ACCEPTED" }),
      row({ id: "early-3", voteCount: 3, createdAt: at(10) }),
      row({ id: "zero", voteCount: 0, createdAt: at(0) }),
    ];
    expect(buildGuestList(rows, ME).queue.map((item) => item.id)).toEqual(["five", "early-3", "late-3", "one", "zero"]);
  });

  it("is stable for equal votes and dates (by id)", () => {
    const same = at(5);
    const rows = [row({ id: "b", createdAt: same }), row({ id: "a", createdAt: same })];
    expect(buildGuestList(rows, ME).queue.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("keeps PENDING and ACCEPTED together in the queue, ranked only by votes", () => {
    const rows = [row({ id: "acc", status: "ACCEPTED", voteCount: 1 }), row({ id: "pen", status: "PENDING", voteCount: 2 })];
    const { queue } = buildGuestList(rows, ME);
    expect(queue.map((item) => [item.id, item.status])).toEqual([
      ["pen", "PENDING"],
      ["acc", "ACCEPTED"],
    ]);
  });

  it("lists played tracks separately, most recently played first, capped at 20", () => {
    const played = Array.from({ length: 25 }, (_, i) => row({ id: `p${i}`, status: "PLAYED", playedAt: at(i), voteCount: 9 }));
    const { queue, played: shown } = buildGuestList([row({ id: "q" }), ...played], ME);
    expect(queue.map((item) => item.id)).toEqual(["q"]);
    expect(shown).toHaveLength(PLAYED_LIST_LIMIT);
    expect(shown[0].id).toBe("p24");
    expect(shown.at(-1)?.id).toBe("p5");
    expect(shown.every((item) => item.status === "PLAYED")).toBe(true);
  });
});

describe("buildGuestList: REJECTED is hidden", () => {
  it("never returns rejected requests, whatever their votes", () => {
    const rows = [
      row({ id: "rejected", status: "REJECTED", voteCount: 100, createdByGuestId: ME, votedByMe: true }),
      row({ id: "ok", voteCount: 1 }),
      row({ id: "played", status: "PLAYED", playedAt: at(1) }),
    ];
    const { queue, played } = buildGuestList(rows, ME);
    const ids = [...queue, ...played].map((item) => item.id);
    expect(ids).toEqual(["ok", "played"]);
    expect(JSON.stringify({ queue, played })).not.toContain("REJECTED");
  });

  it("returns empty lists when everything was rejected", () => {
    expect(buildGuestList([row({ status: "REJECTED" })], ME)).toEqual({ queue: [], played: [] });
  });
});

describe("buildGuestList: per-guest fields", () => {
  it("marks the guest's own requests and votes as booleans, without exposing guest ids", () => {
    const { queue } = buildGuestList(
      [row({ id: "mine", createdByGuestId: ME, votedByMe: true, voteCount: 2 }), row({ id: "theirs", voteCount: 1 })],
      ME,
    );
    expect(queue).toEqual([
      expect.objectContaining({ id: "mine", mine: true, votedByMe: true, votes: 2 }),
      expect.objectContaining({ id: "theirs", mine: false, votedByMe: false, votes: 1 }),
    ]);
    for (const item of queue) {
      expect(Object.keys(item).sort()).toEqual(
        ["artist", "coverUrl", "durationSec", "id", "mine", "status", "title", "trackId", "votedByMe", "votes"].sort(),
      );
    }
    expect(JSON.stringify(queue)).not.toContain(OTHER);
    expect(JSON.stringify(queue)).not.toContain(ME);
  });

  it("without a guest id nothing is mine", () => {
    const { queue } = buildGuestList([row({ createdByGuestId: ME })], null);
    expect(queue[0].mine).toBe(false);
  });
});

describe("votesLabel / polishPlural", () => {
  it.each([
    [0, "0 głosów"],
    [1, "1 głos"],
    [2, "2 głosy"],
    [4, "4 głosy"],
    [5, "5 głosów"],
    [12, "12 głosów"],
    [14, "14 głosów"],
    [22, "22 głosy"],
    [25, "25 głosów"],
    [112, "112 głosów"],
  ])("%i → %s", (count, label) => {
    expect(votesLabel(count)).toBe(label);
  });

  it("works for other words", () => {
    expect(polishPlural(3, "utwór", "utwory", "utworów")).toBe("3 utwory");
  });
});

describe("requireJsonContentType", () => {
  const req = (contentType?: string) =>
    new Request("http://localhost/api/x", { method: "POST", headers: contentType ? { "content-type": contentType } : {} });

  it("accepts application/json, also with parameters and any case", () => {
    expect(isJsonContentType(req("application/json"))).toBe(true);
    expect(isJsonContentType(req("Application/JSON; charset=utf-8"))).toBe(true);
    expect(requireJsonContentType(req("application/json"))).toBeNull();
  });

  it.each([undefined, "text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", "application/json-patch+json"])(
    "rejects %s with 415",
    async (contentType) => {
      const response = requireJsonContentType(req(contentType));
      expect(response?.status).toBe(415);
      expect(await response?.json()).toEqual({ error: "UNSUPPORTED_MEDIA_TYPE" });
    },
  );
});
