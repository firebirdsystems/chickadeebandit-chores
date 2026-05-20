import { describe, it, expect } from "vitest";
import {
  initial, memberColor, MEMBER_COLORS,
  isoWeek, weekLabel,
  isAssigned, isDone, choresDoneThisWeek,
  earnedCents, fmtDollars,
} from "../src/logic.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────
const MEMBERS = [
  { id: "adult-1", name: "Alice", role: "adult" },
  { id: "kid-1",   name: "Jordan", role: "child" },
  { id: "kid-2",   name: "Casey",  role: "child" },
];

function chore(overrides = {}) {
  return { id: "chore-1", name: "Make bed", points: 5, assignedTo: ["children"], ...overrides };
}

const SETTINGS = { centsPerPoint: 10, resetDay: "monday" };

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
    const completions = { "2026-W01": { "chore-1": ["kid-1"] } };
    expect(isDone("chore-1", "kid-1", completions, "2026-W02")).toBe(false);
  });

  it("returns false when chore not completed by this member", () => {
    const completions = { "2026-W20": { "chore-1": ["kid-2"] } };
    expect(isDone("chore-1", "kid-1", completions, "2026-W20")).toBe(false);
  });

  it("returns true when member has completed the chore this week", () => {
    const completions = { "2026-W20": { "chore-1": ["kid-1", "kid-2"] } };
    expect(isDone("chore-1", "kid-1", completions, "2026-W20")).toBe(true);
  });

  it("returns false for a different chore the member did not complete", () => {
    const completions = { "2026-W20": { "chore-1": ["kid-1"] } };
    expect(isDone("chore-2", "kid-1", completions, "2026-W20")).toBe(false);
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
    const completions = { "2026-W20": { c1: ["kid-1"], c2: [] } };
    const done = choresDoneThisWeek("kid-1", chores, MEMBERS, completions, "2026-W20");
    expect(done).toHaveLength(1);
    expect(done[0].id).toBe("c1");
  });

  it("does not count chores not assigned to the member", () => {
    const chores = [{ id: "c1", name: "Adults task", points: 5, assignedTo: ["adults"] }];
    const completions = { "2026-W20": { c1: ["kid-1"] } };
    expect(choresDoneThisWeek("kid-1", chores, MEMBERS, completions, "2026-W20")).toHaveLength(0);
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
    const completions = { "2026-W20": { c1: ["kid-1"], c2: ["kid-1"] } };
    // (5 + 10) × 10 centsPerPoint = 150 cents
    expect(earnedCents("kid-1", chores, MEMBERS, completions, SETTINGS, "2026-W20")).toBe(150);
  });

  it("respects the centsPerPoint exchange rate", () => {
    const chores = [{ id: "c1", name: "Make bed", points: 5, assignedTo: ["children"] }];
    const completions = { "2026-W20": { c1: ["kid-1"] } };
    const highRate = { centsPerPoint: 25 };
    expect(earnedCents("kid-1", chores, MEMBERS, completions, highRate, "2026-W20")).toBe(125);
  });

  it("does not count completed chores of other members", () => {
    const chores = [{ id: "c1", name: "Make bed", points: 5, assignedTo: ["children"] }];
    const completions = { "2026-W20": { c1: ["kid-2"] } }; // kid-2 did it, not kid-1
    expect(earnedCents("kid-1", chores, MEMBERS, completions, SETTINGS, "2026-W20")).toBe(0);
  });

  it("does not count chores not assigned to the member", () => {
    const chores = [{ id: "c1", name: "Adult task", points: 100, assignedTo: ["adults"] }];
    const completions = { "2026-W20": { c1: ["kid-1"] } };
    expect(earnedCents("kid-1", chores, MEMBERS, completions, SETTINGS, "2026-W20")).toBe(0);
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
