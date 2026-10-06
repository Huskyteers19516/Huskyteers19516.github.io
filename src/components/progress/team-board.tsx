import { memo, useMemo } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { PortalPhoto } from "../team/portal-photo";
import {
    NO_PHOTOS,
    portalPhotoFor,
    type PhotoIndex,
} from "../team/portal-photos";
import { profileLinks, teamProfileHref } from "../team/roster";
import { AnimatedNumber, Kicker, Meter, Panel, Ring, Swatch } from "./hud";
import { formatDateTime, formatNumber, initials, shortAgo } from "./format";
import { subteamMeta } from "./subteam-meta";
import type { ProgressPerson, ProgressSubteam } from "./types";

const byName = (a: ProgressPerson, b: ProgressPerson) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" });

function Stat({
    label,
    value,
    prefix,
}: {
    label: string;
    value: number;
    prefix?: string;
}) {
    return (
        <div className="min-w-0">
            <dt className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-base-content/70">
                {label}
            </dt>
            <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-base-content">
                {prefix}
                <AnimatedNumber value={value} />
            </dd>
        </div>
    );
}

export const SubteamPanel = memo(function SubteamPanel({
    subteam,
    headingId,
}: {
    subteam: ProgressSubteam;
    headingId: string;
}) {
    const meta = subteamMeta(subteam.key, subteam.name);
    const Icon = meta.icon;
    const total = subteam.itemsDone + subteam.itemsOpen;
    const pending = total ? (subteam.itemsSubmitted / total) * 100 : 0;
    return (
        <Panel as="div" className="p-5">
            <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                        <span className="hud-icon grid size-9 shrink-0 place-items-center rounded-lg">
                            <Icon
                                className="size-[1.125rem]"
                                aria-hidden="true"
                            />
                        </span>
                        <h3
                            id={headingId}
                            className="font-jockey text-3xl leading-none uppercase text-base-content"
                        >
                            {meta.label}
                        </h3>
                    </div>
                    {meta.blurb && (
                        <p className="mt-2 text-sm text-base-content/70">
                            {meta.blurb}
                        </p>
                    )}
                    <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-wider text-base-content/70">
                        {formatNumber(subteam.people)}{" "}
                        {subteam.people === 1 ? "member" : "members"} ·{" "}
                        {formatNumber(subteam.tasksActive)} active{" "}
                        {subteam.tasksActive === 1 ? "task" : "tasks"}
                    </p>
                </div>
                <Ring
                    value={total ? subteam.completion : 0}
                    secondary={pending}
                    size={92}
                    stroke={7}
                    label={`${meta.label}: ${total ? `${subteam.completion}% of items done, ${formatNumber(subteam.itemsSubmitted)} waiting for review` : "no items yet"}`}
                >
                    <span className="block font-mono text-xl font-semibold tabular-nums text-base-content">
                        {total ? (
                            <>
                                <AnimatedNumber value={subteam.completion} />
                                <span className="text-sm text-base-content/70">
                                    %
                                </span>
                            </>
                        ) : (
                            "—"
                        )}
                    </span>
                </Ring>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-base-content/10 pt-4">
                <Stat label="Done" value={subteam.itemsDone} />
                <Stat label="In review" value={subteam.itemsSubmitted} />
                <Stat
                    label="Past 7 days"
                    value={subteam.doneLast7Days}
                    prefix="+"
                />
            </dl>
        </Panel>
    );
});

export const PersonCard = memo(function PersonCard({
    person,
    now,
    profileHref = null,
    photo = null,
}: {
    person: ProgressPerson;
    now: number;
    /**
     * Their own photo from the Teammate Portal (matched by full name), shown
     * over the initials once loaded; null: initials.
     */
    photo?: string | null;
    /**
     * Their profile on the Our Team page (the whole card links there), or
     * null: shortened names ("T.H.", "Tommy H.") and names two people share
     * aren't linked (see `profileLinks`).
     */
    profileHref?: string | null;
}) {
    const total = person.itemsDone + person.itemsOpen;
    const toDo = person.itemsOpen - person.itemsSubmitted;
    const pending = total ? (person.itemsSubmitted / total) * 100 : 0;
    const lead = /lead|captain/i.test(person.role);
    const summary = total
        ? `${person.itemsDone} done, ${person.completion}% of their items`
        : "No items yet";
    return (
        <li className="hud-card group relative rounded-xl px-3 py-2 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-(--hud-line) sm:p-3.5">
            <div className="flex items-center gap-3">
                <span
                    className={cn(
                        "hud-avatar relative grid size-9 shrink-0 place-items-center font-mono text-xs font-semibold sm:size-10 sm:text-sm",
                        lead && "hud-avatar-lead",
                    )}
                    aria-hidden="true"
                >
                    {initials(person.name)}
                    {photo && (
                        <PortalPhoto
                            key={photo}
                            src={photo}
                            className="hud-avatar-photo"
                        />
                    )}
                </span>
                <div className="min-w-0 flex-1">
                    <p
                        className="line-clamp-2 font-semibold leading-tight break-words text-base-content"
                        title={person.name}
                    >
                        {profileHref ? (
                            <>
                                {/* The whole card is the link to their
                                    profile on the Our Team page
                                    (/about/team?person=…). */}
                                <a
                                    href={profileHref}
                                    className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:underline hover:decoration-(--hud-line) hover:underline-offset-4"
                                >
                                    {person.name}
                                    <span className="sr-only">, open profile</span>
                                </a>
                                <ArrowUpRight
                                    className="ml-0.5 inline size-3.5 align-[-0.125em] text-(--hud-ink) opacity-0 transition-opacity group-hover:opacity-100 group-has-[a:focus-visible]:opacity-100 motion-reduce:transition-none"
                                    aria-hidden="true"
                                />
                            </>
                        ) : (
                            person.name
                        )}
                    </p>
                    {person.role && (
                        <p className="truncate font-mono text-[0.6875rem] uppercase tracking-wider text-base-content/70">
                            {person.role}
                        </p>
                    )}
                </div>
                {/* Phones: one compact row with a thin inline meter. */}
                <Meter
                    value={total ? person.completion : 0}
                    secondary={pending}
                    size="xs"
                    className="w-12 shrink-0 sm:hidden"
                />
                <div className="min-w-16 shrink-0 text-right">
                    <span className="sr-only">{summary}</span>
                    <p
                        className="font-mono text-lg leading-tight font-semibold tabular-nums text-base-content"
                        aria-hidden="true"
                    >
                        <AnimatedNumber value={person.itemsDone} />
                        <span className="ml-1 text-[0.6875rem] font-medium text-base-content/70">
                            done
                        </span>
                    </p>
                    <p
                        className="font-mono text-[0.6875rem] tabular-nums text-base-content/70"
                        aria-hidden="true"
                    >
                        {total ? `${person.completion}%` : "no items yet"}
                    </p>
                </div>
            </div>
            <div className="max-sm:hidden">
                <Meter
                    value={total ? person.completion : 0}
                    secondary={pending}
                    size="sm"
                    className="mt-3"
                />
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 font-mono text-[0.6875rem] tabular-nums text-base-content/70">
                    <span>
                        {total ? (
                            <>
                                {person.itemsSubmitted > 0 &&
                                    `${formatNumber(person.itemsSubmitted)} in review · `}
                                {formatNumber(toDo)} to do
                            </>
                        ) : (
                            "Nothing assigned yet"
                        )}
                    </span>
                    <span className="flex items-center gap-2">
                        {person.doneLast7Days > 0 && (
                            <span className="hud-chip rounded px-1.5 py-px">
                                +{formatNumber(person.doneLast7Days)} past 7
                                days
                            </span>
                        )}
                        {person.lastDoneAt && (
                            // Above the card's link overlay, so its tooltip
                            // still shows on hover.
                            <time
                                dateTime={person.lastDoneAt}
                                title={`Last item done ${formatDateTime(person.lastDoneAt)}`}
                                className="relative z-10"
                            >
                                last {lastAgo(person.lastDoneAt, now)}
                            </time>
                        )}
                    </span>
                </div>
            </div>
        </li>
    );
});

/** "16m ago", "just now", "Sep 7" (dates don't get "ago"). */
function lastAgo(iso: string, now: number): string {
    const ago = shortAgo(iso, now);
    if (ago === "now") return "just now";
    return /^\d+[mhd]$/.test(ago) ? `${ago} ago` : ago;
}

export function PeopleList({
    people,
    now,
    className,
    label,
    links,
    profileQuery = "",
    photos = NO_PHOTOS,
}: {
    people: ProgressPerson[];
    now: number;
    className?: string;
    label: string;
    /** id -> profile slug of the people to link (`profileLinks` over everyone). */
    links?: ReadonlyMap<string, string>;
    /** Extra query for the profile links (the dev demo passes "demo=1"). */
    profileQuery?: string;
    /** The portal's team photos (`useTeamPhotos`). */
    photos?: PhotoIndex;
}) {
    if (people.length === 0) return null;
    return (
        <ul className={cn("grid gap-2.5", className)} aria-label={label}>
            {[...people].sort(byName).map((p) => {
                const slug = links?.get(p.id);
                return (
                    <PersonCard
                        key={p.id}
                        person={p}
                        now={now}
                        profileHref={
                            slug ? teamProfileHref(slug, profileQuery) : null
                        }
                        photo={portalPhotoFor(photos, p.name)}
                    />
                );
            })}
        </ul>
    );
}

/** What the numbers on the panels and cards mean (no hover needed). */
function Legend({ people }: { people: boolean }) {
    return (
        <ul className="mb-5 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[0.6875rem] text-base-content/70">
            <li className="flex items-center gap-1.5">
                <Swatch tone="done" />
                Done: approved by a leader
            </li>
            <li className="flex items-center gap-1.5">
                <Swatch tone="pending" />
                In review: checked off, waiting for a leader
            </li>
            <li className="flex items-center gap-1.5">
                <Swatch tone="todo" />
                To do
            </li>
            <li>% = share of {people ? "assigned" : "all"} items done</li>
            <li>+N = done in the past 7 days</li>
        </ul>
    );
}

export function TeamBoard({
    subteams,
    people,
    now,
    profileQuery,
    photos,
}: {
    subteams: ProgressSubteam[];
    people: ProgressPerson[];
    now: number;
    /** Extra query for the profile links (the dev demo passes "demo=1"). */
    profileQuery?: string;
    /** The portal's team photos for the people rows (`useTeamPhotos`). */
    photos?: PhotoIndex;
}) {
    const keys = new Set(subteams.map((s) => s.key));
    const teamWide = people.filter((p) => !p.subteam || !keys.has(p.subteam));
    const showPeople = people.length > 0;
    // Over everyone at once: a name two people share is linked for neither.
    const links = useMemo(() => profileLinks(people), [people]);

    return (
        <section aria-labelledby="board-heading" className="mt-14">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                <div>
                    <Kicker>
                        {showPeople ? "// Subteams & people" : "// Subteams"}
                    </Kicker>
                    <h2
                        id="board-heading"
                        className="mt-1 font-jockey text-4xl uppercase text-base-content sm:text-5xl"
                    >
                        {showPeople ? (
                            <>Who&rsquo;s building what</>
                        ) : (
                            "Subteam progress"
                        )}
                    </h2>
                </div>
                {showPeople && (
                    <p className="max-w-md text-sm text-base-content/70">
                        Everyone&rsquo;s checklist progress, grouped by subteam
                        and listed alphabetically.
                        {links.size > 0 &&
                            " Select someone for their profile on the Our Team page."}
                    </p>
                )}
            </div>
            <Legend people={showPeople} />

            {showPeople && teamWide.length > 0 && (
                <div className="mb-6">
                    <Kicker as="h3" className="mb-2.5">
                        Team-wide
                    </Kicker>
                    <PeopleList
                        people={teamWide}
                        now={now}
                        label="Team-wide members"
                        links={links}
                        profileQuery={profileQuery}
                        photos={photos}
                        className="sm:grid-cols-2 lg:grid-cols-3"
                    />
                </div>
            )}

            <div
                className={cn(
                    "grid gap-6 lg:gap-5",
                    subteams.length >= 3
                        ? "lg:grid-cols-3"
                        : subteams.length === 2
                          ? "lg:grid-cols-2"
                          : "",
                )}
            >
                {subteams.map((s) => {
                    const members = people.filter((p) => p.subteam === s.key);
                    const headingId = `subteam-${s.key.toLowerCase()}`;
                    return (
                        <section
                            key={s.key}
                            aria-labelledby={headingId}
                            className="flex flex-col gap-2.5"
                        >
                            <SubteamPanel subteam={s} headingId={headingId} />
                            {showPeople && (
                                <PeopleList
                                    people={members}
                                    now={now}
                                    label={`${subteamMeta(s.key, s.name).label} members`}
                                    links={links}
                                    profileQuery={profileQuery}
                                    photos={photos}
                                    className="md:grid-cols-2 lg:grid-cols-1"
                                />
                            )}
                        </section>
                    );
                })}
            </div>
        </section>
    );
}
