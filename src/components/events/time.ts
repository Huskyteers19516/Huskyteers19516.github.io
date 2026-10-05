/**
 * Dates and times for the Events page. Every event's day and "HH:MM" is in
 * the team's timezone (the payload's `timezone`), so labels are built from
 * those strings directly — never shifted into the visitor's timezone — and
 * the countdown converts them to real instants with the timezone's offset
 * (DST-aware).
 *
 * Pure module, so the tests in tests/ can load it with Node's type stripping.
 */
import type { PublicEvent } from "./types";

const DAY_MS = 86_400_000;

const partsFormats = new Map<string, Intl.DateTimeFormat>();

function partsFormat(timeZone: string): Intl.DateTimeFormat {
    let f = partsFormats.get(timeZone);
    if (!f) {
        f = new Intl.DateTimeFormat("en-US", {
            timeZone,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        partsFormats.set(timeZone, f);
    }
    return f;
}

/** The timezone's offset from UTC at `utcMs` (ms; LA in summer: -7 h). */
export function tzOffsetMs(utcMs: number, timeZone: string): number {
    const p: Record<string, number> = {};
    for (const part of partsFormat(timeZone).formatToParts(new Date(utcMs))) {
        if (part.type !== "literal") p[part.type] = Number(part.value);
    }
    const asUtc = Date.UTC(
        p.year,
        p.month - 1,
        p.day,
        p.hour % 24,
        p.minute,
        p.second,
    );
    return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * The instant of `day` at `time` ("HH:MM", null = midnight) in `timeZone`.
 * A wall time repeated by a DST change picks the first; one skipped by a
 * DST jump lands just after the jump (02:30 -> 03:30).
 */
export function zonedTime(
    day: string,
    time: string | null,
    timeZone: string,
): number {
    const [y, m, d] = day.split("-").map(Number);
    const [h, mi] = time ? time.split(":").map(Number) : [0, 0];
    const wall = Date.UTC(y, m - 1, d, h, mi);
    // The offsets in force a day before and a day after (DST changes are
    // never closer together than that).
    const before = tzOffsetMs(wall - DAY_MS, timeZone);
    const after = tzOffsetMs(wall + DAY_MS, timeZone);
    const valid = [...new Set([before, after])]
        .map((offset) => wall - offset)
        .filter((t) => t + tzOffsetMs(t, timeZone) === wall);
    return valid.length ? Math.min(...valid) : wall - before;
}

/** "YYYY-MM-DD" plus n days. */
export function addDays(day: string, n: number): string {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS)
        .toISOString()
        .slice(0, 10);
}

/** Whole days from `a` to `b` (both YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
    const [ay, am, ad] = a.split("-").map(Number);
    const [by, bm, bd] = b.split("-").map(Number);
    return Math.round(
        (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS,
    );
}

/** Today in `timeZone` as YYYY-MM-DD. */
export function todayIn(now: number, timeZone: string): string {
    const p: Record<string, string> = {};
    for (const part of partsFormat(timeZone).formatToParts(new Date(now))) {
        p[part.type] = part.value;
    }
    return `${p.year}-${p.month}-${p.day}`;
}

export interface EventWindow {
    start: number;
    /** Exclusive: the end time, or midnight after the last day. */
    end: number;
}

export function eventWindow(e: PublicEvent, timeZone: string): EventWindow {
    const start = zonedTime(e.startsOn, e.startTime, timeZone);
    const lastDay = e.endsOn ?? e.startsOn;
    const endOfDay = zonedTime(addDays(lastDay, 1), null, timeZone);
    let end = e.endTime ? zonedTime(lastDay, e.endTime, timeZone) : endOfDay;
    if (end <= start) end = endOfDay;
    return { start, end };
}

export type Phase = "upcoming" | "live" | "past";

export function phaseOf(w: EventWindow, now: number): Phase {
    if (now < w.start) return "upcoming";
    return now < w.end ? "live" : "past";
}

export interface TimedEvent {
    event: PublicEvent;
    window: EventWindow;
    phase: Phase;
}

export interface Schedule {
    /** Happening now or still to come, soonest first. */
    upcoming: TimedEvent[];
    /** Over, most recent first. */
    past: TimedEvent[];
    /** The first of `upcoming` (may be live), or null. */
    next: TimedEvent | null;
}

export function splitSchedule(
    events: readonly PublicEvent[],
    now: number,
    timeZone: string,
): Schedule {
    const upcoming: TimedEvent[] = [];
    const past: TimedEvent[] = [];
    for (const event of events) {
        const window = eventWindow(event, timeZone);
        const phase = phaseOf(window, now);
        (phase === "past" ? past : upcoming).push({ event, window, phase });
    }
    upcoming.sort((a, b) => a.window.start - b.window.start);
    past.sort((a, b) => b.window.end - a.window.end);
    return { upcoming, past, next: upcoming[0] ?? null };
}

/* ---------------------------- labels ---------------------------- */

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];
const LONG_MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG_WEEKDAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

export interface DayParts {
    year: number;
    /** 0-11 */
    month: number;
    date: number;
    /** 0 Sunday .. 6 Saturday */
    weekday: number;
}

export function dayParts(day: string): DayParts {
    const [y, m, d] = day.split("-").map(Number);
    return {
        year: y,
        month: m - 1,
        date: d,
        weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
    };
}

export const monthName = (month: number, long = false) =>
    (long ? LONG_MONTHS : MONTHS)[month] ?? "";
export const weekdayName = (weekday: number, long = false) =>
    (long ? LONG_WEEKDAYS : WEEKDAYS)[weekday] ?? "";

/** "13:30" -> "1:30 PM"; "09:00" -> "9 AM" when `compact`. */
export function formatClock(time: string, compact = false): string {
    const [h, m] = time.split(":").map(Number);
    const suffix = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    if (compact && m === 0) return `${h12} ${suffix}`;
    return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** The timezone's short name at an instant ("PDT", "PST"; else "GMT-7"). */
export function tzAbbr(at: number, timeZone: string): string {
    try {
        const part = new Intl.DateTimeFormat("en-US", {
            timeZone,
            timeZoneName: "short",
        })
            .formatToParts(new Date(at))
            .find((p) => p.type === "timeZoneName");
        return part?.value ?? "";
    } catch {
        return "";
    }
}

/** The timezone's generic name ("Pacific Time"), else the IANA name. */
export function tzLongName(timeZone: string, at = Date.now()): string {
    try {
        const part = new Intl.DateTimeFormat("en-US", {
            timeZone,
            timeZoneName: "longGeneric",
        })
            .formatToParts(new Date(at))
            .find((p) => p.type === "timeZoneName");
        return part?.value || timeZone;
    } catch {
        return timeZone;
    }
}

/** "Saturday, October 18, 2026" or "Sat, Oct 18 – Sun, Oct 19, 2026". */
export function longDateLabel(e: PublicEvent): string {
    const a = dayParts(e.startsOn);
    if (!e.endsOn) {
        return `${weekdayName(a.weekday, true)}, ${monthName(a.month, true)} ${a.date}, ${a.year}`;
    }
    const b = dayParts(e.endsOn);
    const first = `${weekdayName(a.weekday)}, ${monthName(a.month)} ${a.date}`;
    const last = `${weekdayName(b.weekday)}, ${monthName(b.month)} ${b.date}, ${b.year}`;
    return a.year === b.year
        ? `${first} – ${last}`
        : `${first}, ${a.year} – ${last}`;
}

/** "9:00 AM – 4:00 PM PDT" · "From 9:00 AM PDT" · "All day". */
export function timeLabel(e: PublicEvent, timeZone: string): string {
    if (!e.startTime) return "All day";
    const at = zonedTime(e.startsOn, e.startTime, timeZone);
    const zone = tzAbbr(at, timeZone);
    const tail = zone ? ` ${zone}` : "";
    const start = formatClock(e.startTime);
    if (!e.endTime) return `From ${start}${tail}`;
    return `${start} – ${formatClock(e.endTime)}${tail}`;
}

/** "Today", "Tomorrow", "In 5 days", "In 3 weeks", "Happening now". */
export function relativeLabel(t: TimedEvent, today: string): string {
    if (t.phase === "live") return "Happening now";
    const d = daysBetween(today, t.event.startsOn);
    if (t.phase === "past") {
        const ago = daysBetween(t.event.endsOn ?? t.event.startsOn, today);
        if (ago <= 0) return "Earlier today";
        if (ago === 1) return "Yesterday";
        if (ago < 14) return `${ago} days ago`;
        return `${Math.round(ago / 7)} weeks ago`;
    }
    if (d <= 0) return "Today";
    if (d === 1) return "Tomorrow";
    if (d < 14) return `In ${d} days`;
    if (d < 60) return `In ${Math.round(d / 7)} weeks`;
    return `In ${Math.round(d / 30.4)} months`;
}

/** For a multi-day event that's on: "Day 2 of 3". Null otherwise. */
export function dayOfEvent(t: TimedEvent, today: string): string | null {
    if (t.phase !== "live" || !t.event.endsOn) return null;
    const total = daysBetween(t.event.startsOn, t.event.endsOn) + 1;
    const n = Math.min(total, daysBetween(t.event.startsOn, today) + 1);
    return n >= 1 ? `Day ${n} of ${total}` : null;
}

export interface Countdown {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

export function countdown(ms: number): Countdown {
    const s = Math.max(0, Math.floor(ms / 1000));
    return {
        days: Math.floor(s / 86_400),
        hours: Math.floor((s % 86_400) / 3600),
        minutes: Math.floor((s % 3600) / 60),
        seconds: s % 60,
    };
}

/** "12 days, 4 hours and 3 minutes" (screen readers; minute precision). */
export function spokenCountdown(c: Countdown): string {
    const parts: string[] = [];
    const unit = (n: number, one: string) =>
        `${n} ${one}${n === 1 ? "" : "s"}`;
    if (c.days) parts.push(unit(c.days, "day"));
    if (c.hours) parts.push(unit(c.hours, "hour"));
    if (c.minutes || parts.length === 0)
        parts.push(unit(c.minutes, "minute"));
    if (parts.length === 1) return parts[0];
    return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/** Month bucket key for grouping: "2026-10". */
export const monthKey = (day: string) => day.slice(0, 7);

/** "October 2026". */
export function monthHeading(key: string): string {
    const [y, m] = key.split("-").map(Number);
    return `${monthName(m - 1, true)} ${y}`;
}
