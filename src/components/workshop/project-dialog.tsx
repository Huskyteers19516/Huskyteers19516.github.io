import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type RefObject,
} from "react";
import {
    ArrowDown,
    ChevronLeft,
    ChevronRight,
    Download,
    FolderGit2,
    Layers,
    Star,
    X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
    altFor,
    cardLinkId,
    downloadName,
    formatBytes,
    formatDate,
    hasStory,
    iterationBadge,
    joinNames,
    KIND_META,
    stepLabel,
    viewerPhotos,
} from "./format";
import type { WorkshopPhoto, WorkshopProject } from "./types";
import { Badge, Kicker, KIND_ICON, NoPhoto, OutLink } from "./ui";

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

const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Photo viewer ---------- */

function PhotoViewer({
    project,
    photos,
    index,
    onStep,
    onPick,
    showNote,
}: {
    project: WorkshopProject;
    photos: WorkshopPhoto[];
    index: number;
    onStep: (delta: number) => void;
    onPick: (index: number) => void;
    showNote: boolean;
}) {
    // Screenshots are usually wide; parts photos are usually 4:3.
    const frame =
        project.kind === "SOFTWARE" ? "aspect-[16/10]" : "aspect-[4/3]";
    if (photos.length === 0) {
        return (
            <div className={cn("ws-stage overflow-hidden rounded-xl", frame)}>
                <NoPhoto kind={project.kind} />
            </div>
        );
    }
    const photo = photos[index];
    const multi = photos.length > 1;

    return (
        <figure className="m-0">
            <div
                className={cn(
                    "ws-stage relative overflow-hidden rounded-xl",
                    frame,
                )}
            >
                <img
                    key={photo.id}
                    src={photo.src}
                    width={photo.width || 1200}
                    height={photo.height || 900}
                    alt={altFor(project.title, photo)}
                    decoding="async"
                    className="ws-fade-in absolute inset-0 size-full object-contain"
                />
                {multi && (
                    <>
                        <button
                            type="button"
                            className="ws-nav-btn absolute top-1/2 left-2 grid size-11 -translate-y-1/2 place-items-center rounded-full"
                            onClick={() => onStep(-1)}
                            aria-label="Previous photo"
                        >
                            <ChevronLeft className="size-5" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className="ws-nav-btn absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full"
                            onClick={() => onStep(1)}
                            aria-label="Next photo"
                        >
                            <ChevronRight className="size-5" aria-hidden="true" />
                        </button>
                        <span
                            className="ws-counter absolute top-2 right-2 rounded-md px-2 py-1 font-mono text-[0.6875rem] tabular-nums"
                            aria-hidden="true"
                        >
                            {index + 1} / {photos.length}
                        </span>
                    </>
                )}
            </div>

            {(photo.label || (showNote && photo.note)) && (
                <figcaption className="mt-3">
                    {photo.label && (
                        <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--ws-ink)">
                            {photo.label}
                        </span>
                    )}
                    {showNote && photo.note && (
                        <p className="mt-1 whitespace-pre-line text-sm text-base-content/80">
                            {photo.note}
                        </p>
                    )}
                </figcaption>
            )}

            {multi && (
                <>
                    <p className="sr-only" aria-live="polite" aria-atomic="true">
                        Photo {index + 1} of {photos.length}
                        {photo.label ? `: ${photo.label}` : ""}
                    </p>
                    <ul
                        className="ws-thumbs mt-3 flex gap-2 overflow-x-auto p-1"
                        aria-label="Photos"
                    >
                        {photos.map((p, i) => (
                            <li key={p.id} className="shrink-0">
                                <button
                                    type="button"
                                    className="ws-thumb block h-14 w-[4.5rem] overflow-hidden rounded-lg"
                                    onClick={() => onPick(i)}
                                    aria-label={`Show photo ${i + 1}${p.label ? `: ${p.label}` : ""}`}
                                    aria-current={i === index ? "true" : undefined}
                                >
                                    <img
                                        src={p.src}
                                        width={p.width || 1200}
                                        height={p.height || 900}
                                        alt=""
                                        loading="lazy"
                                        decoding="async"
                                        className="size-full object-cover"
                                    />
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </figure>
    );
}

/* ---------- Iteration story ---------- */

function IterationStory({
    project,
    activeId,
    onPick,
}: {
    project: WorkshopProject;
    activeId: string | undefined;
    onPick: (photoId: string) => void;
}) {
    const headingId = useId();
    const steps = project.photos;
    const labels = steps.map((p, i) => stepLabel(project.kind, p, i));
    const first = labels[0];
    const last = labels[labels.length - 1];

    return (
        <section
            aria-labelledby={headingId}
            className="ws-section-rule px-4 py-6 sm:px-6"
        >
            <Kicker className="flex items-center gap-1.5 text-(--ws-ink)">
                <Layers className="size-3.5" aria-hidden="true" />
                The iteration story
            </Kicker>
            <h3
                id={headingId}
                className="mt-1.5 font-jockey text-3xl leading-none uppercase text-base-content sm:text-4xl"
            >
                From {first} to {last}
            </h3>
            <p className="mt-2 max-w-2xl text-sm text-base-content/75">
                Failure and redesign are part of the process. Every version
                taught us something — here&rsquo;s what didn&rsquo;t work, and
                what we changed.
            </p>

            <p
                className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em]"
                aria-hidden="true"
            >
                {labels.map((label, i) => (
                    <span key={steps[i].id} className="inline-flex items-center gap-2">
                        {i > 0 && (
                            <ChevronRight className="size-3.5 text-base-content/40" />
                        )}
                        <span
                            className={cn(
                                "rounded px-1.5 py-0.5",
                                i === labels.length - 1
                                    ? "ws-path-current"
                                    : "text-base-content/70",
                            )}
                        >
                            {label}
                        </span>
                    </span>
                ))}
            </p>

            <ol className="mt-5 grid gap-1">
                {steps.map((photo, i) => {
                    const isLast = i === steps.length - 1;
                    const active = photo.id === activeId;
                    return (
                        <li
                            key={photo.id}
                            className={cn(
                                "ws-step relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 pb-5 sm:gap-x-4",
                                isLast && "ws-step-last pb-0",
                            )}
                        >
                            <span
                                className="ws-node relative z-[1] grid size-9 place-items-center rounded-full font-mono text-xs font-semibold tabular-nums"
                                aria-hidden="true"
                            >
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                                <button
                                    type="button"
                                    className={cn(
                                        "ws-thumb relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-lg sm:w-44",
                                    )}
                                    onClick={() => onPick(photo.id)}
                                    aria-label={`Show ${labels[i]} in the photo viewer`}
                                    aria-current={active ? "true" : undefined}
                                >
                                    <img
                                        src={photo.src}
                                        width={photo.width || 1200}
                                        height={photo.height || 900}
                                        alt=""
                                        loading="lazy"
                                        decoding="async"
                                        className="size-full object-cover"
                                    />
                                </button>
                                <div className="min-w-0 pt-0.5">
                                    <p className="flex flex-wrap items-center gap-2">
                                        <span className="font-jockey text-2xl leading-none uppercase text-base-content">
                                            {labels[i]}
                                        </span>
                                        {isLast && steps.length > 1 && (
                                            <Badge tone="iterate">Current</Badge>
                                        )}
                                    </p>
                                    {photo.note ? (
                                        <>
                                            <p className="mt-1.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-(--ws-ink)">
                                                {i === 0
                                                    ? "Where it started"
                                                    : "What we changed"}
                                            </p>
                                            <p className="mt-0.5 max-w-prose whitespace-pre-line text-sm leading-relaxed text-base-content/80">
                                                {photo.note}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="mt-1.5 text-sm text-base-content/55">
                                            {i === 0
                                                ? "Where it started."
                                                : "The next iteration."}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}

/* ---------- Downloads & links ---------- */

function Downloads({
    project,
    headingRef,
}: {
    project: WorkshopProject;
    headingRef: RefObject<HTMLHeadingElement | null>;
}) {
    const headingId = useId();
    const meta = KIND_META[project.kind];
    const isPart = project.kind === "PART";

    return (
        <section
            aria-labelledby={headingId}
            className="ws-section-rule px-4 py-6 sm:px-6"
        >
            <Kicker className="flex items-center gap-1.5 text-(--ws-ink)">
                <Download className="size-3.5" aria-hidden="true" />
                {isPart ? "Free to use" : "Get it"}
            </Kicker>
            <h3
                id={headingId}
                ref={headingRef}
                tabIndex={-1}
                className="mt-1.5 scroll-mt-4 font-jockey text-3xl leading-none uppercase text-base-content outline-none sm:text-4xl"
            >
                {meta.downloadsTitle}
            </h3>
            {isPart && project.downloads.length > 0 && (
                <p className="mt-2 max-w-2xl text-sm text-base-content/75">
                    Free for any team to download, print, and remix. If it
                    helps your robot,{" "}
                    <a href="/contact" className="ws-link">
                        tell us
                    </a>{" "}
                    — we&rsquo;d love to see it.
                </p>
            )}

            {project.downloads.length > 0 && (
                <ul className="mt-4 grid gap-2.5 md:grid-cols-2">
                    {project.downloads.map((d) => {
                        const size = formatBytes(d.size);
                        const name = d.label ? d.filename : "";
                        return (
                            <li key={d.id} className="min-w-0">
                                <a
                                    href={d.href}
                                    download={downloadName(d)}
                                    className="ws-download flex min-h-16 items-center gap-3 rounded-xl p-3 pr-4"
                                >
                                    <span
                                        className="ws-format grid h-11 min-w-12 shrink-0 place-items-center rounded-lg px-2 font-mono text-xs font-bold tracking-wider"
                                        aria-hidden="true"
                                    >
                                        {d.format}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-semibold text-base-content">
                                            <span className="sr-only">
                                                Download{" "}
                                            </span>
                                            {d.label || d.filename}
                                            <span className="sr-only">
                                                , {d.format} file
                                            </span>
                                        </span>
                                        {(name || size) && (
                                            <span className="flex min-w-0 gap-1.5 font-mono text-xs text-base-content/60">
                                                {name && (
                                                    <span className="truncate">
                                                        {name}
                                                    </span>
                                                )}
                                                {name && size && (
                                                    <span aria-hidden="true">
                                                        ·
                                                    </span>
                                                )}
                                                {size && (
                                                    <span className="shrink-0 whitespace-nowrap">
                                                        {size}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </span>
                                    <Download
                                        className="ws-download-icon size-5 shrink-0"
                                        aria-hidden="true"
                                    />
                                </a>
                            </li>
                        );
                    })}
                </ul>
            )}

            {(project.link || project.codeLink) && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {project.link && (
                        <OutLink href={project.link}>
                            {meta.linkLabel}
                        </OutLink>
                    )}
                    {project.codeLink && (
                        <OutLink href={project.codeLink} icon={FolderGit2}>
                            Source code
                        </OutLink>
                    )}
                </div>
            )}
        </section>
    );
}

/* ---------- Dialog body ---------- */

function DialogBody({
    project,
    titleId,
    onClose,
}: {
    project: WorkshopProject;
    titleId: string;
    onClose: () => void;
}) {
    const meta = KIND_META[project.kind];
    const Icon = KIND_ICON[project.kind];
    const photos = useMemo(() => viewerPhotos(project), [project]);
    const [index, setIndex] = useState(() => {
        const i = project.cover
            ? photos.findIndex((p) => p.id === project.cover?.id)
            : photos.length - 1;
        return Math.max(0, i);
    });
    const viewerRef = useRef<HTMLDivElement>(null);
    const downloadsRef = useRef<HTMLHeadingElement>(null);
    const count = photos.length;
    const story = hasStory(project);
    const iteration = iterationBadge(project);
    const designers = joinNames(project.designers);
    const published = formatDate(project.publishedAt);
    const updated = formatDate(project.updatedAt);

    const step = useCallback(
        (delta: number) => {
            if (count > 1) setIndex((i) => (i + delta + count) % count);
        },
        [count],
    );

    // Arrow keys switch photos (listening on the document so it also works
    // when focus fell back to the dialog itself).
    useEffect(() => {
        if (count < 2) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey)
                return;
            if (e.key === "ArrowLeft") {
                e.preventDefault();
                step(-1);
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                step(1);
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [count, step]);

    const showPhoto = (photoId: string) => {
        const i = photos.findIndex((p) => p.id === photoId);
        if (i < 0) return;
        setIndex(i);
        viewerRef.current?.scrollIntoView({
            behavior: prefersReducedMotion() ? "auto" : "smooth",
            block: "nearest",
        });
    };

    const goToDownloads = () => {
        const el = downloadsRef.current;
        if (!el) return;
        el.scrollIntoView({
            behavior: prefersReducedMotion() ? "auto" : "smooth",
            block: "start",
        });
        el.focus({ preventScroll: true });
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <header className="ws-dialog-head flex shrink-0 items-start gap-3 px-4 py-3 sm:px-6 sm:py-4">
                <div className="min-w-0 flex-1">
                    <Kicker className="flex flex-wrap items-center gap-x-1.5 text-(--ws-ink)">
                        <Icon className="size-3.5" aria-hidden="true" />
                        {meta.singular}
                        {project.season && (
                            <span className="text-base-content/55">
                                · {project.season}
                            </span>
                        )}
                    </Kicker>
                    <h2
                        id={titleId}
                        className="mt-1 font-jockey text-3xl leading-[0.95] break-words uppercase text-base-content sm:text-4xl"
                    >
                        {project.title}
                    </h2>
                </div>
                <button
                    type="button"
                    className="ws-icon-btn grid size-11 shrink-0 place-items-center rounded-full"
                    onClick={onClose}
                    aria-label="Close"
                >
                    <X className="size-5" aria-hidden="true" />
                </button>
            </header>

            <div className="ws-dialog-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-8">
                    <div ref={viewerRef} className="scroll-mt-4">
                        <PhotoViewer
                            project={project}
                            photos={photos}
                            index={Math.min(index, Math.max(0, count - 1))}
                            onStep={step}
                            onPick={setIndex}
                            showNote={!story}
                        />
                    </div>

                    <div className="flex min-w-0 flex-col gap-5">
                        {project.summary && (
                            <div>
                                <Kicker className="text-(--ws-ink)">
                                    {meta.summaryLabel}
                                </Kicker>
                                <p className="mt-1.5 whitespace-pre-line leading-relaxed text-base-content/90">
                                    {project.summary}
                                </p>
                            </div>
                        )}
                        {project.material && (
                            <div>
                                <Kicker className="text-(--ws-ink)">
                                    {meta.materialLabel}
                                </Kicker>
                                <p className="mt-1.5 font-semibold text-base-content">
                                    {project.material}
                                </p>
                            </div>
                        )}
                        {(project.featured ||
                            iteration ||
                            project.downloads.length > 0) && (
                            <div className="flex flex-wrap gap-1.5">
                                {project.featured && (
                                    <Badge tone="iterate">
                                        <Star
                                            className="size-3 fill-current"
                                            aria-hidden="true"
                                        />
                                        Featured
                                    </Badge>
                                )}
                                {iteration && (
                                    <Badge tone="iterate">
                                        <Layers
                                            className="size-3"
                                            aria-hidden="true"
                                        />
                                        {iteration}
                                    </Badge>
                                )}
                                {project.downloads.length > 0 && (
                                    <Badge tone="accent">
                                        <Download
                                            className="size-3"
                                            aria-hidden="true"
                                        />
                                        {project.downloads.length}{" "}
                                        {project.downloads.length === 1
                                            ? "file"
                                            : "files"}
                                    </Badge>
                                )}
                            </div>
                        )}
                        {project.downloads.length > 0 ? (
                            <div>
                                <button
                                    type="button"
                                    className="ws-action ws-action-primary inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold"
                                    onClick={goToDownloads}
                                >
                                    <ArrowDown
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    {meta.downloadsTitle}
                                </button>
                            </div>
                        ) : (
                            (project.link || project.codeLink) && (
                                <div className="flex flex-wrap gap-2">
                                    {project.link && (
                                        <OutLink
                                            href={project.link}
                                            className="ws-action-primary"
                                        >
                                            {meta.linkLabel}
                                        </OutLink>
                                    )}
                                    {project.codeLink && (
                                        <OutLink
                                            href={project.codeLink}
                                            icon={FolderGit2}
                                        >
                                            Source code
                                        </OutLink>
                                    )}
                                </div>
                            )
                        )}
                    </div>
                </div>

                {story && (
                    <IterationStory
                        project={project}
                        activeId={photos[index]?.id}
                        onPick={showPhoto}
                    />
                )}

                {project.downloads.length > 0 && (
                    <Downloads project={project} headingRef={downloadsRef} />
                )}

                <footer className="ws-section-rule px-4 py-5 sm:px-6">
                    <h3 className="sr-only">Credits</h3>
                    <dl className="flex flex-wrap gap-x-10 gap-y-4">
                        <div className="min-w-0">
                            <dt className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-base-content/60">
                                {meta.designersLabel}
                            </dt>
                            <dd className="mt-1 font-semibold text-base-content">
                                {designers || "The Huskyteers, FTC 19516"}
                            </dd>
                        </div>
                        {project.season && (
                            <div>
                                <dt className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-base-content/60">
                                    Season
                                </dt>
                                <dd className="mt-1 font-mono font-semibold text-base-content">
                                    {project.season}
                                </dd>
                            </div>
                        )}
                        {published && (
                            <div>
                                <dt className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-base-content/60">
                                    Published
                                </dt>
                                <dd className="mt-1 text-base-content/80">
                                    <time dateTime={project.publishedAt ?? undefined}>
                                        {published}
                                    </time>
                                </dd>
                            </div>
                        )}
                        {updated && updated !== published && (
                            <div>
                                <dt className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-base-content/60">
                                    Updated
                                </dt>
                                <dd className="mt-1 text-base-content/80">
                                    <time dateTime={project.updatedAt ?? undefined}>
                                        {updated}
                                    </time>
                                </dd>
                            </div>
                        )}
                    </dl>
                </footer>
            </div>
        </div>
    );
}

/* ---------- Dialog shell ---------- */

/**
 * Native modal <dialog>: focus moves in on open and back on close, Esc and a
 * backdrop click close it, the page behind is scroll-locked. Which project is
 * open is owned by the parent (the URL hash); `onClosed` reports a close that
 * started here (Esc, backdrop, close button).
 */
export function ProjectDialog({
    project,
    onClosed,
}: {
    project: WorkshopProject | null;
    onClosed: (projectId: string) => void;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const openId = useRef<string | null>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
    const downOnBackdrop = useRef(false);

    // Layout effect: open/close before paint so the content never flashes.
    useLayoutEffect(() => {
        const dlg = ref.current;
        if (!dlg) return;
        if (project) {
            if (!dlg.open) {
                const active = document.activeElement;
                returnFocus.current =
                    active instanceof HTMLElement && active !== document.body
                        ? active
                        : null;
                lockScroll();
                dlg.showModal();
            }
            openId.current = project.id;
        } else if (dlg.open) {
            dlg.close();
        }
    }, [project]);

    useEffect(() => unlockScroll, []);

    const handleClose = () => {
        unlockScroll();
        const id = openId.current;
        openId.current = null;
        const target =
            returnFocus.current?.isConnected === true
                ? returnFocus.current
                : id
                  ? document.getElementById(cardLinkId(id))
                  : null;
        returnFocus.current = null;
        target?.focus();
        if (id) onClosed(id);
    };

    return (
        <dialog
            ref={ref}
            className="ws-dialog"
            aria-labelledby={titleId}
            onClose={handleClose}
            onPointerDown={(e) => {
                downOnBackdrop.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
                // A click on the dialog element itself is a click on the
                // backdrop (the content box fills the dialog).
                if (e.target === e.currentTarget && downOnBackdrop.current) {
                    e.currentTarget.close();
                }
                downOnBackdrop.current = false;
            }}
        >
            {project && (
                <DialogBody
                    key={project.id}
                    project={project}
                    titleId={titleId}
                    onClose={() => ref.current?.close()}
                />
            )}
        </dialog>
    );
}
