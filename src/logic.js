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
 * Returns true if the member has completed this chore in the given week.
 * @param {string} choreId
 * @param {string} memberId
 * @param {Record<string, Record<string, string[]>>} completions  - { week: { choreId: [memberId] } }
 * @param {string} week - ISO week string, defaults to current week
 */
export function isDone(choreId, memberId, completions, week = isoWeek()) {
  return (completions[week]?.[choreId] ?? []).includes(memberId);
}

/**
 * Returns chores assigned to a member and completed in the given week.
 */
export function choresDoneThisWeek(memberId, chores, members, completions, week = isoWeek()) {
  return chores.filter(c =>
    isAssigned(c, memberId, members) && isDone(c.id, memberId, completions, week)
  );
}

/**
 * Total cents earned by a member for a given week.
 * earnedCents = sum(completedChore.points × settings.centsPerPoint)
 */
export function earnedCents(memberId, chores, members, completions, settings, week = isoWeek()) {
  return choresDoneThisWeek(memberId, chores, members, completions, week)
    .reduce((sum, c) => sum + c.points * settings.centsPerPoint, 0);
}

/**
 * Formats cents as a dollar string: 450 → "$4.50"
 */
export function fmtDollars(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}
