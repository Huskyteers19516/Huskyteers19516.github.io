import type { ReactNode } from "react";
import { Box, CodeXml, ExternalLink, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { altFor } from "./format";
import type { WorkshopKind, WorkshopPhoto } from "./types";

export const KIND_ICON: Record<WorkshopKind, LucideIcon> = {
    PART: Box,
    SOFTWARE: CodeXml,
    OTHER: Wrench,
};

/** Small mono uppercase label (matches the Progress page's kicker). */
export function Kicker({
    className,
    children,
    as: Tag = "p",
    id,
}: {
    className?: string;
    children: ReactNode;
    as?: "p" | "h2" | "h3" | "h4" | "span";
    id?: string;
}) {
    return (
        <Tag
            id={id}
            className={cn(
                "font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-base-content/65",
                className,
            )}
        >
            {children}
        </Tag>
    );
}

export function Badge({
    children,
    tone = "plain",
    className,
    title,
}: {
    children: ReactNode;
    tone?: "plain" | "accent" | "iterate";
    className?: string;
    title?: string;
}) {
    return (
        <span
            title={title}
            className={cn(
                "ws-badge inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[0.6875rem] leading-none font-medium uppercase tracking-[0.08em] whitespace-nowrap",
                tone === "accent" && "ws-badge-accent",
                tone === "iterate" && "ws-badge-iterate",
                className,
            )}
        >
            {children}
        </span>
    );
}

/** A labelled fact inside a <dl>. */
export function Fact({
    label,
    children,
    className,
}: {
    label: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("min-w-0", className)}>
            <dt className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-(--ws-ink)">
                {label}
            </dt>
            <dd className="mt-0.5 break-words text-base-content/85">
                {children}
            </dd>
        </div>
    );
}

/** A photo cropped into its frame; keeps intrinsic size to avoid layout shift. */
export function FramedImage({
    photo,
    title,
    className,
    eager = false,
}: {
    photo: WorkshopPhoto;
    title: string;
    className?: string;
    eager?: boolean;
}) {
    return (
        <img
            src={photo.src}
            width={photo.width || 1200}
            height={photo.height || 900}
            alt={altFor(title, photo)}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className={cn("size-full object-cover", className)}
        />
    );
}

/** Shown in place of a cover when a project has no photo yet. */
export function NoPhoto({
    kind,
    className,
}: {
    kind: WorkshopKind;
    className?: string;
}) {
    const Icon = KIND_ICON[kind];
    return (
        <div
            className={cn(
                "ws-placeholder grid size-full place-items-center",
                className,
            )}
        >
            <div className="flex flex-col items-center gap-2 text-(--ws-ink)">
                <Icon className="size-8" aria-hidden="true" />
                <span className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-base-content/60">
                    Photo coming soon
                </span>
            </div>
        </div>
    );
}

/** An http(s) link that opens in a new tab. */
export function OutLink({
    href,
    icon: Icon = ExternalLink,
    children,
    className,
}: {
    href: string;
    icon?: LucideIcon;
    children: ReactNode;
    className?: string;
}) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "ws-action inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold",
                className,
            )}
        >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {children}
            <span className="sr-only"> (opens in a new tab)</span>
        </a>
    );
}
