import { ArrowUpRight, CalendarClock, CalendarDays, Clock, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Kicker, LiveDot, Panel } from "../progress/hud";
import { useNow } from "../progress/use-live-feed";
import { KindTag } from "./kind-meta";
import {
    countdown,
    dayOfEvent,
    formatClock,
    longDateLabel,
    relativeLabel,
    spokenCountdown,
    timeLabel,
    tzAbbr,
    type TimedEvent,
} from "./time";

/** A Google Maps search for a venue (opens in a new tab). */
export const mapsUrl = (location: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;

function Fact({
    icon: Icon,
    label,
    children,
}: {
    icon: LucideIcon;
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="flex items-start gap-3">
            <dt className="mt-0.5 shrink-0">
                <Icon className="size-4 text-(--hud-ink)" aria-hidden="true" />
                <span className="sr-only">{label}</span>
            </dt>
            <dd className="min-w-0 break-words text-base-content/85">
                {children}
            </dd>
        </div>
    );
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** D / H / M / S to the start; "On now" once it has started. */
function Countdown({
    next,
    today,
    timeZone,
}: {
    next: TimedEvent;
    today: string;
    timeZone: string;
}) {
    const now = useNow(1000);
    const { start, end } = next.window;
    const e = next.event;

    if (now >= start) {
        const finished = now >= end;
        const day = dayOfEvent({ ...next, phase: "live" }, today);
        const ends = e.endTime
            ? `Until ${formatClock(e.endTime)} ${tzAbbr(end, timeZone)}`.trim()
            : null;
        return (
            <div className="ev-live hud-card flex min-w-[15rem] flex-col items-start gap-2 rounded-2xl px-5 py-4 md:items-end md:text-right">
                <p className="flex items-center gap-2.5 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-base-content">
                    <LiveDot tone={finished ? "idle" : "live"} />
                    {finished ? "Just wrapped up" : "On now"}
                </p>
                <p className="font-jockey text-5xl leading-none uppercase text-(--hud-ink)">
                    {finished ? "Thanks!" : "Live"}
                </p>
                {!finished && (day || ends) && (
                    <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-base-content/70">
                        {day ?? ends}
                    </p>
                )}
            </div>
        );
    }

    const c = countdown(start - now);
    const cells: [number, string][] = [
        [c.days, c.days === 1 ? "Day" : "Days"],
        [c.hours, "Hrs"],
        [c.minutes, "Min"],
        [c.seconds, "Sec"],
    ];
    return (
        <div className="shrink-0">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-base-content/65 md:text-right">
                Starts in
            </p>
            <p className="sr-only">{spokenCountdown(c)}</p>
            <div
                className="mt-2 grid grid-cols-4 gap-2 sm:gap-2.5"
                aria-hidden="true"
            >
                {cells.map(([value, label], i) => (
                    <div
                        key={label}
                        className={cn(
                            "ev-count-cell hud-card flex min-w-[4.25rem] flex-col items-center rounded-xl px-2 py-2.5 sm:min-w-[5rem] sm:py-3",
                            i === 0 && "ev-count-lead",
                        )}
                    >
                        <span className="font-mono text-3xl leading-none font-semibold tabular-nums text-base-content sm:text-4xl">
                            {i === 0 ? value : pad2(value)}
                        </span>
                        <span className="mt-1.5 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-base-content/65">
                            {label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function NextUp({
    next,
    timeZone,
    today,
    now,
    className,
}: {
    next: TimedEvent | null;
    timeZone: string;
    today: string;
    now: number;
    className?: string;
}) {
    if (!next) {
        return (
            <Panel
                aria-labelledby="next-heading"
                className={cn("flex flex-col p-6", className)}
            >
                <Kicker as="h2" id="next-heading">
                    Next up
                </Kicker>
                <div className="flex flex-1 items-center gap-4 py-8">
                    <span className="hud-icon grid size-14 shrink-0 place-items-center rounded-2xl">
                        <CalendarClock className="size-6" aria-hidden="true" />
                    </span>
                    <div>
                        <p className="font-jockey text-3xl leading-none uppercase text-base-content sm:text-4xl">
                            More events coming soon
                        </p>
                        <p className="mt-2 text-base-content/70">
                            We&rsquo;re lining up the rest of the season. Check
                            back soon!
                        </p>
                    </div>
                </div>
            </Panel>
        );
    }

    const e = next.event;
    const live = now >= next.window.start;
    return (
        <Panel
            aria-labelledby="next-heading"
            data-kind={e.kind}
            className={cn("ev-next overflow-hidden p-5 sm:p-7", className)}
        >
            <div className="flex items-center justify-between gap-3">
                <Kicker as="h2" id="next-heading">
                    {live ? "Happening now" : "Next up"}
                </Kicker>
                <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-(--hud-ink)">
                    {live
                        ? (dayOfEvent({ ...next, phase: "live" }, today) ??
                          "Today")
                        : relativeLabel(next, today)}
                </span>
            </div>
            <div className="mt-5 grid gap-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="min-w-0">
                    <KindTag kind={e.kind} label={e.kindLabel} />
                    <h3 className="mt-3 font-jockey text-4xl leading-[0.95] text-balance break-words uppercase text-base-content sm:text-5xl">
                        {e.title}
                    </h3>
                    <dl className="mt-5 space-y-2 text-sm sm:text-base">
                        <Fact icon={CalendarDays} label="Date">
                            {longDateLabel(e)}
                        </Fact>
                        <Fact icon={Clock} label="Time">
                            {timeLabel(e, timeZone)}
                        </Fact>
                        {e.location && (
                            <Fact icon={MapPin} label="Location">
                                {e.location}{" "}
                                <a
                                    href={mapsUrl(e.location)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ev-link ml-1 inline-flex items-center gap-0.5 font-mono text-xs uppercase tracking-wider whitespace-nowrap"
                                >
                                    Map
                                    <ArrowUpRight
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                    <span className="sr-only">
                                        {" "}
                                        (opens in a new tab)
                                    </span>
                                </a>
                            </Fact>
                        )}
                    </dl>
                    {e.link && (
                        <a
                            href={e.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-sm mt-6"
                        >
                            Event details
                            <ArrowUpRight className="size-4" aria-hidden="true" />
                            <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                    )}
                </div>
                <Countdown next={next} today={today} timeZone={timeZone} />
            </div>
        </Panel>
    );
}
