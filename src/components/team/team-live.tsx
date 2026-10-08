/**
 * The live layer of the Our Team page (src/pages/about/team.astro). The
 * cards themselves are static HTML from Person.astro; this island adds:
 *
 * - the "Team progress — live" band (season total, past 7 days, one meter
 *   per subteam, a link to /progress), polled every 30 s like /progress;
 * - a small "12 done" meter in each card whose person matches someone in the
 *   portal's public progress (`matchLive`: same name, ignoring case, spaces
 *   and accents — only while the portal shows full names), rendered into the
 *   card's empty `[data-live-slot]` with a portal;
 * - each person's own photo from the Teammate Portal
 *   (GET /api/public/team-photos, ./use-team-photos.ts), matched by full
 *   name like the live numbers and laid over the card's empty
 *   `[data-photo-slot]` and the profile's avatar. Precedence (`shownPhoto`):
 *   the entry's explicit `image` in team.astro > the portal photo > the
 *   build-time folder photo > initials. Cards with an explicit `image` have
 *   no slot;
 * - the profile dialog: clicking a card (a real <button>) opens it, and
 *   ?person=<slug> opens it on load and is kept in the URL while it's open
 *   (history.replaceState), so a profile can be shared. A slug that isn't on
 *   the page but is someone in the live progress (not added to team.astro
 *   yet) still opens, with what the portal knows.
 *
 * Dev only: ?demo=1 (and ?demo=notitles | hidden | private | error | empty |
 * nodetail | detailerror | slow | leave, plus nophotos | photoerror for the
 * photos) uses ./demo-data.ts and ./demo-photos.ts instead of the portal.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ChevronDown, RefreshCw, WifiOff } from "lucide-react";
import { cn } from "../../lib/utils";
import { DemoTag, StatusBadge } from "../progress/feed-ui";
import { formatDay, formatNumber } from "../progress/format";
import { AnimatedNumber, Kicker, Meter, Panel } from "../progress/hud";
import { subteamMeta } from "../progress/subteam-meta";
import type { ProgressEnabled, ProgressPerson } from "../progress/types";
import {
    portalJsonFetcher,
    useDemoOrLive,
    type JsonFetcher,
} from "../progress/use-live-feed";
import {
    portalFetcher,
    useNow,
    useProgressFeed,
    type FeedState,
} from "../progress/use-progress-feed";
import type { ShownBadge } from "./badges";
import { doneLabel, liveSummary } from "./format";
import { personDetailFetcher, personDetailPath } from "./person-detail";
import { PersonDialog, type LiveStatus, type ProfileView } from "./person-dialog";
import { PortalPhoto } from "./portal-photo";
import { teamPhotoKey } from "./name-key";
import {
    portalPhotoFor,
    portalPhotoForKey,
    shownPhoto,
    teamPhotosFetcher,
    type BuildPhotoSource,
    type PhotoIndex,
} from "./portal-photos";
import {
    liveBySlug,
    matchLive,
    personFromSearch,
    withPersonParam,
} from "./roster";
import { livePhotosFetcher, useTeamPhotos } from "./use-team-photos";

/** A photo rendition made at build time (see photos.ts). */
export interface PhotoSet {
    src: string;
    srcSet: string;
    width: number;
    height: number;
}

/**
 * One person on the page, as team.astro hands them over. Never their full
 * name: `name` is the short one shown ("Tommy H."), `key` the portal's hash
 * of the full name (`teamPhotoKey`), used to find their live numbers and
 * portal photo.
 */
export interface RosterCard {
    slug: string;
    name: string;
    key: string | null;
    /** Dev builds only (the ?demo=1 mock data is made from full names). */
    devName?: string;
    roles: string[];
    lead: boolean;
    /** Their badges from team.astro, ready to draw. */
    badges: ShownBadge[];
    /** The large (dialog) photo, or null for initials. */
    photo: PhotoSet | null;
    /** Where `photo` came from ("image" wins over the portal photo). */
    photoSource: BuildPhotoSource;
}

export type DetailFetcherFor = (id: string) => JsonFetcher | null;

type Source = {
    fetcher: JsonFetcher;
    detailFetcher: DetailFetcherFor;
    pollMs?: number;
    /** GET /api/public/team-photos. */
    photosFetcher: JsonFetcher;
    /** Dev demo only: where a photo URL actually loads from. */
    photoSrc?: (url: string) => string;
};

function useSource(portalUrl: string, roster: RosterCard[]) {
    return useDemoOrLive<Source>(
        () => ({
            fetcher: portalFetcher(portalUrl),
            detailFetcher: (id) => {
                const path = personDetailPath(id);
                // Same 15 s CDN window as the team feed; the portal's 404
                // ("not public") becomes { enabled: false }, not an outage.
                return path
                    ? personDetailFetcher(portalJsonFetcher(portalUrl, path, 15_000))
                    : null;
            },
            photosFetcher: livePhotosFetcher(portalUrl),
        }),
        import.meta.env.DEV
            ? (mode) =>
                  Promise.all([
                      import("./demo-data"),
                      import("./demo-photos"),
                  ]).then(([{ createTeamDemo }, { createDemoPhotos }]) => {
                      const demo = createTeamDemo(
                          mode,
                          roster.map((r) => ({ name: r.devName ?? r.name, roles: r.roles })),
                      );
                      // The page's names plus the portal-only demo person.
                      const photos = createDemoPhotos(mode, [
                          ...roster.map((r) => r.devName ?? r.name),
                          "Avery Lin",
                      ]);
                      return {
                          ...demo,
                          detailFetcher: (id: string) => {
                              const f = demo.detailFetcher(id);
                              return f ? personDetailFetcher(f) : null;
                          },
                          photosFetcher: teamPhotosFetcher(photos.fetcher),
                          photoSrc: photos.photoSrc,
                      };
                  })
            : null,
        portalUrl,
    );
}

/* ------------------------------------------------------------------ */
/* Card meters                                                         */
/* ------------------------------------------------------------------ */

/** The card's live line: a thin meter and "12 done" (spans only: it sits in a <button>). */
function CardMeter({ person }: { person: ProgressPerson }) {
    const total = person.itemsDone + person.itemsOpen;
    const done = total ? Math.min(100, person.completion) : 0;
    const both = total
        ? Math.min(100, done + (person.itemsSubmitted / total) * 100)
        : 0;
    return (
        <>
            <span className="sr-only">{liveSummary(person)}</span>
            <span className="team-live-row" aria-hidden="true">
                <span className="team-meter hud-meter">
                    {both > done && (
                        <span
                            className="team-meter-bar hud-meter-pending"
                            style={{ width: `${both}%` }}
                        />
                    )}
                    <span
                        className="team-meter-bar hud-meter-fill"
                        style={{ width: `${done}%` }}
                    />
                </span>
                <span className="team-live-count">
                    {doneLabel(person.itemsDone)}
                </span>
            </span>
        </>
    );
}

/**
 * The empty slots Person.astro renders (`[data-live-slot]` for the meter,
 * `[data-photo-slot]` for the portal photo), found once on mount.
 */
function useCardSlots(attr: "data-live-slot" | "data-photo-slot") {
    const [slots, setSlots] = useState<{ slug: string; el: HTMLElement }[]>(
        [],
    );
    useEffect(() => {
        setSlots(
            Array.from(document.querySelectorAll<HTMLElement>(`[${attr}]`))
                .map((el) => ({ slug: el.getAttribute(attr) ?? "", el }))
                .filter((s) => s.slug),
        );
    }, [attr]);
    return slots;
}

/** A card's portal photo, when it shows one (`shownPhoto`). */
function cardPortalPhoto(
    card: RosterCard | undefined,
    photos: PhotoIndex,
): string | null {
    if (!card) return null;
    const src = portalPhotoForKey(photos, card.key);
    return shownPhoto(card.photoSource, src) === "portal" ? src : null;
}

/* ------------------------------------------------------------------ */
/* Live band                                                           */
/* ------------------------------------------------------------------ */

function BandSkeleton() {
    return (
        <div
            className="hud-panel hud-skeleton mt-8 h-[9.5rem] sm:mt-10 sm:h-[11rem]"
            aria-hidden="true"
        />
    );
}

function DashboardLink() {
    return (
        <a href="/progress" className="team-dash-link">
            Full dashboard
            <ArrowRight className="size-4" aria-hidden="true" />
        </a>
    );
}

function LiveBand({
    feed,
    data,
}: {
    feed: FeedState;
    data: ProgressEnabled;
}) {
    const t = data.totals;
    const since = data.since ? formatDay(data.since, false) : null;
    // Phones: the subteam meters fold away behind a toggle, so the band is
    // one short block and the people start sooner.
    const [subteamsOpen, setSubteamsOpen] = useState(false);
    const subteamsId = useId();
    const subteams = data.subteams.slice(0, 3);
    return (
        <Panel
            aria-labelledby="team-live-heading"
            className="mt-8 p-4 sm:mt-10 sm:p-6"
        >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <Kicker as="h2" id="team-live-heading" className="text-(--hud-ink)">
                    Team progress — live
                </Kicker>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <StatusBadge feed={feed} offDetail="public progress is off" />
                    <span className="max-sm:hidden">
                        <DashboardLink />
                    </span>
                </div>
            </div>

            <div className="mt-4 grid gap-6 sm:mt-5 lg:grid-cols-[auto_auto_minmax(0,1fr)] lg:items-end lg:gap-10">
                <div className="grid grid-cols-2 gap-4 lg:contents">
                    <div className="min-w-0">
                        <p className="font-mono text-4xl leading-none font-semibold tabular-nums text-base-content sm:text-6xl">
                            <AnimatedNumber value={t.itemsDone} />
                        </p>
                        <p className="mt-1.5 text-xs text-base-content/75 sm:mt-2 sm:text-sm">
                            checklist items done
                            {since && (
                                <>
                                    {" "}
                                    since{" "}
                                    <span className="whitespace-nowrap">
                                        {since}
                                    </span>
                                </>
                            )}
                        </p>
                    </div>
                    <div className="min-w-0">
                        <p className="font-mono text-4xl leading-none font-semibold tabular-nums text-(--hud-ink) sm:text-6xl">
                            +<AnimatedNumber value={t.doneLast7Days} />
                        </p>
                        <p className="mt-1.5 text-xs text-base-content/75 sm:mt-2 sm:text-sm">
                            in the past 7 days
                        </p>
                    </div>
                </div>

                {subteams.length > 0 && (
                    <ul
                        id={subteamsId}
                        className={cn(
                            "grid gap-4 sm:grid-cols-3 sm:gap-5",
                            !subteamsOpen && "max-sm:hidden",
                        )}
                        aria-label="Subteam progress"
                    >
                        {subteams.map((s) => {
                            const meta = subteamMeta(s.key, s.name);
                            const Icon = meta.icon;
                            const total = s.itemsDone + s.itemsOpen;
                            const pending = total
                                ? (s.itemsSubmitted / total) * 100
                                : 0;
                            return (
                                <li
                                    key={s.key}
                                    className="min-w-0 max-sm:grid max-sm:grid-cols-[6.25rem_minmax(0,1fr)_2.75rem] max-sm:items-center max-sm:gap-3"
                                >
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="flex min-w-0 items-center gap-1.5 font-semibold text-base-content">
                                            <Icon
                                                className="size-4 shrink-0 self-center text-(--hud-ink)"
                                                aria-hidden="true"
                                            />
                                            <span className="truncate">
                                                {meta.label}
                                            </span>
                                        </span>
                                        <span
                                            className="font-mono text-sm font-semibold tabular-nums text-base-content max-sm:hidden"
                                            aria-hidden="true"
                                        >
                                            {total ? `${s.completion}%` : "—"}
                                        </span>
                                    </div>
                                    <Meter
                                        value={total ? s.completion : 0}
                                        secondary={pending}
                                        size="sm"
                                        className="sm:mt-2"
                                    />
                                    <span
                                        className="text-right font-mono text-sm font-semibold tabular-nums text-base-content sm:hidden"
                                        aria-hidden="true"
                                    >
                                        {total ? `${s.completion}%` : "—"}
                                    </span>
                                    <p
                                        className="mt-1.5 font-mono text-[0.6875rem] tabular-nums text-base-content/70 max-sm:hidden"
                                        aria-hidden="true"
                                    >
                                        {formatNumber(s.itemsDone)} done
                                        {s.doneLast7Days > 0 &&
                                            ` · +${formatNumber(s.doneLast7Days)} this week`}
                                    </p>
                                    <span className="sr-only">
                                        {total
                                            ? `: ${s.completion}% of items done (${formatNumber(s.itemsDone)}), ${s.itemsSubmitted} waiting for review, +${s.doneLast7Days} in the past 7 days.`
                                            : ": no items yet."}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:hidden">
                {subteams.length > 0 && (
                    <button
                        type="button"
                        className="team-band-toggle inline-flex min-h-10 items-center gap-1.5 rounded-md font-mono text-xs font-semibold uppercase tracking-wider text-base-content/80"
                        aria-expanded={subteamsOpen}
                        aria-controls={subteamsId}
                        onClick={() => setSubteamsOpen((v) => !v)}
                    >
                        Subteams
                        <ChevronDown
                            className={cn(
                                "size-4 transition-transform motion-reduce:transition-none",
                                subteamsOpen && "rotate-180",
                            )}
                            aria-hidden="true"
                        />
                    </button>
                )}
                <DashboardLink />
            </div>
        </Panel>
    );
}

function BandUnavailable({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="hud-banner mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-4 py-3 text-sm sm:mt-10">
            <WifiOff className="size-4 shrink-0 text-warning" aria-hidden="true" />
            <p className="flex-1 text-base-content/80">
                <span className="font-semibold text-base-content">
                    Live progress is unavailable right now.
                </span>{" "}
                Retrying…
            </p>
            <button
                type="button"
                className="btn btn-ghost btn-xs font-mono uppercase"
                onClick={onRetry}
            >
                <RefreshCw className="size-3.5" aria-hidden="true" /> Retry now
            </button>
        </div>
    );
}

/* ------------------------------------------------------------------ */

function liveStatus(feed: FeedState): LiveStatus {
    if (feed.data) return feed.data.enabled ? "on" : "off";
    return feed.status === "error" ? "error" : "loading";
}

export default function TeamLive({
    portalUrl,
    roster,
}: {
    portalUrl: string;
    roster: RosterCard[];
}) {
    const source = useSource(portalUrl, roster);
    const feed = useProgressFeed(source?.fetcher ?? null, source?.pollMs);
    const now = useNow(30_000);
    const data = feed.data?.enabled ? feed.data : null;
    const status = liveStatus(feed);

    const bySlug = useMemo(
        () => new Map(roster.map((r) => [r.slug, r])),
        [roster],
    );
    const matches = useMemo(
        () => matchLive(roster, data?.people ?? [], teamPhotoKey),
        [roster, data],
    );
    const slots = useCardSlots("data-live-slot");
    const photoSlots = useCardSlots("data-photo-slot");
    const photos = useTeamPhotos(
        source?.photosFetcher ?? null,
        portalUrl,
        source?.photoSrc,
    );

    /* ---------- which profile is open ---------- */

    const [openSlug, setOpenSlug] = useState<string | null>(null);
    const returnFocus = useRef<HTMLElement | null>(null);

    const openProfile = useCallback((slug: string, from?: HTMLElement) => {
        returnFocus.current = from ?? null;
        setOpenSlug(slug);
        try {
            history.replaceState(
                history.state,
                "",
                withPersonParam(location.href, slug),
            );
        } catch {
            /* sandboxed: the dialog still works */
        }
    }, []);

    const closeProfile = useCallback(() => {
        setOpenSlug(null);
        try {
            history.replaceState(
                history.state,
                "",
                withPersonParam(location.href, null),
            );
        } catch {
            /* ignore */
        }
    }, []);

    // Cards' buttons are static HTML from Person.astro: one delegated listener.
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (e.defaultPrevented || !(e.target instanceof Element)) return;
            const card = e.target.closest<HTMLElement>("[data-person-card]");
            const slug = card?.dataset.slug;
            if (!card || !slug) return;
            e.preventDefault();
            openProfile(slug, card);
        };
        document.addEventListener("click", onClick);
        return () => document.removeEventListener("click", onClick);
    }, [openProfile]);

    // ?person=<slug> on load: people on the page open right away; anyone
    // else waits for the live data (they may be in the portal only).
    const [pending, setPending] = useState<string | null>(null);
    useEffect(() => {
        setPending(personFromSearch(location.search));
    }, []);
    useEffect(() => {
        if (!pending) return;
        if (bySlug.has(pending)) {
            openProfile(pending);
            setPending(null);
            return;
        }
        if (status === "loading") return;
        if (data && liveBySlug(pending, data.people)) openProfile(pending);
        else closeProfile(); // unknown: drop the parameter
        setPending(null);
    }, [pending, bySlug, status, data, openProfile, closeProfile]);

    const view: ProfileView | null = useMemo(() => {
        if (!openSlug) return null;
        const card = bySlug.get(openSlug);
        if (card) {
            return {
                slug: card.slug,
                name: card.name,
                roles: card.roles,
                lead: card.lead,
                badges: card.badges,
                photo: card.photo,
                portalPhoto: cardPortalPhoto(card, photos),
                live: matches.get(card.slug) ?? null,
                onPage: true,
            };
        }
        const p = data ? liveBySlug(openSlug, data.people) : null;
        if (!p) return null;
        return {
            slug: openSlug,
            name: p.name,
            roles: p.role ? [p.role] : [],
            lead: /lead|captain/i.test(p.role),
            badges: [],
            photo: null,
            portalPhoto: portalPhotoFor(photos, p.name),
            live: p,
            onPage: false,
        };
    }, [openSlug, bySlug, matches, data, photos]);

    // A live-only profile whose person left the feed: close it.
    useEffect(() => {
        if (openSlug && !view && status !== "loading") closeProfile();
    }, [openSlug, view, status, closeProfile]);

    /* ---------- render ---------- */

    let band = null;
    if (data) band = <LiveBand feed={feed} data={data} />;
    else if (status === "error") band = <BandUnavailable onRetry={feed.retryNow} />;
    else if (status === "loading") band = <BandSkeleton />;
    // status "off": the owner turned public progress off — no band.

    return (
        <>
            {band}
            <DemoTag mode={source?.demo} />
            {slots.map(({ slug, el }, i) => {
                const person = matches.get(slug);
                return person
                    ? createPortal(<CardMeter person={person} />, el, `${slug}-${i}`)
                    : null;
            })}
            {photoSlots.map(({ slug, el }, i) => {
                const src = cardPortalPhoto(bySlug.get(slug), photos);
                return src
                    ? createPortal(
                          <PortalPhoto key={src} src={src} />,
                          el,
                          `photo-${slug}-${i}`,
                      )
                    : null;
            })}
            <PersonDialog
                view={view}
                liveStatus={status}
                subteams={data?.subteams ?? []}
                since={data?.since ?? ""}
                detailFetcherFor={source?.detailFetcher ?? null}
                now={now}
                returnFocus={returnFocus}
                onClosed={closeProfile}
            />
        </>
    );
}
