import { useMemo, type ReactNode } from "react";
import {
    ArrowRight,
    Box,
    CodeXml,
    HandHeart,
    RefreshCw,
    WifiOff,
    Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatDate, KIND_META } from "./format";
import { PartCard, SoftwareCard } from "./project-card";
import { ProjectDialog } from "./project-dialog";
import type { WorkshopKind, WorkshopProject } from "./types";
import { Kicker } from "./ui";
import {
    useHashRoute,
    useWorkshop,
    useWorkshopSource,
    type WorkshopState,
} from "./use-workshop";

const SECTION_ID: Record<WorkshopKind, string> = {
    PART: "parts",
    SOFTWARE: "software",
    OTHER: "other-builds",
};

/* ------------------------------------------------------------------ */

function Hero() {
    return (
        <header className="max-w-3xl">
            <Kicker>FTC 19516 // Design · Print · Code</Kicker>
            <h1 className="mt-2 font-jockey text-6xl leading-[0.9] uppercase sm:text-7xl lg:text-8xl">
                <span className="text-base-content">The </span>
                <span className="ws-title-accent">Workshop</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base text-base-content/75 sm:text-lg">
                The robot parts we design and 3D print, the software we write,
                and everything else we build — and how each one got here,
                failures and redesigns included.
            </p>
        </header>
    );
}

function JumpNav({
    counts,
    showOther,
}: {
    counts: Record<WorkshopKind, number> | null;
    showOther: boolean;
}) {
    const items: { kind: WorkshopKind; icon: LucideIcon }[] = [
        { kind: "PART", icon: Box },
        { kind: "SOFTWARE", icon: CodeXml },
        ...(showOther ? [{ kind: "OTHER" as const, icon: Wrench }] : []),
    ];
    return (
        <nav aria-label="Workshop sections" className="mt-7">
            <ul className="flex flex-wrap gap-2">
                {items.map(({ kind, icon: Icon }) => (
                    <li key={kind}>
                        <a
                            href={`#${SECTION_ID[kind]}`}
                            className="ws-chip inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold"
                        >
                            <Icon
                                className="size-4 text-(--ws-ink)"
                                aria-hidden="true"
                            />
                            {KIND_META[kind].section}
                            {counts && (
                                <span className="ws-chip-count rounded-full px-1.5 font-mono text-[0.6875rem] tabular-nums">
                                    {counts[kind]}
                                    <span className="sr-only">
                                        {counts[kind] === 1
                                            ? " project"
                                            : " projects"}
                                    </span>
                                </span>
                            )}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

function SectionHeader({
    index,
    kicker,
    title,
    headingId,
    blurb,
    large = false,
}: {
    index: string;
    kicker: string;
    title: string;
    headingId: string;
    blurb: string;
    large?: boolean;
}) {
    return (
        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
            <div>
                <Kicker>
                    <span className="text-(--ws-ink)">{index}</span> //{" "}
                    {kicker}
                </Kicker>
                <h2
                    id={headingId}
                    className={cn(
                        "mt-1 font-jockey leading-[0.95] uppercase text-base-content",
                        large
                            ? "text-5xl sm:text-6xl"
                            : "text-4xl sm:text-5xl",
                    )}
                >
                    {title}
                </h2>
            </div>
            <p className="max-w-md text-sm text-base-content/70">{blurb}</p>
        </header>
    );
}

function ShareCallout() {
    return (
        <aside
            aria-labelledby="ws-share-heading"
            className="ws-share mt-6 flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:p-5"
        >
            <div className="flex min-w-0 flex-1 items-start gap-4 sm:items-center">
                <span className="ws-icon grid size-11 shrink-0 place-items-center rounded-xl">
                    <HandHeart className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3
                        id="ws-share-heading"
                        className="font-jockey text-2xl leading-none uppercase text-base-content"
                    >
                        Free to use
                    </h3>
                    <p className="mt-1.5 text-sm text-base-content/80">
                        Every design here is free for any team to download,
                        print, and remix. If one helps your robot, tell us —
                        we&rsquo;d love to see it.
                    </p>
                </div>
            </div>
            <a
                href="/contact"
                className="ws-action ws-action-primary inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-full px-4 text-sm font-semibold max-sm:ml-15 sm:self-center"
            >
                Tell us
                <ArrowRight className="size-4" aria-hidden="true" />
            </a>
        </aside>
    );
}

function EmptyState({
    icon: Icon,
    children,
}: {
    icon: LucideIcon;
    children: ReactNode;
}) {
    return (
        <div className="ws-empty mt-6 flex flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center">
            <span className="ws-icon grid size-12 place-items-center rounded-xl">
                <Icon className="size-5" aria-hidden="true" />
            </span>
            <p className="max-w-sm text-base-content/75">{children}</p>
        </div>
    );
}

function SkeletonGrid({ wide = false }: { wide?: boolean }) {
    return (
        <div
            className={cn(
                "mt-6 grid gap-5",
                wide ? "lg:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
            )}
            aria-hidden="true"
        >
            {Array.from({ length: wide ? 2 : 3 }, (_, i) => (
                <div
                    key={i}
                    className={cn(
                        "ws-skeleton overflow-hidden rounded-2xl",
                        i === 2 && "max-lg:hidden",
                    )}
                >
                    <div
                        className={cn(
                            "ws-skeleton-media",
                            wide ? "aspect-[16/10]" : "aspect-[4/3]",
                        )}
                    />
                    <div className="space-y-3 p-5">
                        <div className="ws-skeleton-line h-6 w-2/3" />
                        <div className="ws-skeleton-line h-3 w-full" />
                        <div className="ws-skeleton-line h-3 w-5/6" />
                        <div className="ws-skeleton-line h-3 w-1/3" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function Section({
    kind,
    index,
    kicker,
    blurb,
    large,
    children,
}: {
    kind: WorkshopKind;
    index: string;
    kicker: string;
    blurb: string;
    large?: boolean;
    children: ReactNode;
}) {
    const id = SECTION_ID[kind];
    return (
        <section
            id={id}
            aria-labelledby={`${id}-heading`}
            className="mt-14 scroll-mt-28 sm:scroll-mt-32"
        >
            <SectionHeader
                index={index}
                kicker={kicker}
                title={KIND_META[kind].section}
                headingId={`${id}-heading`}
                blurb={blurb}
                large={large}
            />
            {children}
        </section>
    );
}

const COPY = {
    PART: {
        index: "01",
        kicker: "Designed & printed in-house",
        blurb: "Custom parts on our robots: what each one does, what it's printed in, and who designed it.",
        empty: "Our first parts are being photographed — check back soon.",
    },
    SOFTWARE: {
        index: "02",
        kicker: "Written by students",
        blurb: "Apps and tools our students wrote to run the team and the robot.",
        empty: "Our software is getting its screenshots taken — check back soon.",
    },
    OTHER: {
        index: "03",
        kicker: "Built by hand",
        blurb: "Everything else we make that isn't a printed part or a program.",
        empty: "",
    },
} as const;

function Sections({
    groups,
    onOpen,
}: {
    groups: Record<WorkshopKind, WorkshopProject[]>;
    onOpen: (id: string) => void;
}) {
    const parts = groups.PART;
    const software = groups.SOFTWARE;
    const other = groups.OTHER;
    // Only promise free designs when some part actually shares one.
    const sharesDesigns = parts.some((p) => p.link || p.downloads.length > 0);
    return (
        <>
            <Section kind="PART" large {...COPY.PART}>
                {parts.length > 0 ? (
                    <>
                        {sharesDesigns && <ShareCallout />}
                        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {parts.map((p) => (
                                <li key={p.id} className="min-w-0">
                                    <PartCard project={p} onOpen={onOpen} />
                                </li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <EmptyState icon={Box}>{COPY.PART.empty}</EmptyState>
                )}
            </Section>

            <Section kind="SOFTWARE" {...COPY.SOFTWARE}>
                {software.length > 0 ? (
                    <ul className="mt-6 grid gap-5 lg:grid-cols-2">
                        {software.map((p) => (
                            <li key={p.id} className="min-w-0">
                                <SoftwareCard project={p} onOpen={onOpen} />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <EmptyState icon={CodeXml}>{COPY.SOFTWARE.empty}</EmptyState>
                )}
            </Section>

            {other.length > 0 && (
                <Section kind="OTHER" {...COPY.OTHER}>
                    <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {other.map((p) => (
                            <li key={p.id} className="min-w-0">
                                <PartCard project={p} onOpen={onOpen} />
                            </li>
                        ))}
                    </ul>
                </Section>
            )}
        </>
    );
}

function LoadingSections() {
    return (
        <>
            {(["PART", "SOFTWARE"] as const).map((kind) => (
                <Section key={kind} kind={kind} large={kind === "PART"} {...COPY[kind]}>
                    <SkeletonGrid wide={kind === "SOFTWARE"} />
                </Section>
            ))}
        </>
    );
}

function ErrorNotice({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="ws-panel mx-auto mt-12 flex max-w-xl flex-col items-center rounded-2xl px-6 py-12 text-center">
            <span className="ws-icon ws-icon-warn grid size-14 place-items-center rounded-2xl">
                <WifiOff className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-jockey text-4xl leading-none uppercase text-base-content">
                The workshop is offline
            </h2>
            <p className="mt-3 text-base-content/75">
                Our projects live on the team portal, which may be waking up or
                briefly unreachable. Give it a moment and try again.
            </p>
            <button
                type="button"
                className="btn btn-primary mt-6 min-h-11"
                onClick={onRetry}
            >
                <RefreshCw className="size-4" aria-hidden="true" />
                Retry
            </button>
        </div>
    );
}

function announcementFor(state: WorkshopState): string {
    if (state.status === "error") return "Couldn't load the workshop.";
    if (state.status === "ready") {
        const n = state.data.projects.length;
        return n === 0
            ? "No projects published yet."
            : `Loaded ${n} ${n === 1 ? "project" : "projects"}.`;
    }
    return "";
}

/**
 * The newest project update. The payload's own `updatedAt` is when the
 * portal built the answer (always about now), so it can't date the page.
 */
function lastUpdated(projects: WorkshopProject[]): string | null {
    let latest: string | null = null;
    for (const p of projects) {
        if (
            p.updatedAt &&
            (!latest || Date.parse(p.updatedAt) > Date.parse(latest))
        ) {
            latest = p.updatedAt;
        }
    }
    return latest;
}

/* ------------------------------------------------------------------ */

export default function Workshop({ portalUrl }: { portalUrl: string }) {
    const source = useWorkshopSource(portalUrl);
    const workshop = useWorkshop(source);
    const route = useHashRoute();

    const projects = workshop.data?.projects;
    const groups = useMemo(() => {
        const g: Record<WorkshopKind, WorkshopProject[]> = {
            PART: [],
            SOFTWARE: [],
            OTHER: [],
        };
        for (const p of projects ?? []) g[p.kind].push(p);
        return g;
    }, [projects]);

    const openProject =
        (route.hash && projects?.find((p) => p.id === route.hash)) || null;

    const counts = projects
        ? {
              PART: groups.PART.length,
              SOFTWARE: groups.SOFTWARE.length,
              OTHER: groups.OTHER.length,
          }
        : null;
    const updated = formatDate(lastUpdated(projects ?? []));

    return (
        <div className="ws ws-bg">
            <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-16 sm:px-6 lg:px-8 lg:pt-14">
                <Hero />

                {workshop.status !== "error" && (
                    <JumpNav
                        counts={counts}
                        showOther={groups.OTHER.length > 0}
                    />
                )}

                {source?.demo && (
                    <p className="mt-4 inline-block rounded-md border border-dashed border-warning/60 px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-wider text-base-content/70">
                        Dev demo data · ?demo={source.demo}
                    </p>
                )}

                {workshop.status === "ready" ? (
                    <Sections groups={groups} onOpen={route.open} />
                ) : workshop.status === "error" ? (
                    <ErrorNotice onRetry={workshop.retry} />
                ) : (
                    <LoadingSections />
                )}

                {workshop.status === "ready" && (
                    <footer className="mt-16 border-t border-base-content/10 pt-6 font-mono text-[0.6875rem] leading-relaxed uppercase tracking-wider text-base-content/55">
                        <p>
                            Projects are added by team members in the Huskyteers
                            Teammate Portal and approved by team leaders.
                        </p>
                        {updated && <p className="mt-1">Updated {updated}</p>}
                    </footer>
                )}

                <p className="sr-only" aria-live="polite" aria-atomic="true">
                    {announcementFor(workshop)}
                </p>
            </div>

            <ProjectDialog project={openProject} onClosed={route.clear} />
        </div>
    );
}
