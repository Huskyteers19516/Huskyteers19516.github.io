/**
 * Shape of GET {PUBLIC_PORTAL_URL}/api/public/events: the public part of the
 * Teammate Portal's Team calendar. Only league meets, ILTs, scrimmages,
 * competitions and outreach are published (never team meetings, team
 * events, deadlines or "other"), and events a leader marked "Hide from the
 * team website" are left out by the portal.
 *
 * `parseEvents` validates and normalises the payload, dropping anything
 * malformed (or of a kind that should never be public) instead of crashing
 * the island.
 */
import {
    clock,
    day,
    httpUrl,
    isObj,
    isoDate,
    list,
    text,
} from "../../lib/portal-json.ts";

export const PUBLIC_EVENT_KINDS = [
    "MEET",
    "ILT",
    "SCRIMMAGE",
    "COMPETITION",
    "OUTREACH",
] as const;

export type PublicEventKind = (typeof PUBLIC_EVENT_KINDS)[number];

/** The portal's labels (used when a payload's kindLabel is missing). */
export const KIND_LABELS: Record<PublicEventKind, string> = {
    MEET: "League meet",
    ILT: "League tournament (ILT)",
    SCRIMMAGE: "League scrimmage",
    COMPETITION: "Competition",
    OUTREACH: "Outreach",
};

/** Plural labels for the filter chips and the season summary. */
export const KIND_PLURALS: Record<PublicEventKind, string> = {
    MEET: "League meets",
    ILT: "Tournaments (ILT)",
    SCRIMMAGE: "Scrimmages",
    COMPETITION: "Competitions",
    OUTREACH: "Outreach",
};

export const isPublicKind = (v: unknown): v is PublicEventKind =>
    typeof v === "string" &&
    (PUBLIC_EVENT_KINDS as readonly string[]).includes(v);

export interface PublicEvent {
    id: string;
    title: string;
    kind: PublicEventKind;
    kindLabel: string;
    /** First day, YYYY-MM-DD in the team's timezone. */
    startsOn: string;
    /** Last day (inclusive) when it's longer than one day, else null. */
    endsOn: string | null;
    /** "HH:MM" 24 h, team timezone; null = all day / time not known yet. */
    startTime: string | null;
    endTime: string | null;
    /** Venue name and/or address ("" = not set). */
    location: string;
    /** FTC Events page, sign-up form… (http/https) or null. */
    link: string | null;
}

export interface EventsEnabled {
    enabled: true;
    updatedAt: string;
    /** IANA timezone the dates and times are in. */
    timezone: string;
    events: PublicEvent[];
}

export type EventsPayload = EventsEnabled | { enabled: false };

/** Most events kept from one payload (the portal sends at most 300). */
export const MAX_EVENTS = 300;
export const DEFAULT_TIMEZONE = "America/Los_Angeles";

/** A timezone this browser understands, else null. */
export function validTimeZone(v: unknown): string | null {
    if (typeof v !== "string" || !v || v.length > 64) return null;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: v });
        return v;
    } catch {
        return null;
    }
}

/** By first day, then all-day before timed, then start time, then title. */
export function compareEvents(a: PublicEvent, b: PublicEvent): number {
    return (
        a.startsOn.localeCompare(b.startsOn) ||
        (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
        a.title.localeCompare(b.title, "en", { sensitivity: "base" }) ||
        a.id.localeCompare(b.id)
    );
}

function parseEvent(e: unknown): PublicEvent | null {
    if (!isObj(e)) return null;
    // Never show a kind that isn't public, even if a payload carried one.
    if (!isPublicKind(e.kind)) return null;
    const id = text(e.id, 64);
    const title = text(e.title, 200);
    const startsOn = day(e.startsOn);
    if (!id || !title || !startsOn) return null;
    let endsOn = day(e.endsOn);
    if (endsOn && endsOn <= startsOn) endsOn = null;
    const startTime = clock(e.startTime);
    // An end time without a start time means nothing; on a one-day event
    // it must come after the start.
    let endTime = startTime ? clock(e.endTime) : null;
    if (endTime && !endsOn && startTime && endTime <= startTime)
        endTime = null;
    return {
        id,
        title,
        kind: e.kind,
        kindLabel: text(e.kindLabel, 60) ?? KIND_LABELS[e.kind],
        startsOn,
        endsOn,
        startTime,
        endTime,
        location: text(e.location, 200) ?? "",
        link: httpUrl(e.link),
    };
}

/**
 * Validates an unknown JSON value against the public events contract.
 * Returns null when the payload is unusable (wrong shape entirely).
 */
export function parseEvents(raw: unknown): EventsPayload | null {
    if (!isObj(raw)) return null;
    if (raw.enabled === false) return { enabled: false };
    if (raw.enabled !== true || !Array.isArray(raw.events)) return null;

    const seen = new Set<string>();
    const events: PublicEvent[] = [];
    for (const e of list(raw.events).slice(0, MAX_EVENTS * 2)) {
        const ev = parseEvent(e);
        if (!ev || seen.has(ev.id)) continue;
        seen.add(ev.id);
        events.push(ev);
        if (events.length >= MAX_EVENTS) break;
    }
    events.sort(compareEvents);

    return {
        enabled: true,
        updatedAt: isoDate(raw.updatedAt) ?? new Date().toISOString(),
        timezone: validTimeZone(raw.timezone) ?? DEFAULT_TIMEZONE,
        events,
    };
}
