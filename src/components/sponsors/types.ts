/**
 * Shape of GET {PUBLIC_PORTAL_URL}/api/public/sponsors, the sponsors the
 * Teammate Portal's Business team marked "Thank them on the team website"
 * (accepted or finished sponsorships only; never amounts or contacts).
 *
 * `parseSponsors` validates and normalises the payload, dropping anything
 * malformed instead of crashing the island.
 */
import {
    httpUrl,
    isObj,
    isoDate,
    list,
    PORTAL_ID_RE,
    text,
} from "../../lib/portal-json.ts";

export interface PublicSponsor {
    /** Stable React key (the normalised name). */
    key: string;
    name: string;
    /** Their website's homepage (http/https, no path or query), or null. */
    url: string | null;
    /** Years they donated in, ascending, no duplicates. */
    years: number[];
    /** Absolute URL of the brand logo on the portal, or null. */
    logo: string | null;
}

export interface SponsorsEnabled {
    enabled: true;
    updatedAt: string;
    sponsors: PublicSponsor[];
}

export type SponsorsPayload = SponsorsEnabled | { enabled: false };

/** Most sponsors kept from one payload. */
export const MAX_SPONSORS = 200;
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

const LOGO_PREFIX = "/api/public/sponsors/logos/";

/**
 * A logo reference from the payload as an absolute URL on the portal. Only
 * the portal's own logo route with a plain id is accepted (relative, or
 * absolute on the portal's origin) — never another host or path.
 */
export function logoUrl(v: unknown, portalUrl: string): string | null {
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
    if (!u.pathname.startsWith(LOGO_PREFIX)) return null;
    const id = u.pathname.slice(LOGO_PREFIX.length);
    if (!PORTAL_ID_RE.test(id)) return null;
    return `${base.origin}${LOGO_PREFIX}${id}`;
}

/**
 * A sponsor's link: only the homepage of an http(s) website
 * ("https://rev.example.com/"). The portal already sends nothing more; this
 * makes sure a path, query or #fragment (an application page's ids or
 * tokens) never becomes a public link here either.
 */
export function sponsorHomeUrl(v: unknown): string | null {
    const href = httpUrl(v);
    if (!href) return null;
    try {
        const { origin } = new URL(href);
        return origin && origin !== "null" ? `${origin}/` : null;
    } catch {
        return null;
    }
}

/** Name key for merging: case- and space-insensitive (like the portal). */
export const nameKey = (name: string) =>
    name.toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();

function years(v: unknown): number[] {
    const out = new Set<number>();
    for (const y of list(v).slice(0, 100)) {
        if (
            typeof y === "number" &&
            Number.isInteger(y) &&
            y >= MIN_YEAR &&
            y <= MAX_YEAR
        )
            out.add(y);
    }
    return [...out].sort((a, b) => a - b);
}

const latest = (s: PublicSponsor) => s.years.at(-1) ?? 0;

/** Latest year first, then by name (the portal's order, enforced). */
export function compareSponsors(a: PublicSponsor, b: PublicSponsor): number {
    return (
        latest(b) - latest(a) ||
        a.name.localeCompare(b.name, "en", { sensitivity: "base" })
    );
}

/**
 * Validates an unknown JSON value against the public sponsors contract.
 * Returns null when the payload is unusable (wrong shape entirely).
 */
export function parseSponsors(
    raw: unknown,
    portalUrl: string,
): SponsorsPayload | null {
    if (!isObj(raw)) return null;
    if (raw.enabled === false) return { enabled: false };
    if (raw.enabled !== true || !Array.isArray(raw.sponsors)) return null;

    const byKey = new Map<string, PublicSponsor>();
    for (const s of raw.sponsors.slice(0, MAX_SPONSORS * 2)) {
        if (!isObj(s)) continue;
        const name = text(s.name, 80);
        if (!name) continue;
        const key = nameKey(name);
        const sponsor: PublicSponsor = {
            key,
            name,
            url: sponsorHomeUrl(s.url),
            years: years(s.years),
            logo: logoUrl(s.logo, portalUrl),
        };
        const prev = byKey.get(key);
        if (prev) {
            // The portal already merges by name; be safe if it ever doesn't.
            prev.years = [...new Set([...prev.years, ...sponsor.years])].sort(
                (a, b) => a - b,
            );
            prev.url ??= sponsor.url;
            prev.logo ??= sponsor.logo;
            continue;
        }
        if (byKey.size >= MAX_SPONSORS) continue;
        byKey.set(key, sponsor);
    }

    return {
        enabled: true,
        updatedAt: isoDate(raw.updatedAt) ?? new Date().toISOString(),
        sponsors: [...byKey.values()].sort(compareSponsors),
    };
}

/**
 * "2025 · 2026"; runs of three or more years collapse to a range:
 * [2021, 2022, 2023, 2026] -> "2021–2023 · 2026".
 */
export function formatYears(years: readonly number[]): string {
    const parts: string[] = [];
    let i = 0;
    while (i < years.length) {
        let j = i;
        while (j + 1 < years.length && years[j + 1] === years[j] + 1) j++;
        if (j - i >= 2) {
            parts.push(`${years[i]}–${years[j]}`);
        } else {
            for (let k = i; k <= j; k++) parts.push(String(years[k]));
        }
        i = j + 1;
    }
    return parts.join(" · ");
}

/** Screen-reader version of formatYears: "2021 to 2023 and 2026". */
export function spokenYears(years: readonly number[]): string {
    const parts = formatYears(years)
        .split(" · ")
        .map((p) => p.replace("–", " to "));
    if (parts.length <= 1) return parts[0] ?? "";
    return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/** One or two letters for a sponsor without a logo. */
export function monogram(name: string): string {
    const words = name
        .replace(/[^\p{L}\p{N}\s&-]/gu, "")
        .split(/[\s-]+/)
        .filter((w) => w && !/^(the|of|and|&|inc|llc|co|corp|ltd)$/i.test(w));
    if (words.length === 0) return name.slice(0, 1).toUpperCase() || "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}
