/**
 * Pure business logic for the Chores & Allowance app.
 * No DOM, no fetch — importable in both browser and test environments.
 */

// Shared utilities — sourced from shared.js (mirrors hub-sdk.js) for testability.
export { AVATAR_COLORS, MEMBER_COLORS, memberColor, initial, esc, isAdult, formatRelativeDate } from "./shared.js";

/**
 * ISO 8601 week string ("YYYY-WNN") for a given date.
 * Week 1 is the week containing the first Thursday of the year (ISO standard).
 */
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Human-readable week range label, e.g. "May 11 – May 17".
 */
export function weekLabel(date = new Date()) {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

/**
 * Returns true if the chore is assigned to the given member.
 * assignedTo can contain: "all", "children", "adults", or specific member IDs.
 */
export function isAssigned(chore, memberId, members) {
  const { assignedTo } = chore;
  if (!assignedTo || assignedTo.length === 0) return false;
  if (assignedTo.includes("all")) return true;
  const member = members.find(m => m.id === memberId);
  if (assignedTo.includes("children") && member?.role === "child") return true;
  if (assignedTo.includes("adults") && member?.role === "adult") return true;
  return assignedTo.includes(memberId);
}

/**
 * Returns the ISO week string for the week before the given date.
 */
export function getPreviousIsoWeek(date = new Date()) {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 7);
  return isoWeek(prev);
}

/**
 * Returns the week range label (e.g. "May 11 – May 17") for the previous week.
 */
export function previousWeekLabel(date = new Date()) {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 7);
  return weekLabel(prev);
}

/**
 * Local calendar date as "YYYY-MM-DD" — the per-day key for daily chores.
 * (Local, not UTC, so "today" matches the family's wall clock.)
 */
export function todayStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * The seven "YYYY-MM-DD" dates (Mon→Sun) of the week containing `date`.
 * Used to render the daily-chore streak dots.
 */
export function weekDates(date = new Date()) {
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return [...Array(7)].map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return todayStr(d);
  });
}

/**
 * Completion entries for one member + chore in a week.
 * @param {Record<string, Record<string, Array<{memberId:string, day:string}>>>} completions
 *        - { week: { choreId: [{ memberId, day }] } }. `day` is "" for weekly
 *          chores, or a "YYYY-MM-DD" string for daily chores.
 */
function entriesFor(choreId, memberId, completions, week) {
  return (completions[week]?.[choreId] ?? []).filter(e => e.memberId === memberId);
}

/**
 * Returns true if the member completed this chore on the given `day`.
 * Weekly chores use day "" (the default), so the legacy "done this week"
 * meaning is preserved; daily chores pass a specific "YYYY-MM-DD".
 */
export function isDone(choreId, memberId, completions, week = isoWeek(), day = "") {
  return entriesFor(choreId, memberId, completions, week).some(e => e.day === day);
}

/**
 * Number of times the member completed this chore in the week.
 * Weekly: 0 or 1. Daily: 0–7 (one per day done).
 */
export function completionCount(choreId, memberId, completions, week = isoWeek()) {
  return entriesFor(choreId, memberId, completions, week).length;
}

/**
 * "Is this chore done right now?" — today for daily chores, this week for
 * weekly chores. This is what the checklist tick and admin pills reflect.
 */
export function isDoneNow(chore, memberId, completions, now = new Date()) {
  const day = chore.frequency === "daily" ? todayStr(now) : "";
  return isDone(chore.id, memberId, completions, isoWeek(now), day);
}

/**
 * Returns chores assigned to a member and completed at least once in the week.
 */
export function choresDoneThisWeek(memberId, chores, members, completions, week = isoWeek()) {
  return chores.filter(c =>
    isAssigned(c, memberId, members) && completionCount(c.id, memberId, completions, week) > 0
  );
}

/**
 * Total cents earned by a member for a given week.
 * Per-day scoring: a chore earns its points once per completion, so a daily
 * chore done N days earns points × N. Weekly chores earn points once.
 */
export function earnedCents(memberId, chores, members, completions, settings, week = isoWeek()) {
  return chores
    .filter(c => isAssigned(c, memberId, members))
    .reduce((sum, c) =>
      sum + c.points * settings.centsPerPoint * completionCount(c.id, memberId, completions, week), 0);
}

/**
 * Formats cents as a dollar string: 450 → "$4.50"
 */
export function fmtDollars(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}
