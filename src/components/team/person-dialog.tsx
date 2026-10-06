/**
 * The Our Team page's profile dialog: photo (the person's own portal photo
 * laid over the build-time one or initials, unless team.astro set an
 * explicit `image`), name, positions (from
 * team.astro), subteam, live stats from the public progress feed, and — from
 * GET /api/public/progress/people/{id} — their last 8 weeks and the tasks
 * they finished. A native modal <dialog>: focus moves in on open and back to
 * the card on close (or to the live band / page heading when there's no
 * card), Esc / the close button / a backdrop click close it, the page behind
 * is scroll-locked.
 *
 * What it shows about someone always follows the portal right now: once the
 * team feed stops listing them (they hid themselves, progress went private,
 * the name style changed) their numbers and list disappear from an open
 * profile too, and a "not public" answer from the per-person endpoint (a
 * 404: profiles off, or they just hid) drops the list and stops asking.
 */
import {
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    type RefObject,
} from "react";
import {
    ArrowRight,
    CheckCheck,
    CircleCheck,
    Layers,
    RefreshCw,
    X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
    formatDay,
    formatNumber,
    initials,
} from "../progress/format";
import { AnimatedNumber, Kicker, Panel, Ring, Swatch } from "../progress/hud";
import { subteamMeta } from "../progress/subteam-meta";
import type { ProgressPerson, ProgressSubteam } from "../progress/types";
import { useLiveFeed } from "../progress/use-live-feed";
import { isCurrentWeek } from "../progress/weekly-chart";
import {
    doneDate,
    doneTitle,
    fullDate,
    itemsLabel,
    joinRoles,
    lastDoneAgo,
    niceTop,
    weeklyTotal,
} from "./format";
import {
    MAX_DONE,
    parsePersonDetail,
    type PersonDetailEnabled,
    type PersonDone,
} from "./person-detail";
import { PortalPhoto } from "./portal-photo";
import { firstName, subteamsFromRoles } from "./roster";
import type { DetailFetcherFor, PhotoSet } from "./team-live";

/** The team feed's state, as far as one profile is concerned. */
export type LiveStatus = "loading" | "on" | "off" | "error";

export interface ProfileView {
    slug: string;
    name: string;
    roles: string[];
    lead: boolean;
    photo: PhotoSet | null;
    /**
     * Their own photo from the Teammate Portal, shown over `photo` (null:
     * none, or an explicit `image` in team.astro wins — see `shownPhoto`).
     */
    portalPhoto: string | null;
    /** Their entry in the public progress feed, when matched. */
    live: ProgressPerson | null;
    /** false: only in the portal (not in team.astro yet). */
    onPage: boolean;
}

/* ---------- Scroll lock (page behind the modal) ---------- */

let savedScroll: { overflow: string; paddingRight: string } | null = null;

function lockScroll() {
    if (savedScroll) return;
    const html = document.documentElement;
    const gap = window.innerWidth - html.clientWidth;
    savedScroll = {
        overflow: html.style.overflow,
        paddingRight: document.body.style.paddingRight,
    };
    html.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
}

function unlockScroll() {
    if (!savedScroll) return;
    document.documentElement.style.overflow = savedScroll.overflow;
    document.body.style.paddingRight = savedScroll.paddingRight;
    savedScroll = null;
}

/* ---------- Pieces ---------- */

function Avatar({
    view,
    className,
}: {
    view: ProfileView;
    className?: string;
}) {
    return (
        <span
            className={cn(
                "team-photo team-photo-xl",
                view.lead && "team-photo-lead",
                className,
            )}
        >
            {view.photo ? (
                <img
                    src={view.photo.src}
                    srcSet={view.photo.srcSet || undefined}
                    width={view.photo.width}
                    height={view.photo.height}
                    // The name is the dialog's heading right next to it.
                    alt=""
                    decoding="async"
                />
            ) : (
                <span className="team-initials" aria-hidden="true">
                    {initials(view.name)}
                </span>
            )}
            {view.portalPhoto && (
                <span className="team-photo-portal">
                    <PortalPhoto
                        key={view.portalPhoto}
                        src={view.portalPhoto}
                        lazy={false}
                    />
                </span>
            )}
        </span>
    );
}

function SubteamLine({ keys, subteams }: { keys: string[]; subteams: ProgressSubteam[] }) {
    if (keys.length === 0) {
        return (
            <li className="flex items-center gap-2">
                <span className="hud-icon grid size-7 shrink-0 place-items-center rounded-md">
                    <Layers className="size-3.5" aria-hidden="true" />
                </span>
                <span>
                    <span className="font-semibold text-base-content">Team-wide</span>
                    <span className="text-base-content/70"> · works across every subteam</span>
                </span>
            </li>
        );
    }
    return (
        <>
            {keys.map((key) => {
                const meta = subteamMeta(
                    key,
                    subteams.find((s) => s.key === key)?.name,
                );
                const Icon = meta.icon;
                return (
                    <li key={key} className="flex items-center gap-2">
                        <span className="hud-icon grid size-7 shrink-0 place-items-center rounded-md">
                            <Icon className="size-3.5" aria-hidden="true" />
                        </span>
                        <span>
                            <span className="font-semibold text-base-content">
                                {meta.label}
                            </span>
                            {meta.blurb && (
                                <span className="text-base-content/70">
                                    {" "}
                                    · {meta.blurb}
                                </span>
                            )}
                        </span>
                    </li>
                );
            })}
        </>
    );
}

function SectionTitle({
    id,
    children,
    aside,
}: {
    id: string;
    children: ReactNode;
    aside?: ReactNode;
}) {
    return (
        <div className="mb-3 flex items-baseline justify-between gap-3">
            <Kicker as="h3" id={id}>
                {children}
            </Kicker>
            {aside && (
                <span className="font-mono text-[0.6875rem] tabular-nums text-base-content/70">
                    {aside}
                </span>
            )}
        </div>
    );
}

/* ---------- Live stats ---------- */

function StatsPanel({
    person,
    now,
    headingId,
}: {
    person: ProgressPerson;
    now: number;
    headingId: string;
}) {
    const total = person.itemsDone + person.itemsOpen;
    const toDo = person.itemsOpen - person.itemsSubmitted;
    const pending = total ? (person.itemsSubmitted / total) * 100 : 0;
    return (
        <Panel as="section" aria-labelledby={headingId} className="p-4 sm:p-5">
            <SectionTitle id={headingId}>Live stats</SectionTitle>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                <Ring
                    value={total ? person.completion : 0}
                    secondary={pending}
                    size={104}
                    stroke={8}
                    className="shrink-0"
                    label={
                        total
                            ? `${person.completion}% of their checklist items done, ${person.itemsSubmitted} waiting for review, ${toDo} to do`
                            : "No checklist items yet"
                    }
                >
                    <span className="block font-mono text-2xl leading-none font-semibold tabular-nums text-base-content">
                        {total ? (
                            <>
                                <AnimatedNumber value={person.completion} />
                                <span className="text-sm text-base-content/70">%</span>
                            </>
                        ) : (
                            <span className="text-base-content/50">—</span>
                        )}
                    </span>
                    <span className="mt-1 block font-mono text-[0.5625rem] tracking-[0.16em] text-(--hud-ink) uppercase">
                        done
                    </span>
                </Ring>
                <ul
                    className="min-w-0 flex-1 space-y-1.5"
                    aria-label="Their checklist items"
                >
                    {(
                        [
                            ["done", "done", person.itemsDone],
                            ["pending", "in review", person.itemsSubmitted],
                            ["todo", "to do", toDo],
                        ] as const
                    ).map(([tone, label, value]) => (
                        <li key={tone} className="flex items-center gap-2.5">
                            <Swatch tone={tone} />
                            <span className="min-w-[2.5ch] font-mono text-xl leading-tight font-semibold tabular-nums text-base-content">
                                <AnimatedNumber value={value} />
                            </span>
                            <span className="text-sm text-base-content/75">{label}</span>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-base-content/10 pt-3 font-mono text-xs tabular-nums text-base-content/75">
                <span
                    className={cn(
                        "rounded px-1.5 py-0.5",
                        person.doneLast7Days > 0
                            ? "hud-chip font-semibold"
                            : "border border-base-content/15 text-base-content/70",
                    )}
                >
                    +{formatNumber(person.doneLast7Days)} in the past 7 days
                </span>
                <span>
                    Last done{" "}
                    {person.lastDoneAt ? (
                        <time
                            dateTime={person.lastDoneAt}
                            title={fullDate(person.lastDoneAt)}
                            className="font-semibold text-base-content"
                        >
                            {lastDoneAgo(person.lastDoneAt, now)}
                        </time>
                    ) : (
                        <span className="font-semibold text-base-content">—</span>
                    )}
                </span>
            </div>
        </Panel>
    );
}

/* ---------- 8-week mini chart ---------- */

function WeekBars({
    weekly,
    now,
}: {
    weekly: PersonDetailEnabled["weekly"];
    now: number;
}) {
    const [active, setActive] = useState<number | null>(null);
    const n = weekly.length;
    if (n === 0) {
        return (
            <p className="py-6 text-center font-mono text-xs text-base-content/70">
                No weekly data yet.
            </p>
        );
    }
    const values = weekly.map((w) => w.itemsDone);
    const max = Math.max(...values);
    const top = niceTop(max);
    const last = n - 1;
    const partial = isCurrentWeek(weekly[last].weekStart, now);
    const peak = max > 0 ? values.indexOf(max) : -1;
    const label = (i: number) =>
        i === last && partial ? "This wk" : formatDay(weekly[i].weekStart, false);
    const describe = (i: number) =>
        `${i === last && partial ? "This week so far" : `Week of ${formatDay(weekly[i].weekStart)}`}: ${formatNumber(values[i])} done`;

    return (
        <div className="pt-4">
            <div className="relative h-28">
                <div
                    className="pointer-events-none absolute top-0 right-0 left-7 border-t border-base-content/10"
                    aria-hidden="true"
                />
                <span
                    className="pointer-events-none absolute top-0 left-0 w-6 -translate-y-1/2 text-right font-mono text-[0.625rem] tabular-nums text-base-content/60"
                    aria-hidden="true"
                >
                    {formatNumber(top)}
                </span>
                <span
                    className="pointer-events-none absolute bottom-0 left-0 w-6 translate-y-1/2 text-right font-mono text-[0.625rem] tabular-nums text-base-content/60"
                    aria-hidden="true"
                >
                    0
                </span>
                <div
                    className="pointer-events-none absolute right-0 bottom-0 left-7 border-t border-base-content/25"
                    aria-hidden="true"
                />
                <div className="absolute inset-y-0 right-0 left-7 flex items-end gap-0.5">
                    {weekly.map((w, i) => {
                        const h = (values[i] / top) * 100;
                        const showValue =
                            values[i] > 0 && (i === last || i === peak || active === i);
                        return (
                            <div
                                key={w.weekStart}
                                className="relative flex h-full min-w-0 flex-1 items-end justify-center"
                                onMouseEnter={() => setActive(i)}
                                onMouseLeave={() => setActive(null)}
                                aria-hidden="true"
                            >
                                <span
                                    className={cn(
                                        "team-bar block w-full max-w-6",
                                        i === last && partial && "team-bar-partial",
                                        active === i && "team-bar-active",
                                    )}
                                    style={{ height: values[i] ? `max(${h}%, 3px)` : "0" }}
                                />
                                {showValue && (
                                    <span
                                        className="absolute left-1/2 -translate-x-1/2 font-mono text-[0.6875rem] leading-none font-semibold tabular-nums text-base-content"
                                        style={{ bottom: `calc(${h}% + 4px)` }}
                                    >
                                        {formatNumber(values[i])}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
                {active !== null && (
                    <div
                        className="hud-tooltip pointer-events-none absolute -top-11 z-10 rounded-md px-2 py-1 font-mono text-[0.6875rem] whitespace-nowrap"
                        style={{
                            left: `calc(1.75rem + (100% - 1.75rem) * ${Math.min(0.78, Math.max(0.22, (active + 0.5) / n))})`,
                            transform: "translateX(-50%)",
                        }}
                        aria-hidden="true"
                    >
                        {describe(active)}
                    </div>
                )}
            </div>
            <div className="mt-1.5 flex gap-0.5 pl-7" aria-hidden="true">
                {weekly.map((w, i) => (
                    <span
                        key={w.weekStart}
                        className={cn(
                            "min-w-0 flex-1 text-center font-mono text-[0.5625rem] whitespace-nowrap uppercase text-base-content/65 sm:text-[0.625rem]",
                            (last - i) % 2 === 1 && "max-sm:invisible",
                            i === last && "text-(--hud-ink)",
                        )}
                    >
                        {label(i)}
                    </span>
                ))}
            </div>
            <table className="sr-only">
                <caption>Checklist items they finished per week</caption>
                <thead>
                    <tr>
                        <th scope="col">Week starting</th>
                        <th scope="col">Items done</th>
                    </tr>
                </thead>
                <tbody>
                    {weekly.map((w, i) => (
                        <tr key={w.weekStart}>
                            <td>
                                {formatDay(w.weekStart)}
                                {i === last && partial ? " (in progress)" : ""}
                            </td>
                            <td>{w.itemsDone}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ---------- Finished tasks ---------- */

function DoneRow({
    item,
    subteams,
    now,
}: {
    item: PersonDone;
    subteams: ProgressSubteam[];
    now: number;
}) {
    const meta = item.subteam
        ? subteamMeta(item.subteam, subteams.find((s) => s.key === item.subteam)?.name)
        : null;
    const Icon = meta?.icon;
    return (
        <li className="team-done-row flex gap-3 py-2.5">
            <span className="hud-feed-node mt-0.5 grid size-6 shrink-0 place-items-center rounded-full">
                <CircleCheck className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
                <p
                    className={cn(
                        "text-sm leading-snug break-words",
                        item.title
                            ? "font-medium text-base-content"
                            : "text-base-content/70 italic",
                    )}
                >
                    {doneTitle(item.title)}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.6875rem] text-base-content/70">
                    {meta && Icon && (
                        <span className="inline-flex items-center gap-1">
                            <Icon className="size-3" aria-hidden="true" />
                            {meta.label}
                        </span>
                    )}
                    {meta && <span aria-hidden="true">·</span>}
                    <time dateTime={item.at} title={fullDate(item.at)}>
                        {doneDate(item.at, now)}
                    </time>
                    {item.withTask && (
                        <span
                            className="team-whole-task inline-flex items-center gap-1 rounded px-1.5 py-px"
                            title="Counted when the whole task was marked finished"
                        >
                            <CheckCheck className="size-3" aria-hidden="true" />
                            Whole task
                        </span>
                    )}
                </p>
            </div>
        </li>
    );
}

function TasksSkeleton() {
    return (
        <ul className="space-y-3 py-1" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="flex gap-3">
                    <span className="team-skel size-6 shrink-0 rounded-full" />
                    <span className="flex-1 space-y-1.5">
                        <span
                            className="team-skel block h-3.5 rounded"
                            style={{ width: `${80 - i * 9}%` }}
                        />
                        <span className="team-skel block h-2.5 w-1/3 rounded" />
                    </span>
                </li>
            ))}
        </ul>
    );
}

/* ---------- Dialog body ---------- */

function DialogBody({
    view,
    titleId,
    liveStatus,
    subteams,
    since,
    detailFetcherFor,
    now,
    onClose,
}: {
    view: ProfileView;
    titleId: string;
    liveStatus: LiveStatus;
    subteams: ProgressSubteam[];
    since: string;
    detailFetcherFor: DetailFetcherFor | null;
    now: number;
    onClose: () => void;
}) {
    const uid = useId();
    const liveId = view.live?.id ?? null;
    const fetcher = useMemo(
        () => (liveId && detailFetcherFor ? detailFetcherFor(liveId) : null),
        [liveId, detailFetcherFor],
    );
    const detail = useLiveFeed(fetcher, {
        parse: (raw) => parsePersonDetail(raw, liveId ?? undefined),
        pollMs: 30_000,
        updatedAt: (d) => (d.enabled ? d.updatedAt : null),
        // "Not public" (personDetailFetcher's answer to a 404) is final.
        final: (d) => !d.enabled,
    });
    // Only an answer about the person the team feed matches right now —
    // never a previous answer once they've left the feed.
    const d =
        liveId && detail.data?.enabled && detail.data.person.id === liveId
            ? detail.data
            : null;
    // The portal says their profile isn't public (profiles off, or they just
    // hid): the team feed's numbers still show, the list doesn't.
    const notShared = liveId !== null && detail.data?.enabled === false;
    const person = view.live ? (d?.person ?? view.live) : null;
    const first = firstName(view.name);

    const subteamKeys = person
        ? person.subteam
            ? [person.subteam]
            : []
        : subteamsFromRoles(view.roles);
    const roles = view.roles.length ? view.roles : person?.role ? [person.role] : [];
    const titlesHidden = d ? d.done.length > 0 && d.done.every((x) => x.title === null) : false;
    const anyWholeTask = d ? d.done.some((x) => x.withTask) : false;
    const sinceLabel = (d?.since || since) ? formatDay(d?.since || since) : null;

    let liveBlock: ReactNode;
    if (person && notShared) {
        liveBlock = (
            <div className="flex flex-col gap-4">
                <StatsPanel person={person} now={now} headingId={`${uid}-stats`} />
                <Panel as="div" className="flex items-center gap-3 p-4 sm:p-5">
                    <span className="hud-icon grid size-9 shrink-0 place-items-center rounded-lg">
                        <Layers className="size-4" aria-hidden="true" />
                    </span>
                    <p className="text-sm text-base-content/75">
                        {first}&rsquo;s finished tasks and weekly numbers
                        aren&rsquo;t shared on the website right now.
                    </p>
                </Panel>
            </div>
        );
    } else if (person) {
        liveBlock = (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                <div className="flex min-w-0 flex-col gap-4">
                    <StatsPanel person={person} now={now} headingId={`${uid}-stats`} />
                    <Panel as="section" aria-labelledby={`${uid}-weeks`} className="p-4 sm:p-5">
                        <SectionTitle
                            id={`${uid}-weeks`}
                            aside={d ? itemsLabel(weeklyTotal(d.weekly)) : undefined}
                        >
                            {d && d.weekly.length > 0 && d.weekly.length < 8
                                ? `Per week, last ${d.weekly.length}`
                                : "Per week, last 8"}
                        </SectionTitle>
                        {d ? (
                            <WeekBars weekly={d.weekly} now={now} />
                        ) : detail.status === "error" ? (
                            <p className="py-6 text-center font-mono text-xs text-base-content/70">
                                Weekly numbers unavailable.
                            </p>
                        ) : (
                            <div className="team-skel h-32 rounded-lg" aria-hidden="true" />
                        )}
                    </Panel>
                </div>
                <Panel
                    as="section"
                    aria-labelledby={`${uid}-done`}
                    className="relative min-h-[14rem] min-w-0"
                >
                    <div className="flex flex-col p-4 sm:p-5 lg:absolute lg:inset-0">
                        <SectionTitle
                            id={`${uid}-done`}
                            aside={
                                d && d.done.length > 0
                                    ? d.done.length >= MAX_DONE
                                        ? `Latest ${MAX_DONE}`
                                        : itemsLabel(d.done.length)
                                    : undefined
                            }
                        >
                            What {first} finished
                        </SectionTitle>
                        <div className="team-scroll hud-feed min-h-0 flex-1 lg:overflow-y-auto lg:pr-1">
                            {d ? (
                                d.done.length > 0 ? (
                                    <ol aria-labelledby={`${uid}-done`}>
                                        {d.done.map((item, i) => (
                                            <DoneRow
                                                key={`${item.at}-${i}`}
                                                item={item}
                                                subteams={subteams}
                                                now={now}
                                            />
                                        ))}
                                    </ol>
                                ) : (
                                    <div className="flex flex-col items-center px-2 py-8 text-center">
                                        <span className="hud-icon grid size-10 place-items-center rounded-xl">
                                            <CircleCheck className="size-5" aria-hidden="true" />
                                        </span>
                                        <p className="mt-3 font-semibold text-base-content">
                                            No tasks recorded in the portal yet
                                        </p>
                                        <p className="mt-1 text-sm text-base-content/70">
                                            Finished checklist items show up here once a leader approves them.
                                        </p>
                                    </div>
                                )
                            ) : detail.status === "error" ? (
                                <div className="flex flex-col items-center px-2 py-8 text-center">
                                    <p className="font-semibold text-base-content">
                                        Couldn&rsquo;t load {first}&rsquo;s tasks
                                    </p>
                                    <p className="mt-1 text-sm text-base-content/70">
                                        The team portal didn&rsquo;t answer. Retrying…
                                    </p>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm mt-3 font-mono uppercase"
                                        onClick={detail.retryNow}
                                    >
                                        <RefreshCw className="size-3.5" aria-hidden="true" />
                                        Retry now
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <span className="sr-only" role="status">
                                        Loading {first}&rsquo;s tasks…
                                    </span>
                                    <TasksSkeleton />
                                </>
                            )}
                        </div>
                        {(anyWholeTask || titlesHidden) && (
                            <ul className="mt-3 space-y-1 border-t border-base-content/10 pt-3 font-mono text-[0.6875rem] text-base-content/70">
                                {anyWholeTask && (
                                    <li className="flex items-start gap-1.5">
                                        <CheckCheck className="mt-px size-3 shrink-0" aria-hidden="true" />
                                        Whole task: counted when a leader marked the whole task finished.
                                    </li>
                                )}
                                {titlesHidden && <li>The team keeps task titles private.</li>}
                            </ul>
                        )}
                    </div>
                </Panel>
            </div>
        );
    } else {
        const message =
            liveStatus === "loading"
                ? null
                : liveStatus === "off"
                  ? "The team's live progress is private right now."
                  : liveStatus === "error"
                    ? "Live stats are unavailable right now. The team portal didn't answer."
                    : `No live portal stats for ${first} right now.`;
        liveBlock = message ? (
            <Panel as="div" className="flex items-center gap-3 p-4 sm:p-5">
                <span className="hud-icon grid size-9 shrink-0 place-items-center rounded-lg">
                    <Layers className="size-4" aria-hidden="true" />
                </span>
                <p className="text-sm text-base-content/75">{message}</p>
            </Panel>
        ) : (
            <div className="hud-panel hud-skeleton h-40" aria-hidden="true" />
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <header className="team-dialog-head flex shrink-0 items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
                <Kicker className="truncate">FTC 19516 // Teammate profile</Kicker>
                <button
                    type="button"
                    className="team-icon-btn grid size-10 shrink-0 place-items-center rounded-full"
                    onClick={onClose}
                    aria-label="Close"
                >
                    <X className="size-5" aria-hidden="true" />
                </button>
            </header>

            <div className="team-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <section className="flex items-center gap-4 px-4 pt-5 pb-5 sm:gap-7 sm:px-6 sm:pt-6">
                    <Avatar view={view} />
                    <div className="min-w-0 flex-1">
                        <h2
                            id={titleId}
                            className="font-jockey text-3xl leading-[0.95] break-words uppercase text-base-content outline-none sm:text-5xl"
                            tabIndex={-1}
                            data-initial-focus
                        >
                            {view.name}
                        </h2>
                        {roles.length > 0 && (
                            <>
                                <h3 className="sr-only">Positions</h3>
                                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Positions">
                                    {roles.map((r) => (
                                        <li
                                            key={r}
                                            className={cn(
                                                "team-role rounded-md px-2 py-1 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider",
                                                /lead|captain/i.test(r) && "team-role-lead",
                                            )}
                                        >
                                            {r}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                        <ul className="mt-3 space-y-1.5 text-sm" aria-label="Subteam">
                            <SubteamLine keys={subteamKeys} subteams={subteams} />
                        </ul>
                    </div>
                </section>

                <div className="px-4 pb-5 sm:px-6">{liveBlock}</div>

                <footer className="flex flex-col gap-3 border-t border-base-content/10 px-4 py-4 font-mono text-[0.6875rem] leading-relaxed text-base-content/70 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <p className="max-w-xl uppercase tracking-wider">
                        {person
                            ? `Checklist items on tasks since ${sinceLabel ?? "the start of the season"}. Done = approved by a team leader.`
                            : `${joinRoles(roles) || "Teammate"} · FTC 19516 The Huskyteers`}
                    </p>
                    <a href="/progress" className="team-dash-link shrink-0 normal-case">
                        Whole team, live
                        <ArrowRight className="size-4" aria-hidden="true" />
                    </a>
                </footer>
            </div>
        </div>
    );
}

/* ---------- Dialog shell ---------- */

/**
 * Where focus goes when there's no card to return to (a profile opened from
 * a link for someone not on the page): the live band's heading, else the
 * page's heading — never <body>.
 */
function fallbackFocus(): HTMLElement | null {
    const el =
        document.getElementById("team-live-heading") ??
        document.querySelector<HTMLElement>("main h1");
    if (el && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    return el;
}

export function PersonDialog({
    view,
    liveStatus,
    subteams,
    since,
    detailFetcherFor,
    now,
    returnFocus,
    onClosed,
}: {
    view: ProfileView | null;
    liveStatus: LiveStatus;
    subteams: ProgressSubteam[];
    since: string;
    detailFetcherFor: DetailFetcherFor | null;
    now: number;
    /** The card that opened it (focus goes back there). */
    returnFocus: RefObject<HTMLElement | null>;
    /** A close that started here (Esc, backdrop, close button). */
    onClosed: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const openSlug = useRef<string | null>(null);
    const downOnBackdrop = useRef(false);

    // Layout effect: open/close before paint so the content never flashes.
    useLayoutEffect(() => {
        const dlg = ref.current;
        if (!dlg) return;
        if (view) {
            if (!dlg.open) {
                if (!returnFocus.current) {
                    const active = document.activeElement;
                    returnFocus.current =
                        active instanceof HTMLElement && active !== document.body
                            ? active
                            : null;
                }
                lockScroll();
                dlg.showModal();
                // Start on the name (read out first), not on the close
                // button; Tab / Shift+Tab reach everything else.
                dlg.querySelector<HTMLElement>("[data-initial-focus]")?.focus({
                    preventScroll: true,
                });
            }
            openSlug.current = view.slug;
        } else if (dlg.open) {
            dlg.close();
        }
    }, [view]);

    useEffect(() => unlockScroll, []);

    const handleClose = () => {
        unlockScroll();
        const slug = openSlug.current;
        openSlug.current = null;
        const target =
            (returnFocus.current?.isConnected === true
                ? returnFocus.current
                : slug
                  ? document.querySelector<HTMLElement>(
                        `[data-person-card][data-slug="${CSS.escape(slug)}"]`,
                    )
                  : null) ?? fallbackFocus();
        returnFocus.current = null;
        target?.focus();
        onClosed();
    };

    return (
        <dialog
            ref={ref}
            className="team-dialog"
            aria-labelledby={titleId}
            onClose={handleClose}
            onPointerDown={(e) => {
                downOnBackdrop.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
                // The content fills the dialog box: a click on the dialog
                // element itself is a click on the backdrop.
                if (e.target === e.currentTarget && downOnBackdrop.current) {
                    e.currentTarget.close();
                }
                downOnBackdrop.current = false;
            }}
        >
            {view && (
                <DialogBody
                    key={view.slug}
                    view={view}
                    titleId={titleId}
                    liveStatus={liveStatus}
                    subteams={subteams}
                    since={since}
                    detailFetcherFor={detailFetcherFor}
                    now={now}
                    onClose={() => ref.current?.close()}
                />
            )}
        </dialog>
    );
}
