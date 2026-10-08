/**
 * "Website Coding": text, links and pictures that admins change from the
 * Teammate Portal (Admin -> Website Coding), with no rebuild of the site.
 *
 * Any element can be made editable by giving it a slot key:
 *     <p data-edit-text="home.hero.tagline" data-edit-label="Home: tagline">…</p>
 *     <a data-edit-link="footer.email.link" href="mailto:…">…</a>
 *     <img data-edit-image="contact.team-photo" src="…" alt="…" />
 * What's written in the page is the default; the portal's saved values
 * (GET {PUBLIC_PORTAL_URL}/api/public/site-content) replace it in the browser
 * (src/components/site-content/SiteContent.astro).
 *
 * This file is the pure part: validating keys, the portal's payload and every
 * link and image address before it reaches the page. Never trusts the
 * payload: a malformed entry is dropped, the rest still applies.
 *
 * Pure module (no imports), so the tests in tests/ can load it with Node's
 * type stripping.
 */

export type SlotKind = "text" | "link" | "image";

/** Slot keys: lowercase words joined by "." or "-", e.g. "season.2025-2026.team-photo". */
export const SLOT_KEY_RE = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
export const MAX_KEY_LENGTH = 120;
export const MAX_TEXT_LENGTH = 5000;
export const MAX_LINK_LENGTH = 2000;
export const MAX_ALT_LENGTH = 300;
/** Upper bound on entries per kind we bother looking at (the site has a few hundred slots). */
export const MAX_ENTRIES = 2000;

/** Uploaded image ids (same rule as the portal's public ids). */
export const SITE_IMAGE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
/** The only image `src` the feed may send: a relative path on the portal. */
export const SITE_IMAGE_SRC_RE = /^\/api\/public\/site-images\/[A-Za-z0-9_-]{1,64}$/;
export const SITE_IMAGE_PATH = "/api/public/site-images/";
export const SITE_CONTENT_PATH = "/api/public/site-content";

export interface SiteImage {
    /** Absolute URL on the portal, ready for <img src>. */
    src: string;
    alt: string;
    width?: number;
    height?: number;
}

export interface SiteContent {
    texts: Record<string, string>;
    links: Record<string, string>;
    images: Record<string, SiteImage>;
}

export const emptyContent = (): SiteContent => ({
    texts: {},
    links: {},
    images: {},
});

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
    typeof v === "object" && v !== null && !Array.isArray(v);

/** True for a well-formed slot key. */
export function isSlotKey(v: unknown): v is string {
    return (
        typeof v === "string" &&
        v.length > 0 &&
        v.length <= MAX_KEY_LENGTH &&
        SLOT_KEY_RE.test(v)
    );
}

// Control characters and whitespace never belong in an href.
// eslint-disable-next-line no-control-regex
const UNSAFE_URL_CHARS = /[\s\u0000-\u001f\u007f-\u009f]/;

/**
 * A link that's safe to put in an href, else null:
 *   - https://… or http://… (no user:password@, must have a host),
 *   - mailto:…,
 *   - a path on this site starting with exactly one "/" ("/events", "/about/team#x").
 * Everything else (javascript:, data:, "//evil.example", "\\x", relative paths,
 * anything with spaces or control characters) is refused.
 */
export function safeLink(v: unknown, max = MAX_LINK_LENGTH): string | null {
    if (typeof v !== "string") return null;
    const raw = v.trim();
    if (!raw || raw.length > max || UNSAFE_URL_CHARS.test(raw)) return null;
    if (raw.startsWith("/")) {
        // "//host" and "/\host" are protocol-relative in browsers.
        if (raw[1] === "/" || raw[1] === "\\") return null;
        if (raw.includes("\\")) return null;
        return raw;
    }
    let u: URL;
    try {
        u = new URL(raw);
    } catch {
        return null;
    }
    if (u.protocol === "https:" || u.protocol === "http:") {
        if (u.username || u.password || !u.hostname) return null;
        // Only accept what was written with an explicit scheme://.
        if (!/^https?:\/\//i.test(raw)) return null;
        return u.href;
    }
    if (u.protocol === "mailto:") {
        return /^mailto:[^/]/i.test(raw) ? raw : null;
    }
    return null;
}

/** The portal's base URL without trailing slashes, or null when it's not an http(s) URL. */
export function portalBase(url: unknown): string | null {
    if (typeof url !== "string") return null;
    try {
        const u = new URL(url);
        if (u.protocol !== "https:" && u.protocol !== "http:") return null;
        return url.trim().replace(/\/+$/, "");
    } catch {
        return null;
    }
}

/** The portal's origin ("https://portal.example"), or null. */
export function portalOrigin(url: unknown): string | null {
    const base = portalBase(url);
    if (!base) return null;
    try {
        return new URL(base).origin;
    } catch {
        return null;
    }
}

/**
 * An image `src` from the portal turned into an absolute URL, else null.
 * The feed sends exactly "/api/public/site-images/<id>"; the editor's live
 * preview may also send the same path as an absolute URL on the portal
 * (`allowAbsolute`), optionally with a query string (cache busting).
 */
export function siteImageUrl(
    src: unknown,
    base: string,
    { allowAbsolute = false }: { allowAbsolute?: boolean } = {},
): string | null {
    if (typeof src !== "string" || !base) return null;
    if (SITE_IMAGE_SRC_RE.test(src)) return `${base}${src}`;
    if (!allowAbsolute) return null;
    if (src.length > MAX_LINK_LENGTH || UNSAFE_URL_CHARS.test(src)) return null;
    let u: URL;
    let b: URL;
    try {
        u = new URL(src);
        b = new URL(base);
    } catch {
        return null;
    }
    if (u.origin !== b.origin || u.username || u.password || u.hash) return null;
    if (!SITE_IMAGE_SRC_RE.test(u.pathname)) return null;
    if (u.search && !/^\?[A-Za-z0-9_=&.-]{1,200}$/.test(u.search)) return null;
    return u.href;
}

const dimension = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 20000
        ? v
        : undefined;

function entries(v: unknown): [string, unknown][] {
    if (!isObj(v)) return [];
    return Object.entries(v)
        .slice(0, MAX_ENTRIES)
        .filter(([key]) => isSlotKey(key));
}

/**
 * The feed (or an editor preview) cleaned up, or null when it's not a feed or
 * the feature is off (`enabled: false`). Invalid entries are dropped one by
 * one: a text over 5000 characters, a link that isn't safeLink(), an image
 * whose src isn't the portal's site-images path, a bad key.
 */
export function parseSiteContent(
    v: unknown,
    base: string,
    opts: { allowAbsolute?: boolean; requireEnabled?: boolean } = {},
): SiteContent | null {
    if (!isObj(v)) return null;
    const { requireEnabled = true, allowAbsolute = false } = opts;
    if (requireEnabled && v.enabled !== true) return null;
    const out = emptyContent();
    for (const [key, value] of entries(v.texts)) {
        if (typeof value === "string" && value.length <= MAX_TEXT_LENGTH) {
            out.texts[key] = value;
        }
    }
    for (const [key, value] of entries(v.links)) {
        const href = safeLink(value);
        if (href) out.links[key] = href;
    }
    for (const [key, value] of entries(v.images)) {
        if (!isObj(value)) continue;
        const src = siteImageUrl(value.src, base, { allowAbsolute });
        if (!src) continue;
        const alt = value.alt ?? "";
        if (typeof alt !== "string" || alt.length > MAX_ALT_LENGTH) continue;
        const image: SiteImage = { src, alt };
        const width = dimension(value.width);
        const height = dimension(value.height);
        if (width && height) {
            image.width = width;
            image.height = height;
        }
        out.images[key] = image;
    }
    return out;
}

/** map[key] when it's the map's own entry (never Object.prototype's "constructor" & co). */
export function own<T>(map: Record<string, T> | undefined, key: string): T | undefined {
    return map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
}

/** The feed URL with a cache bucket that changes every 60 s. */
export function siteContentUrl(base: string, now = Date.now()): string {
    return `${base}${SITE_CONTENT_PATH}?t=${Math.floor(now / 60_000)}`;
}

/** Text as the portal shows it: whitespace from the page's source formatting collapsed. */
export const normalizeText = (s: string): string => s.replace(/\s+/g, " ").trim();

/** `url` with hk-edit=1 added (keeps the editor on when following a link inside the editor). */
export function withEditParam(url: string, base: string): string | null {
    try {
        const u = new URL(url, base);
        u.searchParams.set("hk-edit", "1");
        return u.href;
    } catch {
        return null;
    }
}
