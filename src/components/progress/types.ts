/**
 * Shape of GET {PUBLIC_PORTAL_URL}/api/public/progress, the public, read-only
 * progress feed served by the Huskyteers Teammate Portal.
 *
 * The page never trusts the payload: `parseProgress` validates and normalises
 * it, dropping anything malformed instead of crashing the island.
 */

export type SubteamKey = "SOFTWARE" | "BUILD" | "BUSINESS";

export interface ProgressTotals {
    itemsDone: number;
    itemsOpen: number;
    /** Of itemsOpen: checked off, waiting for a leader's review. */
    itemsSubmitted: number;
    /** 0-100, integer. */
    completion: number;
    doneLast7Days: number;
    tasksFinished: number;
    tasksActive: number;
    people: number;
}

export interface ProgressSubteam {
    key: string;
    name: string;
    itemsDone: number;
    itemsOpen: number;
    /** Of itemsOpen: checked off, waiting for review. */
    itemsSubmitted: number;
    completion: number;
    doneLast7Days: number;
    tasksActive: number;
    people: number;
}

export interface ProgressPerson {
    /** Opaque, stable id (never a database id). */
    id: string;
    name: string;
    subteam: string | null;
    role: string;
    itemsDone: number;
    itemsOpen: number;
    /** Of itemsOpen: checked off, waiting for review. */
    itemsSubmitted: number;
    completion: number;
    doneLast7Days: number;
    lastDoneAt: string | null;
}

export interface ProgressRecent {
    /** null when the portal hides task titles. */
    title: string | null;
    subteam: string | null;
    /** null when the portal hides names. */
    who: string | null;
    at: string;
}

export interface ProgressWeek {
    /** Monday, YYYY-MM-DD, team timezone. */
    weekStart: string;
    itemsDone: number;
}

export interface ProgressEnabled {
    enabled: true;
    team: { name: string; number: number };
    /** YYYY-MM-DD */
    since: string;
    updatedAt: string;
    totals: ProgressTotals;
    subteams: ProgressSubteam[];
    people: ProgressPerson[];
    recent: ProgressRecent[];
    weekly: ProgressWeek[];
}

export interface ProgressDisabled {
    enabled: false;
}

export type ProgressPayload = ProgressEnabled | ProgressDisabled;

/** Most people / subteams / feed rows / weeks kept from one payload. */
export const MAX_PEOPLE = 300;
export const MAX_SUBTEAMS = 6;
export const MAX_RECENT = 15;
export const MAX_WEEKS = 8;
/** Larger responses are refused before parsing (the real one is a few KB). */
export const MAX_PAYLOAD_CHARS = 1_000_000;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj =>
    typeof v === "object" && v !== null && !Array.isArray(v);

const count = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

const percent = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v)
        ? Math.min(100, Math.max(0, Math.round(v)))
        : 0;

const text = (v: unknown, max = 160): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
};

const isoDate = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    return Number.isNaN(Date.parse(v)) ? null : v;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (v: unknown): string | null =>
    typeof v === "string" && DAY.test(v) ? v : null;

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Waiting for review is part of open: never more than it. */
const submitted = (v: unknown, open: number): number =>
    Math.min(count(v), open);

/**
 * One entry of `people` (also the `person` of the per-person answer,
 * GET /api/public/progress/people/{id}). Null without an id or a name.
 */
export function parseProgressPerson(p: unknown): ProgressPerson | null {
    if (!isObj(p)) return null;
    const id = text(p.id, 128);
    const name = text(p.name, 80);
    if (!id || !name) return null;
    const itemsOpen = count(p.itemsOpen);
    return {
        id,
        name,
        subteam: text(p.subteam, 40),
        role: text(p.role, 60) ?? "",
        itemsDone: count(p.itemsDone),
        itemsOpen,
        itemsSubmitted: submitted(p.itemsSubmitted, itemsOpen),
        completion: percent(p.completion),
        doneLast7Days: count(p.doneLast7Days),
        lastDoneAt: isoDate(p.lastDoneAt),
    };
}

/**
 * Validates an unknown JSON value against the public progress contract.
 * Returns null when the payload is unusable (wrong shape entirely).
 */
export function parseProgress(raw: unknown): ProgressPayload | null {
    if (!isObj(raw)) return null;
    if (raw.enabled === false) return { enabled: false };
    if (raw.enabled !== true || !isObj(raw.totals)) return null;

    const team = isObj(raw.team) ? raw.team : {};
    const totals = raw.totals;

    const subteams: ProgressSubteam[] = [];
    const seenKeys = new Set<string>();
    for (const s of list(raw.subteams)) {
        if (subteams.length >= MAX_SUBTEAMS) break;
        if (!isObj(s)) continue;
        const key = text(s.key, 40);
        if (!key || seenKeys.has(key)) continue;
        seenKeys.add(key);
        const itemsOpen = count(s.itemsOpen);
        subteams.push({
            key,
            name: text(s.name, 60) ?? key,
            itemsDone: count(s.itemsDone),
            itemsOpen,
            itemsSubmitted: submitted(s.itemsSubmitted, itemsOpen),
            completion: percent(s.completion),
            doneLast7Days: count(s.doneLast7Days),
            tasksActive: count(s.tasksActive),
            people: count(s.people),
        });
    }

    const seenIds = new Set<string>();
    const people: ProgressPerson[] = [];
    for (const entry of list(raw.people)) {
        if (people.length >= MAX_PEOPLE) break;
        const p = parseProgressPerson(entry);
        if (!p || seenIds.has(p.id)) continue;
        seenIds.add(p.id);
        people.push(p);
    }

    const recent: ProgressRecent[] = [];
    for (const r of list(raw.recent).slice(0, 100)) {
        if (!isObj(r)) continue;
        const at = isoDate(r.at);
        if (!at) continue;
        recent.push({
            title: text(r.title, 200),
            subteam: text(r.subteam, 40),
            who: text(r.who, 80),
            at,
        });
    }
    recent.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

    const weekly: ProgressWeek[] = [];
    const seenWeeks = new Set<string>();
    for (const w of list(raw.weekly).slice(0, 100)) {
        if (!isObj(w)) continue;
        const weekStart = day(w.weekStart);
        if (!weekStart || seenWeeks.has(weekStart)) continue;
        seenWeeks.add(weekStart);
        weekly.push({ weekStart, itemsDone: count(w.itemsDone) });
    }
    weekly.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    const totalsOpen = count(totals.itemsOpen);

    return {
        enabled: true,
        team: {
            name: text(team.name, 80) ?? "The Huskyteers",
            number: count(team.number) || 19516,
        },
        since: day(raw.since) ?? "",
        updatedAt: isoDate(raw.updatedAt) ?? new Date().toISOString(),
        totals: {
            itemsDone: count(totals.itemsDone),
            itemsOpen: totalsOpen,
            itemsSubmitted: submitted(totals.itemsSubmitted, totalsOpen),
            completion: percent(totals.completion),
            doneLast7Days: count(totals.doneLast7Days),
            tasksFinished: count(totals.tasksFinished),
            tasksActive: count(totals.tasksActive),
            people: count(totals.people),
        },
        subteams,
        people,
        recent: recent.slice(0, MAX_RECENT),
        weekly: weekly.slice(-MAX_WEEKS),
    };
}

/** A response body as JSON, refusing anything over MAX_PAYLOAD_CHARS. */
export async function readJson(res: Response): Promise<unknown> {
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_PAYLOAD_CHARS) {
        throw new Error("Response too large");
    }
    const body = await res.text();
    if (body.length > MAX_PAYLOAD_CHARS) throw new Error("Response too large");
    return JSON.parse(body);
}
