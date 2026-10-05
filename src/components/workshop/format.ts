import type {
    WorkshopDownload,
    WorkshopKind,
    WorkshopPhoto,
    WorkshopProject,
} from "./types";

/** Per-kind wording used by cards and the detail dialog. */
export interface KindMeta {
    section: string;
    singular: string;
    summaryLabel: string;
    materialLabel: string;
    designersLabel: string;
    linkLabel: string;
    downloadsTitle: string;
}

export const KIND_META: Record<WorkshopKind, KindMeta> = {
    PART: {
        section: "3D prints & CAD",
        singular: "3D print / CAD",
        summaryLabel: "On the robot",
        materialLabel: "Material",
        designersLabel: "Designed by",
        linkLabel: "Open the CAD",
        downloadsTitle: "Download the design",
    },
    SOFTWARE: {
        section: "Software",
        singular: "Software",
        summaryLabel: "What it does",
        materialLabel: "Built with",
        designersLabel: "Built by",
        linkLabel: "Visit",
        downloadsTitle: "Try it",
    },
    OTHER: {
        section: "Other builds",
        singular: "Build",
        summaryLabel: "What it is",
        materialLabel: "Made with",
        designersLabel: "Built by",
        linkLabel: "Learn more",
        downloadsTitle: "Files & links",
    },
};

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[]): string {
    if (names.length <= 1) return names[0] ?? "";
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Human-readable file size: "812 B", "42 KB", "1.2 MB". */
export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    const digits = unit === 0 || value >= 10 ? 0 : 1;
    return `${value.toFixed(digits)} ${units[unit]}`;
}

const dayFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
});

export function formatDate(iso: string | null): string {
    if (!iso) return "";
    const t = Date.parse(iso);
    return Number.isNaN(t) ? "" : dayFmt.format(new Date(t));
}

/** The photo to show first: the cover, else the latest version. */
export function coverOf(project: WorkshopProject): WorkshopPhoto | null {
    return project.cover ?? project.photos.at(-1) ?? null;
}

/** All photos for the viewer, in story order, always including the cover. */
export function viewerPhotos(project: WorkshopProject): WorkshopPhoto[] {
    const { cover, photos } = project;
    if (!cover) return photos;
    return photos.some((p) => p.id === cover.id) ? photos : [cover, ...photos];
}

export function altFor(title: string, photo: WorkshopPhoto): string {
    return photo.label ? `${title} — ${photo.label}` : title;
}

/**
 * "Version 1 → Version 3" when 2+ photos are labelled, "3 versions" for
 * unlabelled multi-photo parts, otherwise null.
 */
export function iterationBadge(project: WorkshopProject): string | null {
    const labelled = project.photos.filter((p) => p.label);
    if (labelled.length >= 2) {
        return `${labelled[0].label} → ${labelled[labelled.length - 1].label}`;
    }
    if (project.kind === "PART" && project.photos.length >= 2) {
        return `${project.photos.length} versions`;
    }
    return null;
}

/** Label for a step of the iteration story. */
export function stepLabel(
    kind: WorkshopKind,
    photo: WorkshopPhoto,
    index: number,
): string {
    if (photo.label) return photo.label;
    return kind === "PART" ? `Version ${index + 1}` : `Step ${index + 1}`;
}

/** Whether the photos tell an iteration story worth a timeline. */
export function hasStory(project: WorkshopProject): boolean {
    if (project.photos.length < 2) return false;
    return (
        project.kind === "PART" ||
        project.photos.some((p) => p.label || p.note)
    );
}

/** Unique download formats, e.g. ["STL", "STEP"]. */
export function downloadFormats(project: WorkshopProject): string[] {
    return [...new Set(project.downloads.map((d) => d.format))];
}

/** Saved filename; demo stand-ins (data: text) are honestly named .txt. */
export function downloadName(d: WorkshopDownload): string {
    return d.href.startsWith("data:text/plain")
        ? `${d.filename}.demo.txt`
        : d.filename;
}

/** DOM id of the link that opens a project's dialog (focus target on close). */
export const cardLinkId = (projectId: string) => `ws-open-${projectId}`;
