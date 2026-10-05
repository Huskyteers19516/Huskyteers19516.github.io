/**
 * Shape of GET {PUBLIC_PORTAL_URL}/api/public/workshop, the public, read-only
 * list of team projects (3D prints & CAD, software, other builds) served by
 * the Huskyteers Teammate Portal.
 *
 * The page never trusts the payload: `parseWorkshop` validates and normalises
 * it, resolves photo/download paths to absolute URLs and drops anything
 * malformed instead of crashing the island.
 */

export type WorkshopKind = "PART" | "SOFTWARE" | "OTHER";

/* ---------- Wire format (exact contract) ---------- */

export interface PublicWorkshopPhoto {
    id: string;
    /** "/api/public/workshop/photos/<id>" on the portal. */
    path: string;
    width: number;
    height: number;
    /** e.g. "Version 1"; "" when none. */
    label: string;
    /** What changed / what failed; "" when none. */
    note: string;
}

export interface PublicWorkshopDownload {
    id: string;
    /** "/api/public/workshop/files/<id>" on the portal, served as a download. */
    path: string;
    filename: string;
    /** "STL", "STEP", "3MF", "PDF", "ZIP"… */
    format: string;
    /** Bytes. */
    size: number;
    /** e.g. "Print-ready STL"; "" when none. */
    label: string;
}

export interface PublicWorkshopProject {
    id: string;
    kind: WorkshopKind;
    title: string;
    summary: string;
    material: string;
    season: string;
    designers: string[];
    featured: boolean;
    link: string | null;
    codeLink: string | null;
    cover: PublicWorkshopPhoto | null;
    photos: PublicWorkshopPhoto[];
    downloads: PublicWorkshopDownload[];
    publishedAt: string;
    updatedAt: string;
}

export interface PublicWorkshop {
    updatedAt: string;
    /** Featured first, then newest. */
    projects: PublicWorkshopProject[];
}

/* ---------- Normalised view model ---------- */

export interface WorkshopPhoto {
    id: string;
    /** Absolute, ready-to-use image URL. */
    src: string;
    width: number;
    height: number;
    label: string;
    note: string;
}

export interface WorkshopDownload {
    id: string;
    /** Absolute, ready-to-use download URL. */
    href: string;
    filename: string;
    format: string;
    size: number;
    label: string;
}

export interface WorkshopProject {
    id: string;
    kind: WorkshopKind;
    title: string;
    summary: string;
    material: string;
    season: string;
    designers: string[];
    featured: boolean;
    /** Only http(s) URLs survive parsing. */
    link: string | null;
    codeLink: string | null;
    cover: WorkshopPhoto | null;
    photos: WorkshopPhoto[];
    downloads: WorkshopDownload[];
    publishedAt: string | null;
    updatedAt: string | null;
}

export interface WorkshopData {
    updatedAt: string | null;
    projects: WorkshopProject[];
}

/** Turns a payload `path` into an absolute URL, or null to drop the item. */
export type AssetResolver = (path: string) => string | null;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj =>
    typeof v === "object" && v !== null && !Array.isArray(v);

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const text = (v: unknown, max: number): string => {
    if (typeof v !== "string") return "";
    return v.trim().slice(0, max);
};

const count = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

const isoDate = (v: unknown): string | null =>
    typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null;

/** Returns the URL when it is an absolute http(s) URL, else null. */
export function safeHttpUrl(v: unknown): string | null {
    if (typeof v !== "string") return null;
    const raw = v.trim();
    if (!/^https?:\/\//i.test(raw) || raw.length > 2048) return null;
    try {
        const url = new URL(raw);
        return url.protocol === "http:" || url.protocol === "https:"
            ? url.href
            : null;
    } catch {
        return null;
    }
}

/** Resolver for live data: portal-relative paths only. */
export function portalResolver(portalUrl: string): AssetResolver {
    const base = portalUrl.replace(/\/+$/, "");
    return (path) =>
        path.startsWith("/") && !path.startsWith("//") ? base + path : null;
}

const KINDS: readonly WorkshopKind[] = ["PART", "SOFTWARE", "OTHER"];

function parsePhoto(v: unknown, resolve: AssetResolver): WorkshopPhoto | null {
    if (!isObj(v)) return null;
    const id = text(v.id, 128);
    const src = typeof v.path === "string" ? resolve(v.path.trim()) : null;
    if (!id || !src) return null;
    return {
        id,
        src,
        width: count(v.width),
        height: count(v.height),
        label: text(v.label, 80),
        note: text(v.note, 1000),
    };
}

function parseDownload(
    v: unknown,
    resolve: AssetResolver,
): WorkshopDownload | null {
    if (!isObj(v)) return null;
    const id = text(v.id, 128);
    const href = typeof v.path === "string" ? resolve(v.path.trim()) : null;
    if (!id || !href) return null;
    const filename = text(v.filename, 200);
    const format =
        text(v.format, 12).toUpperCase() ||
        (/\.([a-z0-9]{1,8})$/i.exec(filename)?.[1].toUpperCase() ?? "FILE");
    return {
        id,
        href,
        filename: filename || `${id}.${format.toLowerCase()}`,
        format,
        size: count(v.size),
        label: text(v.label, 120),
    };
}

function parseProject(
    v: unknown,
    resolve: AssetResolver,
): WorkshopProject | null {
    if (!isObj(v)) return null;
    const id = text(v.id, 128);
    const title = text(v.title, 160);
    if (!id || !title) return null;

    const kind = KINDS.includes(v.kind as WorkshopKind)
        ? (v.kind as WorkshopKind)
        : "OTHER";

    const seenPhotos = new Set<string>();
    const photos: WorkshopPhoto[] = [];
    for (const p of list(v.photos)) {
        const photo = parsePhoto(p, resolve);
        if (!photo || seenPhotos.has(photo.id)) continue;
        seenPhotos.add(photo.id);
        photos.push(photo);
    }

    const cover = parsePhoto(v.cover, resolve);

    const seenFiles = new Set<string>();
    const downloads: WorkshopDownload[] = [];
    for (const d of list(v.downloads)) {
        const file = parseDownload(d, resolve);
        if (!file || seenFiles.has(file.id)) continue;
        seenFiles.add(file.id);
        downloads.push(file);
    }

    const designers: string[] = [];
    for (const name of list(v.designers)) {
        const n = text(name, 80);
        // Not de-duplicated: the portal already lists each person once, and two different people can share a
        // shortened name ("Sam L.", "E.C.").
        if (n) designers.push(n);
    }

    return {
        id,
        kind,
        title,
        summary: text(v.summary, 1000),
        material: text(v.material, 160),
        season: text(v.season, 24),
        designers: designers.slice(0, 20),
        featured: v.featured === true,
        link: safeHttpUrl(v.link),
        codeLink: safeHttpUrl(v.codeLink),
        cover,
        photos: photos.slice(0, 40),
        downloads: downloads.slice(0, 20),
        publishedAt: isoDate(v.publishedAt),
        updatedAt: isoDate(v.updatedAt),
    };
}

/**
 * Validates an unknown JSON value against the public workshop contract.
 * Returns null when the payload is unusable (wrong shape entirely).
 */
export function parseWorkshop(
    raw: unknown,
    resolve: AssetResolver,
): WorkshopData | null {
    if (!isObj(raw) || !Array.isArray(raw.projects)) return null;
    const seen = new Set<string>();
    const projects: WorkshopProject[] = [];
    for (const p of raw.projects) {
        const project = parseProject(p, resolve);
        if (!project || seen.has(project.id)) continue;
        seen.add(project.id);
        projects.push(project);
    }
    return { updatedAt: isoDate(raw.updatedAt), projects };
}
