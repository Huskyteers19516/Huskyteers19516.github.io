import { useMemo } from "react";
import { Activity, Hourglass, Lock, Trophy, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
    DemoTag,
    Notice,
    StaleBanner,
    StatusBadge,
    UnavailableNotice,
} from "./feed-ui";
import { AnimatedNumber, Kicker, LiveDot, Panel, Ring, Swatch } from "./hud";
import { formatDay, formatNumber } from "./format";
import { RecentFeed } from "./recent-feed";
import { TeamBoard } from "./team-board";
import type { ProgressEnabled } from "./types";
import { useDemoOrLive } from "./use-live-feed";
import {
    portalFetcher,
    useNow,
    useProgressFeed,
    type FeedState,
    type ProgressFetcher,
} from "./use-progress-feed";
import { isCurrentWeek, WeeklyChart } from "./weekly-chart";

type Source = { fetcher: ProgressFetcher; pollMs?: number };

/** Resolve the data source on the client (dev-only ?demo= mock, else the portal). */
function useSource(portalUrl: string) {
    return useDemoOrLive<Source>(
        () => ({ fetcher: portalFetcher(portalUrl) }),
        import.meta.env.DEV
            ? (mode) =>
                  import("./demo-data").then(({ createDemoFetcher }) => ({
                      fetcher: createDemoFetcher(mode),
                      pollMs: 8_000,
                  }))
            : null,
        portalUrl,
    );
}

/* ------------------------------------------------------------------ */

function Hero({ feed }: { feed: FeedState }) {
    const since =
        feed.data?.enabled && feed.data.since
            ? formatDay(feed.data.since)
            : null;
    return (
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
                <Kicker>FTC 19516 // Team telemetry</Kicker>
                <h1 className="mt-2 font-jockey text-6xl leading-[0.9] uppercase sm:text-7xl lg:text-8xl">
                    <span className="text-base-content">Live </span>
                    <span className="hud-title-accent">Progress</span>
                </h1>
                <p className="mt-4 max-w-xl text-base text-base-content/75 sm:text-lg">
                    Every checklist item our build, software and business teams
                    finish, streamed live from the Huskyteers Teammate Portal.
                </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
                <StatusBadge feed={feed} offDetail="public progress is off" />
                {since && (
                    <p className="font-mono text-[0.6875rem] whitespace-nowrap uppercase tracking-[0.16em] text-base-content/70">
                        Season tracking since {since}
                    </p>
                )}
            </div>
        </header>
    );
}

/* ------------------------------------------------------------------ */

function StatTile({
    icon: Icon,
    label,
    value,
    hint,
    prefix,
}: {
    icon: LucideIcon;
    label: string;
    value: number;
    hint: string;
    prefix?: string;
}) {
    return (
        <Panel as="div" className="flex flex-col justify-between gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
                <Kicker as="h3">{label}</Kicker>
                <Icon
                    className="size-4 shrink-0 text-(--hud-ink) max-sm:hidden"
                    aria-hidden="true"
                />
            </div>
            <div>
                <p className="font-mono text-3xl font-semibold tabular-nums text-base-content sm:text-4xl">
                    {prefix}
                    <AnimatedNumber value={value} />
                </p>
                <p className="mt-1 text-xs text-base-content/70">{hint}</p>
            </div>
        </Panel>
    );
}

/** The headline: what the team has done this season, then the share. */
function SeasonPanel({ data }: { data: ProgressEnabled }) {
    const t = data.totals;
    const total = t.itemsDone + t.itemsOpen;
    const toDo = t.itemsOpen - t.itemsSubmitted;
    const pending = total ? (t.itemsSubmitted / total) * 100 : 0;
    const since = data.since ? formatDay(data.since, false) : null;
    return (
        <Panel
            aria-labelledby="season-heading"
            className="flex flex-col p-6 lg:col-span-4"
        >
            <Kicker as="h2" id="season-heading">
                Season so far
            </Kicker>
            <div className="mt-4 flex flex-1 flex-col justify-between gap-6 sm:flex-row sm:items-end lg:flex-col lg:items-stretch">
                <div>
                    <p className="font-mono text-7xl leading-none font-semibold tabular-nums text-base-content sm:text-8xl">
                        <AnimatedNumber value={t.itemsDone} />
                    </p>
                    <p className="mt-2 text-base text-base-content/75">
                        checklist items done
                        {since ? (
                            <>
                                {" "}
                                since{" "}
                                <span className="whitespace-nowrap">
                                    {since}
                                </span>
                            </>
                        ) : null}
                    </p>
                    <p className="hud-chip mt-3 inline-block rounded-md px-2 py-1 font-mono text-xs font-semibold">
                        +<AnimatedNumber value={t.doneLast7Days} /> in the past
                        7 days
                    </p>
                </div>
                <div className="flex items-center gap-5">
                    <Ring
                        value={total ? t.completion : 0}
                        secondary={pending}
                        size={128}
                        stroke={9}
                        ticks={40}
                        className="hud-ring-hero shrink-0"
                        label={
                            total
                                ? `${t.completion}% of the team's checklist items done, ${t.itemsSubmitted} waiting for review, ${toDo} still to do`
                                : "No checklist items yet"
                        }
                    >
                        <span className="block font-mono text-2xl leading-none font-semibold text-base-content">
                            {total ? (
                                <>
                                    <AnimatedNumber value={t.completion} />
                                    <span className="text-sm text-base-content/70">
                                        %
                                    </span>
                                </>
                            ) : (
                                <span className="text-base-content/50">—</span>
                            )}
                        </span>
                        <span className="mt-1 block font-mono text-[0.5625rem] tracking-[0.16em] text-(--hud-ink) uppercase">
                            done
                        </span>
                    </Ring>
                    <ul className="min-w-0 space-y-1.5 text-sm text-base-content/75">
                        <li className="flex items-center gap-2">
                            <Swatch tone="done" />
                            <span>
                                <span className="font-mono font-semibold text-base-content tabular-nums">
                                    {formatNumber(t.itemsDone)}
                                </span>{" "}
                                done
                            </span>
                        </li>
                        <li className="flex items-center gap-2">
                            <Swatch tone="pending" />
                            <span>
                                <span className="font-mono font-semibold text-base-content tabular-nums">
                                    {formatNumber(t.itemsSubmitted)}
                                </span>{" "}
                                in review
                            </span>
                        </li>
                        <li className="flex items-center gap-2">
                            <Swatch tone="todo" />
                            <span>
                                <span className="font-mono font-semibold text-base-content tabular-nums">
                                    {formatNumber(toDo)}
                                </span>{" "}
                                to do
                            </span>
                        </li>
                    </ul>
                </div>
            </div>
        </Panel>
    );
}

/** "per week, last 8 weeks" / "per week since Aug 31" / "this week". */
function weeklyCaption(data: ProgressEnabled, current: boolean): string {
    const n = data.weekly.length;
    if (n === 1) {
        return current
            ? "Checklist items completed this week"
            : "Checklist items completed in the latest week";
    }
    if (n > 1 && n < 8 && data.since) {
        return `Checklist items completed per week since ${formatDay(data.since, false)}`;
    }
    return `Checklist items completed per week, last ${n || 8} weeks`;
}

function Overview({
    data,
    now,
    live,
}: {
    data: ProgressEnabled;
    now: number;
    /** The last poll worked (else the feed's dot shows reconnecting). */
    live: boolean;
}) {
    const t = data.totals;
    const lastWeek = data.weekly.at(-1)?.itemsDone ?? 0;
    const prevWeek = data.weekly.at(-2)?.itemsDone;
    const latest = data.weekly.at(-1);
    const current = latest ? isCurrentWeek(latest.weekStart, now) : false;

    return (
        <div className="mt-10 grid gap-4 lg:grid-cols-12">
            <SeasonPanel data={data} />

            {/* KPI tiles */}
            <section
                aria-labelledby="kpi-heading"
                className="grid auto-rows-fr grid-cols-2 gap-4 lg:col-span-5"
            >
                <h2 id="kpi-heading" className="sr-only">
                    Team totals
                </h2>
                <StatTile
                    icon={Hourglass}
                    label="In review"
                    value={t.itemsSubmitted}
                    hint="Checked off, a leader reviews next"
                />
                <StatTile
                    icon={Activity}
                    label="Active tasks"
                    value={t.tasksActive}
                    hint="Being worked on now"
                />
                <StatTile
                    icon={Trophy}
                    label="Tasks finished"
                    value={t.tasksFinished}
                    hint="Fully wrapped up"
                />
                <StatTile
                    icon={Users}
                    label="Students"
                    value={t.people}
                    hint="Across all subteams"
                />
            </section>

            {/* Recent completions: spans both rows on desktop */}
            <Panel
                aria-labelledby="feed-heading"
                className="relative lg:col-span-3 lg:row-span-2"
            >
                <div className="flex h-full flex-col p-4 lg:absolute lg:inset-0">
                    <div className="mb-2 flex items-center justify-between px-1">
                        <Kicker as="h2" id="feed-heading">
                            Recent completions
                        </Kicker>
                        <LiveDot tone={live ? "live" : "warn"} />
                    </div>
                    <RecentFeed
                        recent={data.recent}
                        subteams={data.subteams}
                        now={now}
                        labelledBy="feed-heading"
                    />
                </div>
            </Panel>

            {/* Weekly throughput */}
            <Panel
                aria-labelledby="weekly-heading"
                className="p-5 lg:col-span-9"
            >
                <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <Kicker as="h2" id="weekly-heading">
                            Weekly throughput
                        </Kicker>
                        <p className="mt-1 text-sm text-base-content/70">
                            {weeklyCaption(data, current)}
                        </p>
                    </div>
                    <div className="flex items-baseline gap-3 sm:block sm:text-right">
                        <p className="font-mono text-3xl font-semibold tabular-nums text-base-content">
                            <AnimatedNumber value={lastWeek} />
                        </p>
                        <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-base-content/70">
                            {current ? "this week" : "latest week"}
                            {prevWeek !== undefined && (
                                <span className="ml-1.5 whitespace-nowrap">
                                    · {current ? "last wk" : "week before"}{" "}
                                    <span className="text-(--hud-ink)">
                                        {formatNumber(prevWeek)}
                                    </span>
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <WeeklyChart weekly={data.weekly} now={now} />
            </Panel>
        </div>
    );
}

/* ------------------------------------------------------------------ */

function Skeleton() {
    return (
        <div className="mt-10 grid gap-4 lg:grid-cols-12" aria-hidden="true">
            <div className="hud-panel hud-skeleton h-[23rem] lg:col-span-4" />
            <div className="grid grid-cols-2 gap-4 lg:col-span-5">
                {Array.from({ length: 4 }, (_, i) => (
                    <div
                        key={i}
                        className="hud-panel hud-skeleton h-[7.25rem] lg:h-[11.25rem]"
                    />
                ))}
            </div>
            <div className="hud-panel hud-skeleton h-[23rem] lg:col-span-3" />
        </div>
    );
}

/** Polite screen-reader text; the DOM only changes when the numbers do. */
function announcementFor(feed: FeedState): string {
    const data = feed.data;
    if (!data && feed.status === "error") {
        return "Live data unavailable, retrying.";
    }
    if (!data) return "";
    if (!data.enabled) return "Team progress is private right now.";
    const t = data.totals;
    return `Team progress updated: ${t.itemsDone} items done, ${t.doneLast7Days} in the past 7 days, ${t.itemsSubmitted} waiting for review.`;
}

export default function LiveProgress({ portalUrl }: { portalUrl: string }) {
    const source = useSource(portalUrl);
    const feed = useProgressFeed(source?.fetcher ?? null, source?.pollMs);
    // Coarse clock for relative times inside cards and the feed.
    const now = useNow(15_000);
    const announcement = announcementFor(feed);
    const data = feed.data;
    const live = feed.status === "live";

    const body = useMemo(() => {
        if (data?.enabled) {
            return (
                <>
                    <Overview data={data} now={now} live={live} />
                    <TeamBoard
                        subteams={data.subteams}
                        people={data.people}
                        now={now}
                    />
                    <footer className="mt-14 border-t border-base-content/10 pt-6 font-mono text-[0.6875rem] leading-relaxed uppercase tracking-wider text-base-content/70">
                        <p>
                            Counts are checklist items on tasks since{" "}
                            {data.since
                                ? formatDay(data.since)
                                : "the start of the season"}
                            . An item counts as done once a team leader approves
                            it; until then it&rsquo;s in review.
                        </p>
                        <p className="mt-1">
                            Refreshes every 30 seconds · Source: Huskyteers
                            Teammate Portal
                        </p>
                    </footer>
                </>
            );
        }
        if (data && !data.enabled) {
            return (
                <Notice icon={Lock} title="Progress is private right now">
                    <p>
                        The team has paused its public progress page. Check back
                        soon!
                    </p>
                </Notice>
            );
        }
        return null;
    }, [data, now, live]);

    return (
        <div className="hud hud-bg">
            <div className="hud-sweep" aria-hidden="true" />
            <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-16 sm:px-6 lg:px-8 lg:pt-14">
                <Hero feed={feed} />

                <DemoTag mode={source?.demo} />

                <StaleBanner feed={feed} onRetry={feed.retryNow} />

                {body ??
                    (feed.status === "error" ? (
                        <UnavailableNotice onRetry={feed.retryNow} />
                    ) : (
                        <Skeleton />
                    ))}

                <p className="sr-only" aria-live="polite" aria-atomic="true">
                    {announcement}
                </p>
            </div>
        </div>
    );
}
