import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarOff } from "lucide-react";
import {
    DemoTag,
    Notice,
    StaleBanner,
    StatusBadge,
    UnavailableNotice,
} from "../progress/feed-ui";
import { Kicker } from "../progress/hud";
import {
    portalJsonFetcher,
    useDemoOrLive,
    useLiveFeed,
    useNow,
    type JsonFetcher,
    type LiveFeedState,
} from "../progress/use-live-feed";
import { NextUp } from "./next-up";
import {
    KindChips,
    PastList,
    SeasonGlance,
    UpcomingList,
    type KindFilter,
} from "./schedule";
import { longDateLabel, splitSchedule, todayIn, tzLongName } from "./time";
import {
    KIND_PLURALS,
    parseEvents,
    type EventsEnabled,
    type EventsPayload,
} from "./types";

/** The schedule changes rarely: refresh every 5 minutes (and on focus). */
const POLL_MS = 5 * 60_000;
/** Focusing the tab refreshes at most once a minute. */
const WAKE_DEBOUNCE_MS = 60_000;

type Source = { fetcher: JsonFetcher; pollMs?: number };

function useSource(portalUrl: string) {
    return useDemoOrLive<Source>(
        // One shared CDN entry per minute for every visitor.
        () => ({
            fetcher: portalJsonFetcher(portalUrl, "/api/public/events", 60_000),
        }),
        import.meta.env.DEV
            ? (mode) =>
                  import("./demo-data").then(({ createDemoEventsFetcher }) => ({
                      fetcher: createDemoEventsFetcher(mode),
                      pollMs: 20_000,
                  }))
            : null,
        portalUrl,
    );
}

const eventsStamp = (p: EventsPayload) => (p.enabled ? p.updatedAt : null);

/* ------------------------------------------------------------------ */

function Hero({ feed }: { feed: LiveFeedState<EventsPayload> }) {
    const tz = feed.data?.enabled ? feed.data.timezone : null;
    return (
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
                <Kicker>FTC 19516 // Season schedule</Kicker>
                <h1 className="mt-2 font-jockey text-6xl leading-[0.9] uppercase sm:text-7xl lg:text-8xl">
                    <span className="text-base-content">Team </span>
                    <span className="hud-title-accent">Events</span>
                </h1>
                <p className="mt-4 max-w-xl text-base text-base-content/75 sm:text-lg">
                    League meets, tournaments, scrimmages, competitions and
                    outreach, straight from our team calendar. Come cheer us
                    on!
                </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
                <StatusBadge feed={feed} offDetail="the schedule is hidden" />
                {tz && (
                    <p className="font-mono text-[0.6875rem] whitespace-nowrap uppercase tracking-[0.16em] text-base-content/70">
                        All times {tzLongName(tz)}
                    </p>
                )}
            </div>
        </header>
    );
}

function Skeleton() {
    return (
        <div aria-hidden="true">
            <div className="mt-10 grid gap-4 lg:grid-cols-12">
                <div className="hud-panel hud-skeleton h-[22rem] lg:col-span-8 lg:h-[20rem]" />
                <div className="hud-panel hud-skeleton h-[20rem] lg:col-span-4" />
            </div>
            <div className="mt-12 space-y-2.5">
                {Array.from({ length: 3 }, (_, i) => (
                    <div
                        key={i}
                        className="hud-panel hud-skeleton h-[6.5rem] rounded-xl"
                    />
                ))}
            </div>
        </div>
    );
}

function Schedule({ data, now }: { data: EventsEnabled; now: number }) {
    const tz = data.timezone;
    const today = todayIn(now, tz);
    const [filter, setFilter] = useState<KindFilter>("ALL");
    const { upcoming, past, next } = useMemo(
        () => splitSchedule(data.events, now, tz),
        [data.events, now, tz],
    );

    // The chosen kind left the calendar: back to all.
    const present = filter === "ALL" || data.events.some((e) => e.kind === filter);
    useEffect(() => {
        if (!present) setFilter("ALL");
    }, [present]);
    const shown = present ? filter : "ALL";
    const match = (t: { event: { kind: string } }) =>
        shown === "ALL" || t.event.kind === shown;

    if (data.events.length === 0) {
        return (
            <Notice icon={CalendarClock} title="Schedule coming soon">
                <p>
                    Our league meets, competitions and outreach events show up
                    here as soon as they&rsquo;re on the team calendar.
                </p>
            </Notice>
        );
    }

    const upcomingShown = upcoming.filter(match);
    const pastShown = past.filter(match);
    const kindName =
        shown === "ALL" ? "events" : KIND_PLURALS[shown].toLowerCase();

    return (
        <>
            <div className="mt-10 grid gap-4 lg:grid-cols-12">
                <NextUp
                    next={next}
                    timeZone={tz}
                    today={today}
                    now={now}
                    className="lg:col-span-8"
                />
                <SeasonGlance
                    upcoming={upcoming}
                    past={past}
                    className="lg:col-span-4"
                />
            </div>

            <section aria-labelledby="upcoming-heading" className="mt-14">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <Kicker as="h2" id="upcoming-heading">
                            Coming up
                        </Kicker>
                        <p className="mt-1 text-sm text-base-content/70">
                            {upcomingSummary(
                                upcomingShown.length,
                                pastShown.length,
                            )}
                        </p>
                    </div>
                    <KindChips
                        events={data.events}
                        value={shown}
                        onChange={setFilter}
                    />
                </div>
                <UpcomingList
                    upcoming={upcomingShown}
                    nextId={next?.event.id ?? null}
                    timeZone={tz}
                    today={today}
                    emptyText={`No upcoming ${kindName} on the calendar yet. Check back soon!`}
                />
            </section>

            <PastList past={pastShown} today={today} />

            <footer className="mt-14 border-t border-base-content/10 pt-6 font-mono text-[0.6875rem] leading-relaxed uppercase tracking-wider text-base-content/70">
                <p>
                    Events come from our team calendar. Dates and times are{" "}
                    {tzLongName(tz)} ({tz}).
                </p>
                <p className="mt-1">
                    Refreshes every 5 minutes · Source: Huskyteers Teammate
                    Portal
                </p>
            </footer>
        </>
    );
}

/** "7 upcoming · 4 earlier this season" (adds up to the chip's count). */
function upcomingSummary(upcoming: number, past: number) {
    if (upcoming + past === 0) return "Nothing scheduled yet";
    const parts = [`${upcoming} upcoming`];
    if (past > 0) parts.push(`${past} earlier this season`);
    return parts.join(" · ");
}

/** Polite screen-reader text; it only changes when the next event does. */
function announcementFor(
    feed: LiveFeedState<EventsPayload>,
    nextLabel: string | null,
): string {
    const data = feed.data;
    if (!data && feed.status === "error") {
        return "The schedule is unavailable, retrying.";
    }
    if (!data) return "";
    if (!data.enabled) return "The team's schedule is hidden right now.";
    return nextLabel ? `Next up: ${nextLabel}.` : "";
}

export default function LiveEvents({ portalUrl }: { portalUrl: string }) {
    const source = useSource(portalUrl);
    const feed = useLiveFeed(source?.fetcher ?? null, {
        parse: parseEvents,
        pollMs: source?.pollMs ?? POLL_MS,
        wakeDebounceMs: WAKE_DEBOUNCE_MS,
        updatedAt: eventsStamp,
    });
    // Coarse clock for upcoming / past and relative labels; the countdown
    // ticks on its own.
    const now = useNow(30_000);
    const data = feed.data;

    const nextLabel = useMemo(() => {
        if (!data?.enabled) return null;
        const { next } = splitSchedule(data.events, now, data.timezone);
        return next
            ? `${next.event.title}, ${longDateLabel(next.event)}`
            : null;
    }, [data, now]);

    let body;
    if (data?.enabled) {
        body = <Schedule data={data} now={now} />;
    } else if (data && !data.enabled) {
        body = (
            <Notice icon={CalendarOff} title="Schedule is private right now">
                <p>
                    The team has paused its public events calendar. Check back
                    soon!
                </p>
            </Notice>
        );
    } else if (feed.status === "error") {
        body = <UnavailableNotice onRetry={feed.retryNow} />;
    } else {
        body = <Skeleton />;
    }

    return (
        <div className="hud hud-bg">
            <div className="hud-sweep" aria-hidden="true" />
            <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-16 sm:px-6 lg:px-8 lg:pt-14">
                <Hero feed={feed} />
                <DemoTag mode={source?.demo} />
                <StaleBanner feed={feed} onRetry={feed.retryNow} />
                {body}
                <p className="sr-only" aria-live="polite" aria-atomic="true">
                    {announcementFor(feed, nextLabel)}
                </p>
            </div>
        </div>
    );
}
