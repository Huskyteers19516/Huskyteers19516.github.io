/**
 * Teammates' own photos from the Teammate Portal, for the Our Team page
 * (cards and profile dialog) and the people rows on /progress.
 *
 * Shape of GET {PUBLIC_PORTAL_URL}/api/public/team-photos:
 *
 *   { enabled: true, updatedAt,
 *     photos: [{ key: "26ec013e…" (32 hex), photo: "/api/public/team-photos/<id>" }] }
 *   { enabled: false }   // the owner turned members' photos off
 *
 * Members upload a photo in the portal (Settings → My photo); it's listed
 * while they leave "Show my photo on the team website" on, nobody who
 * manages their account holds it off (e.g. right after they renamed
 * themselves), and the owner leaves "Show members' photos on the team
 * website" on (Admin → Team website). `key` is a hash of their full name
 * (`teamPhotoKey` in ./name-key.ts) — the JSON never says the name, so it
 * isn't a list of who's on the team; the site hashes the names it already
 * shows and matches. `photo` is the portal's image route for that upload (a
 * new upload is a new id, so the address never shows different bytes).
 *
 * The site never trusts the payload: `parseTeamPhotos` keeps only the key
 * and a photo address on the portal's own photo route (relative, or absolute
 * on the portal's origin, one plain id, no query) and drops everything else.
 *
 * Which photo a person shows (`shownPhoto`):
 *   1. the entry's explicit `image` in team.astro (the owner's choice),
 *   2. else their portal photo,
 *   3. else the build-time photo named after them (src/assets/images/people/),
 *   4. else their initials.
 * Matching is by full name, like the live progress (`normalizeName`: case,
 * spaces and accents ignored — the portal hashes the same normalized name).
 * A key listed twice matches nobody, so a card never shows someone else's
 * photo.
 *
 * Pure module, so the tests in tests/ can load it with Node's type stripping.
 */
import {
    isObj,
    isoDate,
    list,
    PORTAL_ID_RE,
    PortalHttpError,
} from "../../lib/portal-json.ts";
import { TEAM_PHOTO_KEY_RE, teamPhotoKey } from "./name-key.ts";
import { NOT_PUBLIC_STATUSES } from "./person-detail.ts";

/** The list (static path on the portal). */
export const TEAM_PHOTOS_PATH = "/api/public/team-photos";
/** One photo: this prefix + its id. */
export const TEAM_PHOTO_PREFIX = "/api/public/team-photos/";

/** Most photos kept from one payload (the team is a few dozen people). */
export const MAX_TEAM_PHOTOS = 300;

export interface TeamPhoto {
    /** The hash of their full name (`teamPhotoKey`), never the name. */
    key: string;
    /** Absolute URL of the photo on the portal. */
    src: string;
}

export interface TeamPhotosEnabled {
    enabled: true;
    updatedAt: string;
    photos: TeamPhoto[];
}

export type TeamPhotosPayload = TeamPhotosEnabled | { enabled: false };

/**
 * A photo reference from the payload as an absolute URL on the portal. Only
 * the portal's own photo route with a plain id is accepted (relative, or
 * absolute on the portal's origin) — never another host, path, query string
 * or #fragment (the portal redirects a query string anyway).
 */
export function teamPhotoUrl(v: unknown, portalUrl: string): string | null {
    if (typeof v !== "string" || v.length > 300) return null;
    let base: URL;
    try {
        base = new URL(portalUrl);
    } catch {
        return null;
    }
    let u: URL;
    try {
        u = new URL(v, base);
    } catch {
        return null;
    }
    if (u.origin !== base.origin || u.search || u.hash) return null;
    if (u.username || u.password) return null;
    if (!u.pathname.startsWith(TEAM_PHOTO_PREFIX)) return null;
    const id = u.pathname.slice(TEAM_PHOTO_PREFIX.length);
    if (!PORTAL_ID_RE.test(id)) return null;
    return `${base.origin}${TEAM_PHOTO_PREFIX}${id}`;
}

/**
 * Validates an unknown JSON value against the team photos contract. Returns
 * null when the payload is unusable (wrong shape entirely). Keeps only each
 * entry's key (32 lowercase hex characters) and photo address.
 */
export function parseTeamPhotos(
    raw: unknown,
    portalUrl: string,
): TeamPhotosPayload | null {
    if (!isObj(raw)) return null;
    if (raw.enabled === false) return { enabled: false };
    if (raw.enabled !== true || !Array.isArray(raw.photos)) return null;

    const photos: TeamPhoto[] = [];
    for (const entry of list(raw.photos).slice(0, MAX_TEAM_PHOTOS * 2)) {
        if (photos.length >= MAX_TEAM_PHOTOS) break;
        if (!isObj(entry)) continue;
        const key = typeof entry.key === "string" && TEAM_PHOTO_KEY_RE.test(entry.key) ? entry.key : null;
        const src = teamPhotoUrl(entry.photo, portalUrl);
        if (!key || !src) continue;
        photos.push({ key, src });
    }
    return {
        enabled: true,
        updatedAt: isoDate(raw.updatedAt) ?? new Date().toISOString(),
        photos,
    };
}

/**
 * Wraps the list's fetcher: a "not public" status (a portal without this
 * endpoint answers 401/404) becomes `{ enabled: false }` — final, no
 * retrying. Network errors and 5xx still throw (retried with backoff).
 */
export function teamPhotosFetcher(
    fetchJson: (signal: AbortSignal) => Promise<unknown>,
): (signal: AbortSignal) => Promise<unknown> {
    return async (signal) => {
        try {
            return await fetchJson(signal);
        } catch (e) {
            if (
                e instanceof PortalHttpError &&
                NOT_PUBLIC_STATUSES.includes(e.status)
            ) {
                return { enabled: false };
            }
            throw e;
        }
    };
}

/** Name key (`teamPhotoKey`) -> photo URL. */
export type PhotoIndex = ReadonlyMap<string, string>;

export const NO_PHOTOS: PhotoIndex = new Map();

/**
 * The photos by key. A key listed twice (two people with the same name) is
 * left out: neither gets a photo rather than maybe the wrong one. `resolve`
 * maps each URL (the dev demo points them at generated pictures).
 */
export function photoIndex(
    photos: readonly TeamPhoto[],
    resolve: (src: string) => string = (src) => src,
): PhotoIndex {
    const byKey = new Map<string, string | null>();
    for (const p of photos) {
        byKey.set(p.key, byKey.has(p.key) ? null : resolve(p.src));
    }
    const out = new Map<string, string>();
    for (const [key, src] of byKey) if (src) out.set(key, src);
    return out;
}

/** Someone's portal photo by their full name (hashed like the portal), or null. */
export function portalPhotoFor(index: PhotoIndex, name: string): string | null {
    if (index.size === 0) return null;
    const key = teamPhotoKey(name);
    return key ? (index.get(key) ?? null) : null;
}

/**
 * Where a card's build-time photo comes from: the entry's `image` in
 * team.astro (an explicit choice: it wins over the portal photo), a file
 * named after the person in src/assets/images/people/ (the portal photo
 * replaces it), or none (null).
 */
export type BuildPhotoSource = "image" | "folder" | null;

export type ShownPhoto = "image" | "portal" | "folder" | "initials";

/**
 * Which photo a person shows: the explicit `image` > the portal photo > the
 * build-time folder photo > initials.
 */
export function shownPhoto(
    build: BuildPhotoSource,
    portal: string | null,
): ShownPhoto {
    if (build === "image") return "image";
    if (portal) return "portal";
    return build === "folder" ? "folder" : "initials";
}
