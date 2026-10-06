/**
 * Small, dependency-free validators for the Teammate Portal's public JSON
 * (GET {PUBLIC_PORTAL_URL}/api/public/...). The site never trusts a payload:
 * each page's parser uses these to keep what's well formed and drop the rest
 * instead of crashing its island.
 *
 * Pure module (no imports), so the tests in tests/ can load it with Node's
 * type stripping.
 */

export type Obj = Record<string, unknown>;

export const isObj = (v: unknown): v is Obj =>
    typeof v === "object" && v !== null && !Array.isArray(v);

export const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** A trimmed, non-empty string cut to `max` characters, else null. */
export const text = (v: unknown, max = 160): string | null => {
    if (typeof v !== "string") return null;
    const t = v.replace(/\s+/g, " ").trim();
    return t ? t.slice(0, max) : null;
};

/** An ISO timestamp the browser can parse, else null. */
export const isoDate = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    return Number.isNaN(Date.parse(v)) ? null : v;
};

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day as "YYYY-MM-DD" (no Feb 30), else null. */
export const day = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const m = DAY_RE.exec(v);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const t = new Date(Date.UTC(y, mo - 1, d));
    return t.getUTCFullYear() === y &&
        t.getUTCMonth() === mo - 1 &&
        t.getUTCDate() === d
        ? v
        : null;
};

/** "HH:MM" on a 24 h clock, else null. */
export const clock = (v: unknown): string | null =>
    typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null;

/**
 * An absolute http(s) link that's safe to put in an href, else null. Bare
 * domains ("example.com") get https://. Anything with credentials, another
 * scheme (javascript:, data:, mailto:…) or spaces is refused.
 */
export function httpUrl(v: unknown, max = 500): string | null {
    if (typeof v !== "string") return null;
    const raw = v.trim();
    if (!raw || raw.length > max || /\s/.test(raw)) return null;
    const withScheme = /^[a-z][a-z\d+.-]*:/i.test(raw)
        ? raw
        : /^[\w-]+(\.[\w-]+)+([/?#:]|$)/.test(raw)
          ? `https://${raw}`
          : null;
    if (!withScheme) return null;
    try {
        const u = new URL(withScheme);
        if (u.protocol !== "http:" && u.protocol !== "https:") return null;
        if (u.username || u.password || !u.hostname) return null;
        return u.href;
    } catch {
        return null;
    }
}

/** Portal ids in public URLs (same rule as the portal's PUBLIC_API_ID_RE). */
export const PORTAL_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * A portal answer that wasn't 2xx, with its status, so a caller can tell a
 * deliberate "not here" (the per-person endpoint's 404) from an outage.
 */
export class PortalHttpError extends Error {
    readonly status: number;
    constructor(status: number) {
        super(`HTTP ${status}`);
        this.name = "PortalHttpError";
        this.status = status;
    }
}
