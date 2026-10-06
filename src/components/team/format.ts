/**
 * Wording for the Our Team page's cards and profile dialog. Pure module
 * (tests/team.test.mjs loads it with type stripping).
 */
import { formatNumber, parseDay, teamToday } from "../progress/format.ts";
import type { ProgressPerson, ProgressWeek } from "../progress/types";

/** "Build Team · Software Team" (positions as listed in team.astro). */
export function joinRoles(roles: readonly string[]): string {
    return roles.filter((r) => r.trim()).join(" · ");
}

/** "1 item", "12 items". */
export function itemsLabel(n: number): string {
    return `${formatNumber(n)} ${n === 1 ? "item" : "items"}`;
}

/** "12 done" on a card. */
export function doneLabel(n: number): string {
    return `${formatNumber(n)} done`;
}

/** Screen-reader summary of a card's live meter. */
export function liveSummary(p: ProgressPerson): string {
    const total = p.itemsDone + p.itemsOpen;
    if (!total) return "No checklist items assigned yet";
    const parts = [
        `${formatNumber(p.itemsDone)} checklist ${p.itemsDone === 1 ? "item" : "items"} done`,
        `${p.completion}% of their items`,
    ];
    if (p.itemsSubmitted > 0) {
        parts.push(`${formatNumber(p.itemsSubmitted)} in review`);
    }
    return parts.join(", ");
}

/** What a finished item is called when the portal hides task titles. */
export const UNTITLED_TASK = "A task";

export const doneTitle = (title: string | null) => title ?? UNTITLED_TASK;

const shortDay = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
});
const longDay = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
});
const fullDateTime = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

/** "Oct 3" this year, "Dec 12, 2025" before; the input when unparseable. */
export function doneDate(iso: string, now: number): string {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return iso;
    const d = new Date(t);
    return d.getFullYear() === new Date(now).getFullYear()
        ? shortDay.format(d)
        : longDay.format(d);
}

/** Tooltip form: "Fri, Oct 3, 2026, 4:12 PM". */
export function fullDate(iso: string): string {
    const t = Date.parse(iso);
    return Number.isNaN(t) ? iso : fullDateTime.format(new Date(t));
}

/** "today", "yesterday", "3 days ago", "2 weeks ago", then the date. */
export function lastDoneAgo(iso: string, now: number): string {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return "";
    const today = parseDay(teamToday(now));
    const that = parseDay(teamToday(t));
    if (!today || !that) return doneDate(iso, now);
    const days = Math.round((today.getTime() - that.getTime()) / 86_400_000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 14) return `${days} days ago`;
    if (days < 35) return `${Math.floor(days / 7)} weeks ago`;
    return doneDate(iso, now);
}

/** Sum of a weekly series. */
export const weeklyTotal = (weekly: readonly ProgressWeek[]) =>
    weekly.reduce((s, w) => s + w.itemsDone, 0);

/** A round top for a small bar chart: at least 4, else 1-2-5 steps. */
export function niceTop(max: number): number {
    if (max <= 4) return 4;
    const pow = 10 ** Math.floor(Math.log10(max));
    for (const step of [1, 2, 2.5, 5, 10]) {
        if (step * pow >= max) return step * pow;
    }
    return 10 * pow;
}
