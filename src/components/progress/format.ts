const numberFmt = new Intl.NumberFormat("en-US");

export const formatNumber = (n: number) => numberFmt.format(Math.round(n));

/** "YYYY-MM-DD" -> local Date at midnight (no UTC shift). */
export function parseDay(day: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

const longDay = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
});
const shortDay = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
});
const dateTime = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

export function formatDay(day: string, withYear = true): string {
    const d = parseDay(day);
    if (!d) return day;
    return (withYear ? longDay : shortDay).format(d);
}

export function formatDateTime(iso: string): string {
    const t = Date.parse(iso);
    return Number.isNaN(t) ? iso : dateTime.format(new Date(t));
}

/** Compact age: "now", "45s", "12m", "3h", "2d", then a date. */
export function shortAgo(iso: string, now: number): string {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return "";
    const s = Math.max(0, Math.round((now - t) / 1000));
    if (s < 45) return "now";
    const m = Math.round(s / 60);
    if (m < 60) return `${Math.max(1, m)}m`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.round(h / 24);
    if (d < 7) return `${d}d`;
    return shortDay.format(new Date(t));
}

/** Readable age: "just now", "12 s ago", "5 min ago", "3 h ago", "2 days ago". */
export function longAgo(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 5) return "just now";
    if (s < 60) return `${s} s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.floor(h / 24);
    return d === 1 ? "1 day ago" : `${d} days ago`;
}

export function initials(name: string): string {
    const parts = name
        .replace(/[^\p{L}\p{N}\s.-]/gu, "")
        .split(/[\s.-]+/)
        .filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Today's date in the team's timezone as YYYY-MM-DD. */
export function teamToday(
    now: number,
    timeZone = "America/Los_Angeles",
): string {
    try {
        return new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(new Date(now));
    } catch {
        return new Date(now).toISOString().slice(0, 10);
    }
}
