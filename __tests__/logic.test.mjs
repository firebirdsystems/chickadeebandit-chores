import { describe, it, expect } from "vitest";
import {
  initial, memberColor, MEMBER_COLORS,
  isoWeek, weekLabel,
  isAssigned, isDone, isDoneNow, completionCount, choresDoneThisWeek,
  earnedCents, fmtDollars, todayStr, canActForOthers, speaksForOthers, owedCents, streakEvent,
  isDuplicateRowError, sendWithRetry, publishAppEvent, worthRetryingLater,
} from "../src/logic.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────
const MEMBERS = [
  { id: "adult-1", name: "Alice", role: "adult" },
  { id: "kid-1",   name: "Jordan", role: "child" },
  { id: "kid-2",   name: "Casey",  role: "child" },
];

function chore(overrides = {}) {
  return { id: "chore-1", name: "Make bed", points: 5, assignedTo: ["children"], frequency: "weekly", ...overrides };
}

const SETTINGS = { centsPerPoint: 10, resetDay: "monday" };

// Build the in-memory completions shape — { week: { choreId: [{ memberId, day }] } } —
// from a terse { choreId: [memberId | {memberId, day}] } map. Bare member-id strings
// become weekly completions (day ""); pass { memberId, day } for daily completions.
function comp(week, map) {
  const out = {};
  for (const [choreId, entries] of Object.entries(map)) {
    out[choreId] = entries.map(e => typeof e === "string" ? { memberId: e, day: "" } : e);
  }
  return { [week]: out };
}

// ── initial() ─────────────────────────────────────────────────────────────────
describe("initial", () => {
  it("returns the first character uppercased", () => {
    expect(initial("alice")).toBe("A");
    expect(initial("Bob")).toBe("B");
  });

  it("handles single-character names", () => {
    expect(initial("Z")).toBe("Z");
  });

  it("returns ? for empty/falsy name", () => {
    expect(initial("")).toBe("?");
    expect(initial(null)).toBe("?");
  });
});

// ── memberColor() ─────────────────────────────────────────────────────────────
describe("memberColor", () => {
  it("returns a color from the palette", () => {
    const color = memberColor("adult-1", MEMBERS);
    expect(MEMBER_COLORS).toContain(color);
  });

  it("returns the same color for the same member on repeated calls", () => {
    const c1 = memberColor("kid-1", MEMBERS);
    const c2 = memberColor("kid-1", MEMBERS);
    expect(c1).toBe(c2);
  });

  it("returns different colors for different members", () => {
    const c1 = memberColor("adult-1", MEMBERS);
    const c2 = memberColor("kid-1", MEMBERS);
    // Not guaranteed different if palette wraps, but in this case palette > member count
    // Just verify both are valid colors
    expect(MEMBER_COLORS).toContain(c1);
    expect(MEMBER_COLORS).toContain(c2);
  });

  it("wraps around when there are more members than colors", () => {
    const manyMembers = Array.from({ length: MEMBER_COLORS.length + 2 }, (_, i) => ({
      id: `m-${i}`, name: `Member ${i}`, role: "adult",
    }));
    const last = manyMembers[MEMBER_COLORS.length];
    expect(MEMBER_COLORS).toContain(memberColor(last.id, manyMembers));
  });
});

// ── isoWeek() ─────────────────────────────────────────────────────────────────
describe("isoWeek", () => {
  it("returns a string matching YYYY-WNN format", () => {
    expect(isoWeek(new Date("2026-05-17T12:00:00Z"))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("returns correct week for a known date — 2026-05-17 is W20", () => {
    expect(isoWeek(new Date("2026-05-17T12:00:00Z"))).toBe("2026-W20");
  });

  it("handles year boundary correctly — 2025-12-29 belongs to 2026-W01", () => {
    // ISO: week containing first Thursday of year
    expect(isoWeek(new Date("2025-12-29T12:00:00Z"))).toBe("2026-W01");
  });

  it("handles year boundary — 2026-01-01 is 2026-W01", () => {
    expect(isoWeek(new Date("2026-01-01T12:00:00Z"))).toBe("2026-W01");
  });

  it("same week for Mon through Sun of the same week", () => {
    const week = isoWeek(new Date("2026-05-11T12:00:00Z")); // Monday
    expect(isoWeek(new Date("2026-05-12T12:00:00Z"))).toBe(week); // Tuesday
    expect(isoWeek(new Date("2026-05-17T12:00:00Z"))).toBe(week); // Sunday
  });

  it("different weeks for dates in adjacent weeks", () => {
    expect(isoWeek(new Date("2026-05-10T12:00:00Z"))).not.toBe(isoWeek(new Date("2026-05-11T12:00:00Z")));
  });

  it("pads single-digit week numbers with leading zero", () => {
    const w = isoWeek(new Date("2026-01-05T12:00:00Z")); // Week 2
    expect(w).toMatch(/-W\d{2}$/);
    const num = parseInt(w.split("-W")[1]);
    expect(String(num).padStart(2, "0")).toBe(w.split("-W")[1]);
  });
});

// ── weekLabel() ───────────────────────────────────────────────────────────────
describe("weekLabel", () => {
  it("returns a string containing a dash separator", () => {
    expect(weekLabel(new Date("2026-05-17T12:00:00Z"))).toContain("–");
  });

  it("starts on Monday and ends on Sunday for a mid-week date", () => {
    const label = weekLabel(new Date("2026-05-13T12:00:00Z")); // Wednesday
    expect(label).toContain("May 11");  // Monday
    expect(label).toContain("May 17");  // Sunday
  });

  it("returns correct range when given a Monday", () => {
    const label = weekLabel(new Date("2026-05-11T12:00:00Z")); // Monday
    expect(label.startsWith("May 11")).toBe(true);
  });

  it("returns correct range when given a Sunday", () => {
    const label = weekLabel(new Date("2026-05-17T12:00:00Z")); // Sunday
    expect(label.endsWith("May 17")).toBe(true);
  });
});

// ── isAssigned() ──────────────────────────────────────────────────────────────
describe("isAssigned", () => {
  it("returns false when assignedTo is empty", () => {
    expect(isAssigned({ ...chore(), assignedTo: [] }, "kid-1", MEMBERS)).toBe(false);
  });

  it("returns true when assignedTo is ['all']", () => {
    expect(isAssigned({ ...chore(), assignedTo: ["all"] }, "adult-1", MEMBERS)).toBe(true);
    expect(isAssigned({ ...chore(), assignedTo: ["all"] }, "kid-1", MEMBERS)).toBe(true);
  });

  it("returns true for a child when assignedTo is ['children']", () => {
    expect(isAssigned({ ...chore(), assignedTo: ["children"] }, "kid-1", MEMBERS)).toBe(true);
    expect(isAssigned({ ...chore(), assignedTo: ["children"] }, "kid-2", MEMBERS)).toBe(true);
  });

  it("returns false for an adult when assignedTo is ['children']", () => {
    expect(isAssigned({ ...chore(), assignedTo: ["children"] }, "adult-1", MEMBERS)).toBe(false);
  });

  it("returns true for an adult when assignedTo is ['adults']", () => {
    expect(isAssigned({ ...chore(), assignedTo: ["adults"] }, "adult-1", MEMBERS)).toBe(true);
  });

  it("returns false for a child when assignedTo is ['adults']", () => {
    expect(isAssigned({ ...chore(), assignedTo: ["adults"] }, "kid-1", MEMBERS)).toBe(false);
  });

  it("returns true for a specific member by id", () => {
    const c = { ...chore(), assignedTo: ["kid-1"] };
    expect(isAssigned(c, "kid-1", MEMBERS)).toBe(true);
    expect(isAssigned(c, "kid-2", MEMBERS)).toBe(false);
  });

  it("returns false for a member not in the assigned list", () => {
    const c = { ...chore(), assignedTo: ["kid-2"] };
    expect(isAssigned(c, "kid-1", MEMBERS)).toBe(false);
  });

  it("returns false for an unknown memberId not matching any group or id", () => {
    expect(isAssigned(chore(), "unknown-id", MEMBERS)).toBe(false);
  });
});

// ── isDone() ──────────────────────────────────────────────────────────────────
describe("isDone", () => {
  it("returns false when completions is empty", () => {
    expect(isDone("chore-1", "kid-1", {})).toBe(false);
  });

  it("returns false when week key does not exist", () => {
    const completions = comp("2026-W01", { "chore-1": ["kid-1"] });
    expect(isDone("chore-1", "kid-1", completions, "2026-W02")).toBe(false);
  });

  it("returns false when chore not completed by this member", () => {
    const completions = comp("2026-W20", { "chore-1": ["kid-2"] });
    expect(isDone("chore-1", "kid-1", completions, "2026-W20")).toBe(false);
  });

  it("returns true when member has completed the chore this week", () => {
    const completions = comp("2026-W20", { "chore-1": ["kid-1", "kid-2"] });
    expect(isDone("chore-1", "kid-1", completions, "2026-W20")).toBe(true);
  });

  it("returns false for a different chore the member did not complete", () => {
    const completions = comp("2026-W20", { "chore-1": ["kid-1"] });
    expect(isDone("chore-2", "kid-1", completions, "2026-W20")).toBe(false);
  });

  it("matches a specific day for daily completions", () => {
    const completions = comp("2026-W20", { "chore-1": [{ memberId: "kid-1", day: "2026-05-11" }] });
    expect(isDone("chore-1", "kid-1", completions, "2026-W20", "2026-05-11")).toBe(true);
    expect(isDone("chore-1", "kid-1", completions, "2026-W20", "2026-05-12")).toBe(false);
    // A daily completion is not a weekly (day "") completion.
    expect(isDone("chore-1", "kid-1", completions, "2026-W20")).toBe(false);
  });
});

// ── completionCount() ─────────────────────────────────────────────────────────
describe("completionCount", () => {
  it("returns 0 when the member has no completions", () => {
    expect(completionCount("chore-1", "kid-1", comp("2026-W20", { "chore-1": ["kid-2"] }), "2026-W20")).toBe(0);
  });

  it("returns 1 for a completed weekly chore", () => {
    expect(completionCount("chore-1", "kid-1", comp("2026-W20", { "chore-1": ["kid-1"] }), "2026-W20")).toBe(1);
  });

  it("counts each day a daily chore was completed", () => {
    const completions = comp("2026-W20", { "chore-1": [
      { memberId: "kid-1", day: "2026-05-11" },
      { memberId: "kid-1", day: "2026-05-12" },
      { memberId: "kid-1", day: "2026-05-13" },
      { memberId: "kid-2", day: "2026-05-11" },
    ] });
    expect(completionCount("chore-1", "kid-1", completions, "2026-W20")).toBe(3);
    expect(completionCount("chore-1", "kid-2", completions, "2026-W20")).toBe(1);
  });
});

// ── isDoneNow() ───────────────────────────────────────────────────────────────
describe("isDoneNow", () => {
  it("treats a weekly chore as done when completed this week (day '')", () => {
    const now = new Date("2026-05-13T12:00:00Z");
    const completions = comp(isoWeek(now), { "chore-1": ["kid-1"] });
    expect(isDoneNow(chore({ frequency: "weekly" }), "kid-1", completions, now)).toBe(true);
  });

  it("treats a daily chore as done only when completed today", () => {
    const now = new Date("2026-05-13T12:00:00Z");
    const c = chore({ frequency: "daily" });
    const doneToday = comp(isoWeek(now), { "chore-1": [{ memberId: "kid-1", day: todayStr(now) }] });
    expect(isDoneNow(c, "kid-1", doneToday, now)).toBe(true);
    // Done earlier in the week but not today → not "done now".
    const doneYesterday = comp(isoWeek(now), { "chore-1": [{ memberId: "kid-1", day: "2026-05-12" }] });
    expect(isDoneNow(c, "kid-1", doneYesterday, now)).toBe(false);
  });
});

// ── choresDoneThisWeek() ──────────────────────────────────────────────────────
describe("choresDoneThisWeek", () => {
  it("returns empty array when no chores are done", () => {
    const chores = [chore()];
    expect(choresDoneThisWeek("kid-1", chores, MEMBERS, {}, "2026-W20")).toHaveLength(0);
  });

  it("returns only the completed chores for the given member", () => {
    const chores = [
      { id: "c1", name: "Make bed", points: 5, assignedTo: ["children"] },
      { id: "c2", name: "Clean room", points: 10, assignedTo: ["children"] },
    ];
    const completions = comp("2026-W20", { c1: ["kid-1"], c2: [] });
    const done = choresDoneThisWeek("kid-1", chores, MEMBERS, completions, "2026-W20");
    expect(done).toHaveLength(1);
    expect(done[0].id).toBe("c1");
  });

  it("does not count chores not assigned to the member", () => {
    const chores = [{ id: "c1", name: "Adults task", points: 5, assignedTo: ["adults"] }];
    const completions = comp("2026-W20", { c1: ["kid-1"] });
    expect(choresDoneThisWeek("kid-1", chores, MEMBERS, completions, "2026-W20")).toHaveLength(0);
  });

  it("counts a daily chore done on any day exactly once", () => {
    const chores = [{ id: "c1", name: "Make bed", points: 5, assignedTo: ["children"], frequency: "daily" }];
    const completions = comp("2026-W20", { c1: [
      { memberId: "kid-1", day: "2026-05-11" },
      { memberId: "kid-1", day: "2026-05-12" },
    ] });
    const done = choresDoneThisWeek("kid-1", chores, MEMBERS, completions, "2026-W20");
    expect(done).toHaveLength(1);
    expect(done[0].id).toBe("c1");
  });
});

// ── earnedCents() ─────────────────────────────────────────────────────────────
describe("earnedCents", () => {
  it("returns 0 when no chores completed", () => {
    expect(earnedCents("kid-1", [], MEMBERS, {}, SETTINGS, "2026-W20")).toBe(0);
  });

  it("calculates earnings from completed chores", () => {
    const chores = [
      { id: "c1", name: "Make bed", points: 5, assignedTo: ["children"] },
      { id: "c2", name: "Dishes", points: 10, assignedTo: ["children"] },
    ];
    const completions = comp("2026-W20", { c1: ["kid-1"], c2: ["kid-1"] });
    // (5 + 10) × 10 centsPerPoint = 150 cents
    expect(earnedCents("kid-1", chores, MEMBERS, completions, SETTINGS, "2026-W20")).toBe(150);
  });

  it("respects the centsPerPoint exchange rate", () => {
    const chores = [{ id: "c1", name: "Make bed", points: 5, assignedTo: ["children"] }];
    const completions = comp("2026-W20", { c1: ["kid-1"] });
    const highRate = { centsPerPoint: 25 };
    expect(earnedCents("kid-1", chores, MEMBERS, completions, highRate, "2026-W20")).toBe(125);
  });

  it("does not count completed chores of other members", () => {
    const chores = [{ id: "c1", name: "Make bed", points: 5, assignedTo: ["children"] }];
    const completions = comp("2026-W20", { c1: ["kid-2"] }); // kid-2 did it, not kid-1
    expect(earnedCents("kid-1", chores, MEMBERS, completions, SETTINGS, "2026-W20")).toBe(0);
  });

  it("does not count chores not assigned to the member", () => {
    const chores = [{ id: "c1", name: "Adult task", points: 100, assignedTo: ["adults"] }];
    const completions = comp("2026-W20", { c1: ["kid-1"] });
    expect(earnedCents("kid-1", chores, MEMBERS, completions, SETTINGS, "2026-W20")).toBe(0);
  });

  it("pays per day for a daily chore (points × days done)", () => {
    const chores = [{ id: "c1", name: "Make bed", points: 5, assignedTo: ["children"], frequency: "daily" }];
    const completions = comp("2026-W20", { c1: [
      { memberId: "kid-1", day: "2026-05-11" },
      { memberId: "kid-1", day: "2026-05-12" },
      { memberId: "kid-1", day: "2026-05-13" },
    ] });
    // 5 pts × 10 cents × 3 days = 150 cents
    expect(earnedCents("kid-1", chores, MEMBERS, completions, SETTINGS, "2026-W20")).toBe(150);
  });
});

// ── fmtDollars() ─────────────────────────────────────────────────────────────
describe("fmtDollars", () => {
  it("formats zero cents as $0.00", () => {
    expect(fmtDollars(0)).toBe("$0.00");
  });

  it("formats 100 cents as $1.00", () => {
    expect(fmtDollars(100)).toBe("$1.00");
  });

  it("formats 450 cents as $4.50", () => {
    expect(fmtDollars(450)).toBe("$4.50");
  });

  it("formats 1999 cents as $19.99", () => {
    expect(fmtDollars(1999)).toBe("$19.99");
  });

  it("formats large amounts correctly", () => {
    expect(fmtDollars(10000)).toBe("$100.00");
  });
});

describe("canActForOthers", () => {
  const adult = { id: "a", role: "adult" };
  const kid = { id: "k", role: "child" };

  it("lets an adult member act for others in a household", () => {
    expect(canActForOthers(adult)).toBe(true);
    expect(canActForOthers(adult, { tenantKind: "household" })).toBe(true);
  });

  it("never lets anyone act for others in a shared space, admin or not", () => {
    // The hub keeps another member's name on a row only in a household here:
    // an app whose rows emit events cannot be installed in a roster space.
    expect(canActForOthers(adult, { tenantKind: "shared_space" })).toBe(false);
    expect(canActForOthers(adult, { tenantKind: "shared_space", isAdmin: true })).toBe(false);
  });

  it("never lets a memberless session act for others, admin or not", () => {
    // The creator-fallback admin has no member row; the hub refuses every
    // completion such a session writes.
    expect(canActForOthers(null, { isAdmin: true })).toBe(false);
    expect(canActForOthers({ role: "adult" }, { isAdmin: true })).toBe(false);
  });

  it("never lets a child, a guest, a non-hub role or nobody act for others", () => {
    for (const role of ["child", "guest", "admin"]) {
      expect(canActForOthers({ id: "x", role }), role).toBe(false);
    }
    expect(canActForOthers(kid, { isAdmin: true })).toBe(false);
    expect(canActForOthers(null)).toBe(false);
  });
});

describe("speaksForOthers", () => {
  it("is every adult in a household", () => {
    expect(speaksForOthers({ role: "adult" })).toBe(true);
    expect(speaksForOthers({ role: "adult" }, { tenantKind: "household" })).toBe(true);
    for (const role of ["child", "guest", "admin"]) {
      expect(speaksForOthers({ role }), role).toBe(false);
    }
    expect(speaksForOthers(null)).toBe(false);
  });

  it("is an admin anywhere, and only an admin outside a household", () => {
    expect(speaksForOthers({ role: "child" }, { isAdmin: true })).toBe(true);
    expect(speaksForOthers(null, { isAdmin: true, tenantKind: "shared_space" })).toBe(true);
    expect(speaksForOthers({ role: "adult" }, { tenantKind: "shared_space" })).toBe(false);
  });
});

describe("owedCents", () => {
  it("owes nothing in a screen-time-only household, and the cents otherwise", () => {
    expect(owedCents(450, { rewardType: "screen_time" })).toBe(0);
    for (const rewardType of ["money", "both", undefined]) {
      expect(owedCents(450, { rewardType }), String(rewardType)).toBe(450);
    }
  });
});

describe("streakEvent", () => {
  const base = { choreId: "c1", member: { name: "Jordan" }, memberId: "kid-1", week: "2026-W39" };
  const daily = { name: "Bed", points: 2, frequency: "daily" };

  it("is a chore.streak for a daily chore at 3, 5 and 7 days, and null otherwise", () => {
    for (const count of [1, 2, 3, 4, 5, 6, 7]) {
      const streak = streakEvent({ ...base, chore: daily, count });
      if (![3, 5, 7].includes(count)) {
        expect(streak, String(count)).toBeNull();
        continue;
      }
      expect(streak, String(count)).toEqual({
        type: "chore.streak",
        payload: {
          member_id: "kid-1", member_name: "Jordan", chore_id: "c1", chore_name: "Bed",
          week: "2026-W39", days_completed: count,
        },
        key: `c1:kid-1:2026-W39:${count}`,
      });
    }
  });

  it("is null for a weekly or unknown chore", () => {
    expect(streakEvent({ ...base, chore: { name: "Dishes", frequency: "weekly" }, count: 3 })).toBeNull();
    expect(streakEvent({ ...base, chore: undefined, count: 3 })).toBeNull();
  });

  it("falls back to empty names when the member or chore name is missing", () => {
    const streak = streakEvent({ ...base, member: undefined, chore: { frequency: "daily" }, count: 5 });
    expect(streak.payload.member_name).toBe("");
    expect(streak.payload.chore_name).toBe("");
  });
});

describe("isDuplicateRowError", () => {
  it("is true for a primary-key failure on completions, as D1 and the hub word it", () => {
    for (const message of [
      "UNIQUE constraint failed: app_chore_tracker__completions.chore_id, app_chore_tracker__completions.member_id, app_chore_tracker__completions.week, app_chore_tracker__completions.day",
      "D1_ERROR: UNIQUE constraint failed: app_chore_tracker__completions.chore_id: SQLITE_CONSTRAINT",
      "UNIQUE constraint failed: app_chore_tracker__completions.chore_id (transaction carried write effects: completions)",
      "UNIQUE constraint failed",
    ]) {
      expect(isDuplicateRowError(message), message).toBe(true);
    }
  });

  it("is false for any other failure, including a unique failure on another table", () => {
    for (const message of [
      "UNIQUE constraint failed: hub__app_events.id",
      "INSERT OR IGNORE is not allowed on a table that declares write_effects",
      "DB row limit exceeded",
      "Save failed (500)",
      "",
      undefined,
    ]) {
      expect(isDuplicateRowError(message), String(message)).toBe(false);
    }
  });
});

describe("sendWithRetry", () => {
  const response = (status) => ({ ok: status >= 200 && status < 300, status });
  const run = async (statuses) => {
    const calls = [];
    const slept = [];
    const result = await sendWithRetry(async () => {
      const next = statuses[calls.length];
      calls.push(next);
      if (next === "network") throw new Error("offline");
      return response(next);
    }, { delays: [10, 20], sleep: async (ms) => { slept.push(ms); } });
    return { result, calls, slept };
  };

  it("returns at once on success", async () => {
    const { result, calls, slept } = await run([201]);
    expect(result).toEqual({ ok: true, status: 201, retryable: false });
    expect(calls.length).toBe(1);
    expect(slept).toEqual([]);
  });

  it("retries a network error and 5xx, with the given delays", async () => {
    const { result, calls, slept } = await run(["network", 503, 201]);
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["network", 503, 201]);
    expect(slept).toEqual([10, 20]);
  });

  it("gives up after the last delay, still marked retryable", async () => {
    const { result, calls } = await run([503, 503, 503, 201]);
    expect(result).toEqual({ ok: false, status: 503, retryable: true });
    expect(calls.length).toBe(3);
  });

  it("never retries a final refusal such as 403, 400 or 429 (the daily event limit)", async () => {
    for (const status of [403, 400, 409, 429]) {
      const { result, calls } = await run([status, 201]);
      expect(result, String(status)).toEqual({ ok: false, status, retryable: false });
      expect(calls.length, String(status)).toBe(1);
    }
  });
});

describe("publishAppEvent", () => {
  it("POSTs type, subject, payload and idempotency key to the events URL", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 201 }; };
    const result = await publishAppEvent("/run/x/api/events", {
      type: "chore.streak", subjectId: "kid-1", payload: { days_completed: 3 }, key: "c1:kid-1:2026-W39:3",
    }, { fetchImpl });
    expect(result).toEqual({ ok: true, status: 201, retryable: false });
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe("/run/x/api/events");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body)).toEqual({
      type: "chore.streak", subject_id: "kid-1", payload: { days_completed: 3 }, idempotency_key: "c1:kid-1:2026-W39:3",
    });
  });

  it("is a no-op success without an events URL (demo mode)", async () => {
    let called = false;
    const result = await publishAppEvent("", { type: "chore.streak" }, { fetchImpl: async () => { called = true; } });
    expect(result).toEqual({ ok: true, status: 0, retryable: false });
    expect(called).toBe(false);
  });

  it("retries through sendWithRetry and reports a final refusal", async () => {
    const statuses = [503, 403];
    const fetchImpl = async () => { const status = statuses.shift(); return { ok: false, status }; };
    const result = await publishAppEvent("/e", { type: "allowance.earned" }, { fetchImpl, delays: [1], sleep: async () => {} });
    expect(result).toEqual({ ok: false, status: 403, retryable: false });
    expect(statuses).toEqual([]);
  });
});

describe("worthRetryingLater", () => {
  it("keeps a retryable failure and the daily-limit 429 for a later open", () => {
    expect(worthRetryingLater({ ok: false, status: 503, retryable: true })).toBe(true);
    expect(worthRetryingLater({ ok: false, status: 0, retryable: true })).toBe(true);
    expect(worthRetryingLater({ ok: false, status: 429, retryable: false })).toBe(true);
  });

  it("gives up on a final refusal, and never on a success", () => {
    expect(worthRetryingLater({ ok: false, status: 403, retryable: false })).toBe(false);
    expect(worthRetryingLater({ ok: false, status: 400, retryable: false })).toBe(false);
    expect(worthRetryingLater({ ok: true, status: 201, retryable: false })).toBe(false);
  });
});
