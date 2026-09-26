/**
 * Pure business logic for the Chores & Allowance app.
 * No DOM, and no global fetch: the one network helper (publishAppEvent) takes
 * its fetch as an argument — importable in both browser and test environments.
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
/**
 * DEVICE-local, not household-local. The UI no longer calls this — every date
 * that is STORED or COMPARED goes through the SDK's hubToday(), which names the
 * HOUSEHOLD's calendar day and so agrees with the hub's own surfaces (glance,
 * kiosk, cron, `:today` in declared SQL). Kept because it is pure and tested,
 * and still fine for presentation. Do not reach for it to build a date you are
 * about to write or compare against a stored one.
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

/**
 * Whether the signed-in member speaks for others in the hub's EVENT LOG, which
 * scopes an idempotency key to the member it names: an admin anywhere, and in
 * a household every adult. Mirrors the hub's speaksForOthers. Two such
 * publishers sending the same keyed event for one child store ONE event, so
 * only they should send per-child events that several adults might send at
 * once (the weekly allowance).
 */
export function speaksForOthers(member, { isAdmin = false, tenantKind = "household" } = {}) {
  if (isAdmin) return true;
  return tenantKind === "household" && member?.role === "adult";
}

/**
 * Whether the signed-in member may record chores for someone else. Mirrors the
 * hub's rule for whose name a completion row keeps (supervisor_assigns_owner):
 * an adult member of a household. In a shared space the hub writes the row
 * under the recorder's own id, so the child would get nothing. (Roster spaces,
 * where a steward supervises, cannot install an app whose rows emit events.)
 */
export function canActForOthers(member, { tenantKind = "household" } = {}) {
  // A MEMBER, always: the creator-fallback admin session has no member row,
  // so the hub refuses every completion it writes, for anyone.
  if (!member?.id) return false;
  return tenantKind === "household" && member.role === "adult";
}

/**
 * Sends a request, retrying only failures that can succeed on a retry: a
 * network error or a 5xx. Any other status is final, 429 included: the hub's
 * 429 on /api/events is the daily event limit, which no retry in seconds
 * clears. Safe for keyed events: a retry of the same idempotency key is the
 * same stored event. `send` returns a fetch Response (or throws).
 * Resolves { ok, status, retryable }.
 */
export async function sendWithRetry(send, {
  delays = [500, 2000],
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  let last = { ok: false, status: 0, retryable: true };
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) await sleep(delays[attempt - 1]);
    let status = 0;
    try {
      const res = await send();
      status = res.status;
      if (res.ok) return { ok: true, status, retryable: false };
    } catch {
      status = 0;
    }
    const retryable = status === 0 || status >= 500;
    last = { ok: false, status, retryable };
    if (!retryable) break;
  }
  return last;
}

/**
 * Whether a failed send is worth trying again on a LATER open, as opposed to
 * immediately: a retryable failure, or a 429 (the hub's daily event limit,
 * which resets). Only another refusal (400, 403) is final. The weekly summary
 * keeps its week open on these, so a spent quota delays an allowance rather
 * than dropping it.
 */
export function worthRetryingLater(result) {
  return !result.ok && (result.retryable || result.status === 429);
}

/**
 * POSTs one app event to the hub's events endpoint, with sendWithRetry.
 * `key` is the idempotency key naming the fact, so a resend is the same
 * stored event. No `eventsUrl` (demo mode) is a no-op success.
 * Resolves { ok, status, retryable }.
 */
export function publishAppEvent(eventsUrl, { type, subjectId, payload = {}, key }, {
  fetchImpl = (...args) => fetch(...args),
  ...retry
} = {}) {
  if (!eventsUrl) return Promise.resolve({ ok: true, status: 0, retryable: false });
  return sendWithRetry(() => fetchImpl(eventsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, subject_id: subjectId, payload, idempotency_key: key }),
  }), retry);
}

/**
 * The money a week's chores earned, in cents. A screen-time-only household
 * earns no money: `cents` is then only the basis minutes are computed from,
 * and Piggy Bank deposits whatever `cents_earned` says.
 */
export function owedCents(cents, settings) {
  return settings?.rewardType === "screen_time" ? 0 : cents;
}

/**
 * The `chore.streak` a completion earns, or null: only a daily chore, and only
 * when it reaches 3, 5 or 7 days this week. Shared by the app and its widget so
 * a tick means the same thing wherever it happens. `count` is this week's
 * completions of the chore by the member, including this one. The key names
 * the milestone, so a tick, untick and re-tick announces it once.
 */
export function streakEvent({ chore, choreId, member, memberId, week, count }) {
  if (chore?.frequency !== "daily" || ![3, 5, 7].includes(count)) return null;
  return {
    type: "chore.streak",
    payload: {
      member_id: memberId,
      member_name: member?.name ?? "",
      chore_id: choreId,
      chore_name: chore?.name ?? "",
      week,
      days_completed: count,
    },
    key: `${choreId}:${memberId}:${week}:${count}`,
  };
}

/**
 * Whether a failed completion INSERT failed only because the row already
 * exists (checked on another device, or a double tap). The hub refuses
 * `INSERT OR IGNORE` and `ON CONFLICT` on a table whose rows emit events, so a
 * plain INSERT's primary-key error is how "already checked" arrives. A message
 * naming a different table is a real failure.
 */
export function isDuplicateRowError(message, table = "completions") {
  const match = /UNIQUE constraint failed(?::\s*([A-Za-z0-9_]+)\.)?/i.exec(String(message ?? ""));
  if (!match) return false;
  const failed = match[1];
  return !failed || failed === table || failed.endsWith(`__${table}`);
}
