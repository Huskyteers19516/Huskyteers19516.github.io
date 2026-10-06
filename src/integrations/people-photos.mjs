/**
 * Build guard for the Our Team page's photos (src/assets/images/people/).
 *
 * - Warns (dev and build) about a photo that carries EXIF data or a GPS
 *   location: the repo is public, so anyone can read it from the file.
 * - After a build, deletes from dist/ every original photo from that folder
 *   that no page uses. Astro copies every image the page's photo lookup can
 *   reach into dist/_astro at full size, even one that matches nobody; only
 *   the resized WebP copies of the matched photos are shown. A file left in
 *   the folder (say, of someone who left the team) is no longer published
 *   with the site — it's still in the GitHub repo, so delete it there too.
 *   (The page also warns about such files: photos.ts.)
 *
 * Plain JavaScript with no dependencies, so astro.config.mjs and the tests
 * (tests/team.test.mjs) can both load it. (Not type-checked: the site has no
 * Node type definitions; the JSDoc types are for editors.)
 */
import { readdir, readFile, stat, unlink } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** The photo types the page picks up (any letter case). */
export const PEOPLE_PHOTO_RE = /\.(png|jpe?g|webp)$/i;
const IMAGE_RE = /\.(png|jpe?g|webp|avif|gif)$/i;
/** Built files that can point at an image. */
const TEXT_RE = /\.(html?|m?js|css|json|xml|txt|svg|webmanifest)$/i;

const EXIF = "EXIF data (camera, time taken, and maybe the GPS location)";
const GPS = "a GPS location in its XMP data";
const PACKED = "compressed metadata that may hold a location";

const latin1 = (/** @type {Uint8Array} */ b, start = 0, end = b.length) => {
    let s = "";
    for (let i = start; i < Math.min(end, b.length); i++) s += String.fromCharCode(b[i]);
    return s;
};

/** @param {Uint8Array} b */
function jpegProblems(b) {
    /** @type {string[]} */
    const out = [];
    let i = 2;
    while (i + 4 <= b.length) {
        if (b[i] !== 0xff) break;
        const marker = b[i + 1];
        if (marker === 0xff) {
            i += 1; // fill byte
            continue;
        }
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
            i += 2; // no length
            continue;
        }
        if (marker === 0xda || marker === 0xd9) break; // image data / end
        const len = (b[i + 2] << 8) | b[i + 3];
        if (len < 2) break;
        if (marker === 0xe1) {
            const data = latin1(b, i + 4, i + 2 + len);
            if (data.startsWith("Exif\0")) out.push(EXIF);
            else if (data.startsWith("http://ns.adobe.com/xap/") && /GPS/.test(data)) out.push(GPS);
        }
        i += 2 + len;
    }
    return out;
}

/** @param {Uint8Array} b */
function pngProblems(b) {
    /** @type {string[]} */
    const out = [];
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let i = 8;
    while (i + 12 <= b.length) {
        const len = view.getUint32(i);
        const type = latin1(b, i + 4, i + 8);
        const start = i + 8;
        const end = Math.min(b.length, start + len);
        if (type === "eXIf") out.push(EXIF);
        else if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
            let nul = start;
            while (nul < end && b[nul] !== 0) nul++;
            const keyword = latin1(b, start, nul);
            const compressed = type === "zTXt" || (type === "iTXt" && b[nul + 1] === 1);
            if (/^Raw profile type (exif|APP1)$/i.test(keyword)) out.push(EXIF);
            else if (compressed) {
                if (/xmp|exif/i.test(keyword)) out.push(PACKED);
            } else if (/GPS/.test(latin1(b, nul, end))) out.push(GPS);
        }
        if (type === "IEND") break;
        i = start + len + 4;
    }
    return out;
}

/** @param {Uint8Array} b */
function webpProblems(b) {
    /** @type {string[]} */
    const out = [];
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let i = 12;
    while (i + 8 <= b.length) {
        const type = latin1(b, i, i + 4);
        const len = view.getUint32(i + 4, true);
        if (type === "EXIF") out.push(EXIF);
        else if (type === "XMP " && /GPS/.test(latin1(b, i + 8, i + 8 + len))) out.push(GPS);
        i += 8 + len + (len % 2);
    }
    return out;
}

/**
 * What a photo file carries that shouldn't go public: EXIF data (phones put
 * the GPS location there), a GPS location in XMP, or compressed metadata
 * that can't be checked. Empty for a clean file (or one it doesn't know).
 * @param {Uint8Array} bytes
 * @returns {string[]}
 */
export function photoMetadataProblems(bytes) {
    /** @type {string[]} */
    let found = [];
    if (bytes[0] === 0xff && bytes[1] === 0xd8) found = jpegProblems(bytes);
    else if (latin1(bytes, 0, 8) === "\x89PNG\r\n\x1a\n") found = pngProblems(bytes);
    else if (latin1(bytes, 0, 4) === "RIFF" && latin1(bytes, 8, 12) === "WEBP") found = webpProblems(bytes);
    return [...new Set(found)];
}

/** @param {string} dir */
async function listDir(dir) {
    try {
        return await readdir(dir);
    } catch {
        return [];
    }
}

/**
 * The photos in `photosDir` with metadata problems.
 * @param {string} photosDir
 * @returns {Promise<{ file: string; problems: string[] }[]>}
 */
export async function findPhotoMetadata(photosDir) {
    const out = [];
    for (const file of (await listDir(photosDir)).sort()) {
        if (!PEOPLE_PHOTO_RE.test(file)) continue;
        const problems = photoMetadataProblems(await readFile(join(photosDir, file)));
        if (problems.length) out.push({ file, problems });
    }
    return out;
}

/** @param {string} dir @returns {Promise<string[]>} */
async function walk(dir) {
    /** @type {string[]} */
    const out = [];
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const e of entries) {
        const path = join(dir, e.name);
        if (e.isDirectory()) out.push(...(await walk(path)));
        else if (e.isFile()) out.push(path);
    }
    return out;
}

/**
 * Deletes from `distDir` every byte-for-byte copy of a photo in `photosDir`
 * whose file name no built page, script, or style mentions. Returns the
 * deleted files, relative to `distDir`.
 * @param {{ distDir: string; photosDir: string }} dirs
 * @returns {Promise<string[]>}
 */
export async function pruneUnusedPeoplePhotos({ distDir, photosDir }) {
    const photos = (await listDir(photosDir)).filter((f) => PEOPLE_PHOTO_RE.test(f));
    if (photos.length === 0) return [];
    /** @type {Map<number, Buffer[]>} */
    const bySize = new Map();
    for (const f of photos) {
        const buf = await readFile(join(photosDir, f));
        bySize.set(buf.length, [...(bySize.get(buf.length) ?? []), buf]);
    }

    const files = await walk(distDir);
    /** @type {string[]} */
    const copies = [];
    for (const f of files) {
        if (!IMAGE_RE.test(f)) continue;
        const same = bySize.get((await stat(f)).size);
        if (!same) continue;
        const buf = await readFile(f);
        if (same.some((o) => o.equals(buf))) copies.push(f);
    }
    if (copies.length === 0) return [];

    /** @type {string[]} */
    const texts = [];
    for (const f of files) if (TEXT_RE.test(f)) texts.push(await readFile(f, "utf8"));
    /** @type {string[]} */
    const removed = [];
    for (const f of copies) {
        const name = basename(f);
        const encoded = encodeURIComponent(name);
        if (texts.some((t) => t.includes(name) || t.includes(encoded))) continue;
        await unlink(f);
        removed.push(relative(distDir, f));
    }
    return removed;
}

/** @returns {import("astro").AstroIntegration} */
export default function peoplePhotos() {
    let photosDir = "";
    return {
        name: "huskyteers:people-photos",
        hooks: {
            "astro:config:done": async ({ config, logger }) => {
                photosDir = fileURLToPath(new URL("src/assets/images/people/", config.root));
                for (const { file, problems } of await findPhotoMetadata(photosDir)) {
                    logger.warn(
                        `src/assets/images/people/${file} has ${problems.join(" and ")}. ` +
                            "The repo is public, so anyone can read it from the file: remove it before committing " +
                            `(exiftool -all= -overwrite_original "src/assets/images/people/${file}"), ` +
                            "or export the photo again without location.",
                    );
                }
            },
            "astro:build:done": async ({ dir, logger }) => {
                if (!photosDir) return;
                const removed = await pruneUnusedPeoplePhotos({ distDir: fileURLToPath(dir), photosDir });
                for (const f of removed) {
                    logger.info(`left ${f} out of the site: an original from src/assets/images/people/ that no page shows.`);
                }
            },
        },
    };
}
