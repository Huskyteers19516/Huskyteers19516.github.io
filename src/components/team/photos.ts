/**
 * Build-time photo lookup for the Our Team page (Person.astro and
 * src/pages/about/team.astro). Which file a person gets is decided by
 * `choosePhoto` in ./roster.ts; this module loads the files in
 * src/assets/images/people/ and resizes them with astro:assets (square,
 * cropped from the top of tall photos so heads stay in, WebP, 1x + 2x).
 *
 * Teammates' own photos from the Teammate Portal aren't handled here: the
 * page's island (team-live.tsx) lays them over these on the client — over
 * a folder photo or initials, never over an entry's explicit `image` (see
 * `shownPhoto` in ./portal-photos.ts).
 *
 * Only those resized copies are shown. The glob below makes Vite copy every
 * file in the folder into the build at full size; the people-photos
 * integration (src/integrations/people-photos.mjs) deletes the copies no
 * page uses after the build, and `warnUnusedPhotos` names the files that
 * match nobody (they're still in the public GitHub repo).
 */
import { getImage } from "astro:assets";
import type { ImageMetadata } from "astro";
import type { BuildPhotoSource } from "./portal-photos";
import { photoForName, photoFromImage, unusedPhotoFiles } from "./roster";

/** Every photo in src/assets/images/people/ (lower or upper case extensions). */
const FILES = import.meta.glob<{ default: ImageMetadata }>(
    "/src/assets/images/people/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}",
    { eager: true },
);

/** One rendition of a photo, ready for an <img>. */
export interface PhotoSet {
    src: string;
    /** "" for photos that aren't resized (links). */
    srcSet: string;
    width: number;
    height: number;
}

/** Card size (shown at up to 136 px) and dialog size (up to 224 px). */
export interface PersonPhoto {
    card: PhotoSet;
    large: PhotoSet;
    /**
     * "image": the entry's `image` (an explicit choice: shown even when the
     * person has a portal photo); "folder": the file named after them (their
     * portal photo, when they have one, replaces it on the page).
     */
    source: Exclude<BuildPhotoSource, null>;
}

/** What `image` may be in team.astro: a file name, a link, or an imported image. */
export type PhotoInput = string | ImageMetadata | null | undefined;

// `in` checks only: reading an imported image's `src` during the build marks
// its full-size original as used (Astro then keeps it in the build).
const isImageMetadata = (v: unknown): v is ImageMetadata =>
    typeof v === "object" && v !== null && "src" in v && "width" in v;

/** An imported image's file on disk (build only), without touching `src`. */
const fsPathOf = (image: ImageMetadata): string | undefined => {
    const p = (image as { fsPath?: unknown }).fsPath;
    return typeof p === "string" ? p : undefined;
};

/** Card photo size in px (the frame is 8.5rem = 136 px at most). */
const CARD_SIZE = 144;

async function square(src: ImageMetadata, size: number): Promise<PhotoSet> {
    const img = await getImage({
        src,
        width: size,
        height: size,
        fit: "cover",
        // Keep the top of tall photos (heads), centered left-right.
        position: "top",
        densities: [1, 2],
        format: "webp",
        quality: 80,
    });
    return {
        src: img.src,
        srcSet: img.srcSet.attribute,
        width: size,
        height: size,
    };
}

const cache = new Map<string, Promise<PersonPhoto | null>>();
const warned = new Set<string>();

/**
 * The resized photo for a person, or null (the page shows initials, or
 * their portal photo). Same rules as `choosePhoto` in ./roster.ts: `image`
 * first, then a file named after them. An `image` that points at nothing
 * counts as not set (source "folder" or null), so the portal photo can
 * still replace what's shown.
 */
export function resolvePhoto(
    name: string,
    image: PhotoInput,
): Promise<PersonPhoto | null> {
    const key = `${name}\u0000${isImageMetadata(image) ? (fsPathOf(image) ?? image.src) : (image ?? "")}`;
    let hit = cache.get(key);
    if (!hit) {
        hit = load(name, image);
        cache.set(key, hit);
    }
    return hit;
}

async function load(name: string, image: PhotoInput): Promise<PersonPhoto | null> {
    if (isImageMetadata(image)) {
        return {
            card: await square(image, CARD_SIZE),
            large: await square(image, 224),
            source: "image",
        };
    }
    const files = Object.keys(FILES);
    const wanted = typeof image === "string" ? image.trim() : "";
    const fromImage = photoFromImage(wanted, files);
    if (wanted && !fromImage && !warned.has(wanted)) {
        warned.add(wanted);
        console.warn(
            `[team] ${name}: image "${wanted}" isn't in src/assets/images/people/ (using their name instead).`,
        );
    }
    const choice = fromImage ?? photoForName(name, files);
    const source = fromImage ? "image" : "folder";
    if (choice?.kind === "url") {
        const set = { src: choice.url, srcSet: "", width: 224, height: 224 };
        return { card: { ...set, width: CARD_SIZE, height: CARD_SIZE }, large: set, source };
    }
    if (!choice) return null;
    const meta = FILES[choice.path]?.default;
    if (!meta) return null;
    return {
        card: await square(meta, CARD_SIZE),
        large: await square(meta, 224),
        source,
    };
}

const warnedUnused = new Set<string>();

/**
 * Warns (once per file) about photos in src/assets/images/people/ that
 * nobody in `people` (the page's entries) uses — by name or through
 * `image`. They aren't shown and the build leaves them out, but the GitHub
 * repo is public: delete the file, or point an entry at it with `image`.
 */
export function warnUnusedPhotos(
    people: readonly { name: string; image?: PhotoInput }[],
): void {
    const files = Object.keys(FILES);
    const imported: string[] = [];
    for (const p of people) {
        if (!isImageMetadata(p.image)) continue;
        const fsPath = fsPathOf(p.image);
        const hit = fsPath && files.find((f) => fsPath.endsWith(f));
        if (hit) imported.push(hit);
    }
    for (const file of unusedPhotoFiles(people, files, imported)) {
        if (warnedUnused.has(file)) continue;
        warnedUnused.add(file);
        const name = file.split("/").pop();
        console.warn(
            // Own line: the build log prints the page's path just before.
            `\n[team] ${file.replace(/^\/src\/assets\/images\//, "")} matches nobody on the Our Team page. ` +
                "It isn't shown (the build leaves it out), but it's still public in the GitHub repo: " +
                `delete it, or point an entry at it with image: "${name}".`,
        );
    }
}
