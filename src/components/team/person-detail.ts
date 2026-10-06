/**
 * Shape of GET {PUBLIC_PORTAL_URL}/api/public/progress/people/{id}: one
 * person of the public progress feed (`id` = their `people[].id`), with
 * their weekly throughput and the checklist items they finished.
 *
 *   { enabled: true, updatedAt, since,
 *     person: { …same fields as a people[] entry },
 *     weekly: [{ weekStart, itemsDone }],          // same weeks as the team feed
 *     done:   [{ title, subteam, at, withTask }] } // newest first, at most 25
 *
 * `title` is null when the portal hides task titles; `withTask` = counted
 * when the whole task was marked finished. The portal answers a JSON 404
 * for anyone it doesn't show (progress or profiles off, names hidden, hidden
 * people…), without saying which: `personDetailFetcher` turns that into
 * `{ enabled: false }` ("not public"), which is final — no retrying.
 *
 * Pure module, so tests/team.test.mjs can load it with type stripping.
 */
import {
    day,
    isObj,
    isoDate,
    list,
    PORTAL_ID_RE,
    PortalHttpError,
    text,
} from "../../lib/portal-json.ts";
import {
    MAX_WEEKS,
    parseProgressPerson,
    type ProgressPerson,
    type ProgressWeek,
} from "../progress/types.ts";

export interface PersonDone {
    /** null when the portal hides task titles. */
    title: string | null;
    subteam: string | null;
    at: string;
    /** Counted when the whole task was marked finished. */
    withTask: boolean;
}

export interface PersonDetailEnabled {
    enabled: true;
    updatedAt: string;
    /** YYYY-MM-DD, "" when missing. */
    since: string;
    person: ProgressPerson;
    weekly: ProgressWeek[];
    done: PersonDone[];
}

export type PersonDetailPayload = PersonDetailEnabled | { enabled: false };

/** Most finished items the portal sends (and the page keeps). */
export const MAX_DONE = 25;

/**
 * Statuses that mean "this person isn't public" rather than an outage: the
 * portal's deliberate 404 (also 410), and 401/403 from a portal that doesn't
 * have the per-person endpoint at all. Retrying won't change them.
 */
export const NOT_PUBLIC_STATUSES: readonly number[] = [401, 403, 404, 410];

/**
 * Wraps the per-person fetcher: a "not public" status answers
 * `{ enabled: false }` (shown as "not on the website", polling stops);
 * network errors and 5xx still throw (shown as "couldn't load", retried).
 */
export function personDetailFetcher(
    fetchJson: (signal: AbortSignal) => Promise<unknown>,
): (signal: AbortSignal) => Promise<unknown> {
    return async (signal) => {
        try {
            return await fetchJson(signal);
        } catch (e) {
            if (e instanceof PortalHttpError && NOT_PUBLIC_STATUSES.includes(e.status)) {
                return { enabled: false };
            }
            throw e;
        }
    };
}

/** The endpoint path for a public person id, or null for an unsafe id. */
export function personDetailPath(id: string): string | null {
    return PORTAL_ID_RE.test(id)
        ? `/api/public/progress/people/${encodeURIComponent(id)}`
        : null;
}

/**
 * Validates the per-person answer. Null when unusable, including an answer
 * about someone else than `expectedId`.
 */
export function parsePersonDetail(
    raw: unknown,
    expectedId?: string,
): PersonDetailPayload | null {
    if (!isObj(raw)) return null;
    if (raw.enabled === false) return { enabled: false };
    if (raw.enabled !== true) return null;
    const person = parseProgressPerson(raw.person);
    if (!person) return null;
    if (expectedId !== undefined && person.id !== expectedId) return null;

    const weekly: ProgressWeek[] = [];
    const seenWeeks = new Set<string>();
    for (const w of list(raw.weekly).slice(0, 100)) {
        if (!isObj(w)) continue;
        const weekStart = day(w.weekStart);
        if (!weekStart || seenWeeks.has(weekStart)) continue;
        seenWeeks.add(weekStart);
        const n = w.itemsDone;
        weekly.push({
            weekStart,
            itemsDone:
                typeof n === "number" && Number.isFinite(n) && n > 0
                    ? Math.floor(n)
                    : 0,
        });
    }
    weekly.sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    const done: PersonDone[] = [];
    for (const d of list(raw.done).slice(0, 200)) {
        if (!isObj(d)) continue;
        const at = isoDate(d.at);
        if (!at) continue;
        done.push({
            title: text(d.title, 200),
            subteam: text(d.subteam, 40),
            at,
            withTask: d.withTask === true,
        });
    }
    done.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

    return {
        enabled: true,
        updatedAt: isoDate(raw.updatedAt) ?? new Date().toISOString(),
        since: day(raw.since) ?? "",
        person,
        weekly: weekly.slice(-MAX_WEEKS),
        done: done.slice(0, MAX_DONE),
    };
}
