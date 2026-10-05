import { memo, useState } from "react";
import { ArrowUpRight, Check, Clock, MapPin } from "lucide-react";
import { cn } from "../../lib/utils";
import { Kicker, LiveDot, Panel } from "../progress/hud";
import { KindBadge, KindTag } from "./kind-meta";
import {
    dayParts,
    monthHeading,
    monthKey,
    monthName,
    relativeLabel,
    timeLabel,
    weekdayName,
    type TimedEvent,
} from "./time";
import {
    KIND_PLURALS,
    PUBLIC_EVENT_KINDS,
    type PublicEvent,
    type PublicEventKind,
} from "./types";

export type KindFilter = PublicEventKind | "ALL";

const NEW_TAB = <span className="sr-only"> (opens in a new tab)</span>;

/* ------------------------- season summary ------------------------- */

export function SeasonGlance({
    upcoming,
    past,
    className,
}: {
    upcoming: TimedEvent[];
    past: TimedEvent[];
    className?: string;
}) {
    const count = (list: TimedEvent[], k: PublicEventKind) =>
        list.filter((t) => t.event.kind === k).length;
    return (
        <Panel
            aria-labelledby="glance-heading"
            className={cn("flex flex-col p-5 sm:p-6", className)}
        >
            <Kicker as="h2" id="glance-heading">
                Season at a glance
            </Kicker>
            <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                    <p className="font-mono text-5xl leading-none font-semibold tabular-nums text-base-content">
                        {upcoming.length}
                    </p>
                    <p className="mt-1.5 text-sm text-base-content/70">
                        coming up
                    </p>
                </div>
                <div>
                    <p className="font-mono text-5xl leading-none font-semibold tabular-nums text-base-content/55">
                        {past.length}
                    </p>
                    <p className="mt-1.5 text-sm text-base-content/70">
                        done this season
                    </p>
                </div>
            </div>
            <ul className="mt-5 space-y-2 border-t border-base-content/10 pt-4">
                {PUBLIC_EVENT_KINDS.map((k) => {
                    const up = count(upcoming, k);
                    const done = count(past, k);
                    return (
                        <li
                            key={k}
                            className={cn(
                                "flex items-center gap-3",
                                up + done === 0 && "opacity-55",
                            )}
                        >
                            <KindBadge
                                kind={k}
                                className="size-7 rounded-md"
                                iconClassName="size-3.5"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm text-base-content/85">
                                {KIND_PLURALS[k]}
                            </span>
                            <span className="shrink-0 font-mono text-[0.6875rem] tabular-nums text-base-content/70">
                                <span className="font-semibold text-base-content">
                                    {up}
                                </span>{" "}
                                ahead
                                <span aria-hidden="true"> · </span>
                                <span className="sr-only">, </span>
                                {done} done
                            </span>
                        </li>
                    );
                })}
            </ul>
        </Panel>
    );
}

/* --------------------------- kind filter --------------------------- */

export function KindChips({
    events,
    value,
    onChange,
}: {
    events: readonly PublicEvent[];
    value: KindFilter;
    onChange: (k: KindFilter) => void;
}) {
    const counts = new Map<PublicEventKind, number>();
    for (const e of events) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
    const kinds = PUBLIC_EVENT_KINDS.filter((k) => counts.has(k));
    // One kind (or none): nothing to filter.
    if (kinds.length < 2) return null;
    const chip = (k: KindFilter, label: string, n: number) => (
        <button
            key={k}
            type="button"
            data-kind={k === "ALL" ? undefined : k}
            aria-pressed={value === k}
            onClick={() => onChange(k)}
            className="ev-chip inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium"
        >
            {k !== "ALL" && (
                <span
                    className="ev-kind-dot size-2 shrink-0 rounded-full"
                    aria-hidden="true"
                />
            )}
            {label}
            <span className="ev-chip-count font-mono text-[0.6875rem] tabular-nums">
                {n}
            </span>
        </button>
    );
    return (
        <div
            role="group"
            aria-label="Show events of one kind"
            className="flex flex-wrap gap-2"
        >
            {chip("ALL", "All", events.length)}
            {kinds.map((k) => chip(k, KIND_PLURALS[k], counts.get(k) ?? 0))}
        </div>
    );
}

/* ---------------------------- upcoming ---------------------------- */

function DateBlock({ e }: { e: PublicEvent }) {
    const a = dayParts(e.startsOn);
    const b = e.endsOn ? dayParts(e.endsOn) : null;
    const month =
        b && b.month !== a.month
            ? `${monthName(a.month)}–${monthName(b.month)}`
            : monthName(a.month);
    return (
        <div
            className="ev-date grid w-16 shrink-0 place-items-center content-center rounded-xl py-2 text-center sm:w-[4.5rem]"
            aria-hidden="true"
        >
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-base-content/65">
                {b
                    ? `${weekdayName(a.weekday)}–${weekdayName(b.weekday)}`
                    : weekdayName(a.weekday)}
            </span>
            <span
                className={cn(
                    "font-mono leading-tight font-semibold tabular-nums text-base-content",
                    b ? "text-lg sm:text-xl" : "text-2xl sm:text-3xl",
                )}
            >
                {b ? `${a.date}–${b.date}` : a.date}
            </span>
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-(--hud-ink)">
                {month}
            </span>
        </div>
    );
}

const EventRow = memo(function EventRow({
    t,
    timeZone,
    today,
    isNext,
}: {
    t: TimedEvent;
    timeZone: string;
    today: string;
    isNext: boolean;
}) {
    const e = t.event;
    const live = t.phase === "live";
    return (
        <li
            data-kind={e.kind}
            className={cn(
                "ev-row hud-card relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-xl p-3 pl-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-4 sm:pl-5",
                live && "ev-row-live",
            )}
        >
            <DateBlock e={e} />
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <KindTag kind={e.kind} label={e.kindLabel} />
                    {live ? (
                        <span className="hud-chip inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider">
                            <LiveDot className="size-2" /> On now
                        </span>
                    ) : (
                        isNext && (
                            <span className="hud-chip rounded-md px-2 py-0.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider">
                                Next up
                            </span>
                        )
                    )}
                </div>
                <h4 className="mt-1.5 text-base leading-snug font-semibold break-words text-base-content sm:text-lg">
                    {e.title}
                </h4>
                <p className="sr-only">{relativeLabel(t, today)}.</p>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-base-content/70">
                    <span className="inline-flex items-start gap-1.5">
                        <Clock
                            className="mt-[0.1875rem] size-3.5 shrink-0 text-(--hud-ink)"
                            aria-hidden="true"
                        />
                        {timeLabel(e, timeZone)}
                    </span>
                    {e.location && (
                        <span className="inline-flex min-w-0 items-start gap-1.5">
                            <MapPin
                                className="mt-[0.1875rem] size-3.5 shrink-0 text-(--hud-ink)"
                                aria-hidden="true"
                            />
                            <span className="min-w-0 break-words">
                                {e.location}
                            </span>
                        </span>
                    )}
                </p>
            </div>
            <div className="col-span-2 flex items-center justify-between gap-3 border-t border-base-content/10 pt-2.5 sm:col-span-1 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                <span
                    className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] whitespace-nowrap text-(--hud-ink)"
                    aria-hidden="true"
                >
                    {relativeLabel(t, today)}
                </span>
                {e.link && (
                    <a
                        href={e.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ev-link inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider"
                    >
                        Details
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                        <span className="sr-only">: {e.title}</span>
                        {NEW_TAB}
                    </a>
                )}
            </div>
        </li>
    );
});

export function UpcomingList({
    upcoming,
    nextId,
    timeZone,
    today,
    emptyText,
}: {
    upcoming: TimedEvent[];
    nextId: string | null;
    timeZone: string;
    today: string;
    emptyText: string;
}) {
    if (upcoming.length === 0) {
        return (
            <p className="hud-card mt-6 rounded-xl px-4 py-8 text-center font-mono text-sm text-base-content/70">
                {emptyText}
            </p>
        );
    }
    const groups: { key: string; items: TimedEvent[] }[] = [];
    for (const t of upcoming) {
        // A live multi-day event started last month still belongs "now".
        const key = monthKey(
            t.phase === "live" ? today : t.event.startsOn,
        );
        const g = groups.at(-1);
        if (g && g.key === key) g.items.push(t);
        else groups.push({ key, items: [t] });
    }
    return (
        <div className="mt-2">
            {groups.map((g) => (
                <div key={g.key} className="mt-6">
                    <h3 className="flex items-center gap-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-base-content/70">
                        {monthHeading(g.key)}
                        <span
                            className="ev-rule h-px flex-1"
                            aria-hidden="true"
                        />
                    </h3>
                    <ol className="mt-3 space-y-2.5">
                        {g.items.map((t) => (
                            <EventRow
                                key={t.event.id}
                                t={t}
                                timeZone={timeZone}
                                today={today}
                                isNext={t.event.id === nextId}
                            />
                        ))}
                    </ol>
                </div>
            ))}
        </div>
    );
}

/* ------------------------------ past ------------------------------ */

const PAST_LIMIT = 5;

export function PastList({
    past,
    today,
}: {
    past: TimedEvent[];
    today: string;
}) {
    const [expanded, setExpanded] = useState(false);
    if (past.length === 0) return null;
    const shown = expanded ? past : past.slice(0, PAST_LIMIT);
    return (
        <section aria-labelledby="past-heading" className="mt-14">
            <div className="flex items-baseline justify-between gap-3">
                <Kicker as="h2" id="past-heading">
                    Earlier this season
                </Kicker>
                <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-base-content/60">
                    {past.length} {past.length === 1 ? "event" : "events"}
                </span>
            </div>
            <Panel as="div" className="mt-4 px-2 py-1 sm:px-3">
                <ol className="divide-y divide-base-content/10">
                    {shown.map((t) => {
                        const e = t.event;
                        const a = dayParts(e.startsOn);
                        return (
                            <li
                                key={e.id}
                                className="flex items-center gap-3 px-2 py-3 sm:gap-4"
                            >
                                <span className="w-14 shrink-0 font-mono text-xs tabular-nums text-base-content/70 sm:w-16">
                                    {monthName(a.month)} {a.date}
                                    {e.endsOn
                                        ? `–${dayParts(e.endsOn).date}`
                                        : ""}
                                </span>
                                <KindBadge
                                    kind={e.kind}
                                    className="size-7 rounded-md max-sm:hidden"
                                    iconClassName="size-3.5"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm leading-snug font-medium break-words text-base-content/90">
                                        {e.title}
                                    </p>
                                    <p className="mt-0.5 font-mono text-[0.6875rem] uppercase tracking-wider text-base-content/60">
                                        {e.kindLabel}
                                        {e.location ? (
                                            <span className="normal-case tracking-normal">
                                                {" "}
                                                · {e.location}
                                            </span>
                                        ) : null}
                                    </p>
                                </div>
                                {e.link ? (
                                    <a
                                        href={e.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ev-link grid size-8 shrink-0 place-items-center rounded-lg"
                                        title="Event details"
                                    >
                                        <ArrowUpRight
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                        <span className="sr-only">
                                            Details: {e.title}
                                        </span>
                                        {NEW_TAB}
                                    </a>
                                ) : (
                                    <span
                                        className="grid size-8 shrink-0 place-items-center text-base-content/35"
                                        title={relativeLabel(t, today)}
                                    >
                                        <Check
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </Panel>
            {past.length > PAST_LIMIT && (
                <button
                    type="button"
                    className="btn btn-ghost btn-sm mt-2 w-full font-mono text-xs uppercase tracking-wider"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((x) => !x)}
                >
                    {expanded ? "Show less" : `Show all ${past.length}`}
                </button>
            )}
        </section>
    );
}
