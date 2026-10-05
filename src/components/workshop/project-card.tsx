import { memo, type MouseEvent } from "react";
import {
    ArrowUpRight,
    Download,
    FolderGit2,
    Layers,
    Star,
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
    cardLinkId,
    coverOf,
    downloadFormats,
    downloadName,
    formatBytes,
    iterationBadge,
    joinNames,
    KIND_META,
} from "./format";
import type { WorkshopProject } from "./types";
import { Badge, Fact, FramedImage, NoPhoto, OutLink } from "./ui";

type OpenHandler = (id: string) => void;

/** Plain clicks open the dialog in place; modified clicks keep link behaviour. */
function openOnClick(id: string, onOpen: OpenHandler) {
    return (e: MouseEvent<HTMLAnchorElement>) => {
        if (
            e.button !== 0 ||
            e.metaKey ||
            e.ctrlKey ||
            e.shiftKey ||
            e.altKey
        )
            return;
        e.preventDefault();
        onOpen(id);
    };
}

/** Title link stretched over the whole card (the card's single tab stop). */
function CardTitleLink({
    project,
    onOpen,
}: {
    project: WorkshopProject;
    onOpen: OpenHandler;
}) {
    return (
        <a
            id={cardLinkId(project.id)}
            href={`#${encodeURIComponent(project.id)}`}
            onClick={openOnClick(project.id, onOpen)}
            className="ws-stretched outline-none"
            aria-haspopup="dialog"
        >
            {project.title}
        </a>
    );
}

function FeaturedTag() {
    return (
        <span className="ws-featured-tag absolute top-3 left-3 inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em]">
            <Star className="size-3 fill-current" aria-hidden="true" />
            Featured
        </span>
    );
}

function CardBadges({
    project,
    downloads = true,
}: {
    project: WorkshopProject;
    /** Off when the card already lists its downloads as buttons. */
    downloads?: boolean;
}) {
    const iteration = iterationBadge(project);
    const formats = downloadFormats(project);
    const n = downloads ? project.downloads.length : 0;
    if (!project.season && !iteration && n === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {project.season && (
                <Badge title={`Season ${project.season}`}>
                    <span className="sr-only">Season </span>
                    {project.season}
                </Badge>
            )}
            {iteration && (
                <Badge tone="iterate" title="Design iterations">
                    <Layers className="size-3" aria-hidden="true" />
                    {iteration}
                </Badge>
            )}
            {n > 0 && (
                <Badge
                    tone="accent"
                    title={`${n} downloadable ${n === 1 ? "file" : "files"}`}
                >
                    <Download className="size-3" aria-hidden="true" />
                    <span className="sr-only">
                        {n} downloadable {n === 1 ? "file" : "files"}:{" "}
                    </span>
                    {formats.length <= 3 ? formats.join(" · ") : `${n} files`}
                </Badge>
            )}
        </div>
    );
}

/** Gallery card for 3D prints & CAD (also used for Other builds). */
export const PartCard = memo(function PartCard({
    project,
    onOpen,
}: {
    project: WorkshopProject;
    onOpen: OpenHandler;
}) {
    const meta = KIND_META[project.kind];
    const cover = coverOf(project);
    const designers = joinNames(project.designers);
    const both = Boolean(project.material && designers);

    return (
        <article
            className={cn(
                "ws-card group relative flex h-full flex-col overflow-hidden rounded-2xl",
                project.featured && "ws-card-featured",
            )}
        >
            <div className="ws-frame relative aspect-[4/3] overflow-hidden">
                {cover ? (
                    <FramedImage
                        photo={cover}
                        title={project.title}
                        className="ws-zoom"
                    />
                ) : (
                    <NoPhoto kind={project.kind} />
                )}
                {project.featured && <FeaturedTag />}
                <span
                    className="ws-open-hint absolute right-3 bottom-3 grid size-9 place-items-center rounded-full"
                    aria-hidden="true"
                >
                    <ArrowUpRight className="size-4" />
                </span>
            </div>

            <div className="flex flex-1 flex-col gap-3.5 p-4 sm:p-5">
                <h3 className="font-jockey text-[1.75rem] leading-[0.95] uppercase text-base-content">
                    <CardTitleLink project={project} onOpen={onOpen} />
                </h3>

                {(project.summary || project.material || designers) && (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                        {project.summary && (
                            <Fact label={meta.summaryLabel} className="col-span-2">
                                <span className="line-clamp-3">
                                    {project.summary}
                                </span>
                            </Fact>
                        )}
                        {project.material && (
                            <Fact
                                label={meta.materialLabel}
                                className={both ? undefined : "col-span-2"}
                            >
                                {project.material}
                            </Fact>
                        )}
                        {designers && (
                            <Fact
                                label={meta.designersLabel}
                                className={both ? undefined : "col-span-2"}
                            >
                                {designers}
                            </Fact>
                        )}
                    </dl>
                )}

                <div className="mt-auto pt-1">
                    <CardBadges project={project} />
                </div>
            </div>
        </article>
    );
});

/** Wider card for software: screenshot, summary, stack, people, links. */
export const SoftwareCard = memo(function SoftwareCard({
    project,
    onOpen,
}: {
    project: WorkshopProject;
    onOpen: OpenHandler;
}) {
    const meta = KIND_META[project.kind];
    const cover = coverOf(project);
    const designers = joinNames(project.designers);
    const hasActions =
        project.link || project.codeLink || project.downloads.length > 0;

    return (
        <article
            className={cn(
                "ws-card ws-card-wide group relative flex h-full flex-col overflow-hidden rounded-2xl sm:flex-row lg:flex-col",
                project.featured && "ws-card-featured",
            )}
        >
            <div className="ws-frame relative aspect-[16/10] shrink-0 overflow-hidden sm:aspect-auto sm:min-h-64 sm:w-[44%] lg:aspect-[16/10] lg:min-h-0 lg:w-full">
                {cover ? (
                    <FramedImage
                        photo={cover}
                        title={project.title}
                        className="ws-zoom object-top sm:absolute sm:inset-0 lg:static"
                    />
                ) : (
                    <NoPhoto kind={project.kind} />
                )}
                {project.featured && <FeaturedTag />}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3.5 p-4 sm:p-5">
                <h3 className="font-jockey text-[2rem] leading-[0.95] uppercase text-base-content">
                    <CardTitleLink project={project} onOpen={onOpen} />
                </h3>

                {project.summary && (
                    <p className="line-clamp-3 text-sm text-base-content/80">
                        {project.summary}
                    </p>
                )}

                {(project.material || designers) && (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                        {project.material && (
                            <Fact
                                label={meta.materialLabel}
                                className={designers ? undefined : "col-span-2"}
                            >
                                {project.material}
                            </Fact>
                        )}
                        {designers && (
                            <Fact
                                label={meta.designersLabel}
                                className={
                                    project.material ? undefined : "col-span-2"
                                }
                            >
                                {designers}
                            </Fact>
                        )}
                    </dl>
                )}

                <CardBadges project={project} downloads={false} />

                {hasActions && (
                    <div className="relative z-10 mt-auto flex flex-wrap gap-2 pt-1">
                        {project.link && (
                            <OutLink href={project.link} className="ws-action-primary">
                                {meta.linkLabel}
                            </OutLink>
                        )}
                        {project.codeLink && (
                            <OutLink href={project.codeLink} icon={FolderGit2}>
                                Source code
                            </OutLink>
                        )}
                        {project.downloads.map((d) => (
                            <a
                                key={d.id}
                                href={d.href}
                                download={downloadName(d)}
                                className="ws-action inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold"
                            >
                                <Download
                                    className="size-4 shrink-0"
                                    aria-hidden="true"
                                />
                                <span className="sr-only">Download </span>
                                {d.label || d.format}
                                {d.size > 0 && (
                                    <span className="font-mono text-xs font-normal text-base-content/60">
                                        {formatBytes(d.size)}
                                    </span>
                                )}
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </article>
    );
});
