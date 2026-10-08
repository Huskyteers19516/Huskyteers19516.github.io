/**
 * The Our Team page's roster logic (src/pages/about/team.astro): slugs for
 * deep links and photo files, matching people with the Teammate Portal's
 * public progress, and picking each person's photo.
 *
 * Pure module (type-only imports), so tests/team.test.mjs can load it with
 * Node's type stripping. The Astro side that actually loads and resizes the
 * photos is ./photos.ts.
 */
import type { ProgressPerson } from "../progress/types";
import {
    personTone,
    shownBadges,
    type Badge,
    type BadgeTone,
    type ShownBadge,
} from "./badges.ts";

/** One hand-edited entry of `sections` in team.astro. */
export interface TeamMember<Image = unknown> {
    name: string;
    roles: string[];
    image?: Image;
    /** Titles under their position (see ./badges.ts). */
    badges?: Badge[];
}

export interface TeamSection<M extends TeamMember = TeamMember> {
    title: string;
    people: M[];
}

/** Portal subteam keys (the public progress JSON's `subteam`). */
export const SUBTEAM_KEYS = ["BUILD", "SOFTWARE", "BUSINESS"] as const;

/* ------------------------------------------------------------------ */
/* Names and slugs                                                     */
/* ------------------------------------------------------------------ */

const APOSTROPHES = /[‘’ʼ`´]/g;

/**
 * A name for comparing: lowercase, accents removed, curly apostrophes
 * straightened, runs of spaces collapsed. "José  O’Neil" -> "jose o'neil".
 */
export function normalizeName(name: string): string {
    return name
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .replace(APOSTROPHES, "'")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * The URL / file-name form of a name: normalized, apostrophes dropped, every
 * other run of non-letters/digits turned into one hyphen.
 * "Tommy Ho" -> "tommy-ho", "José O'Neil-Smith" -> "jose-oneil-smith".
 * Letters of other scripts stay ("张伟" -> "张伟").
 */
export function slugify(name: string): string {
    return normalizeName(name)
        .replace(/'/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

/**
 * How a teammate's name is shown on the site: first name(s) plus last
 * initial ("Tommy Ho" -> "Tommy H."), so full last names aren't published.
 * One-word names stay as they are.
 */
export function shortName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return parts[0] ?? "";
    const last = parts[parts.length - 1];
    const initial = Array.from(last)[0]?.toLocaleUpperCase("en-US") ?? "";
    return `${parts.slice(0, -1).join(" ")} ${initial}.`;
}

/**
 * A person's public id: the slug of their short name ("Tommy Ho" ->
 * "tommy-h"). Used in ?person= links, on the cards, and as the name of their
 * photo file (src/assets/images/people/tommy-h.png), so no full last name
 * ends up in a URL or a file name on the site.
 */
export function personSlug(name: string): string {
    return slugify(shortName(name));
}

/** The first word of a name ("Tommy" for "Tommy Ho"), for short copy. */
export function firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
}

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

/** Photo types picked up from src/assets/images/people/ (any letter case). */
export const PHOTO_EXTENSIONS = ["webp", "jpg", "jpeg", "png"] as const;

/** "…/people/Tommy H.JPG" -> { file: "Tommy H.JPG", slug: "tommy-h" }, null for other types. */
export function photoFileInfo(
    path: string,
): { file: string; slug: string; ext: string } | null {
    const file = path.split(/[\\/]/).pop() ?? "";
    const m = /^(.+)\.([A-Za-z0-9]+)$/.exec(file);
    if (!m) return null;
    const ext = m[2].toLowerCase();
    if (!(PHOTO_EXTENSIONS as readonly string[]).includes(ext)) return null;
    const slug = slugify(m[1]);
    return slug ? { file, slug, ext } : null;
}

export type PhotoChoice =
    /** One of `files` (resized at build time). */
    | { kind: "file"; path: string }
    /** A link used as is: a /public path or an http(s) URL. */
    | { kind: "url"; url: string }
    | null;

const byExtension = (a: string, b: string) => {
    const rank = (p: string) =>
        PHOTO_EXTENSIONS.indexOf(
            (photoFileInfo(p)?.ext ?? "png") as (typeof PHOTO_EXTENSIONS)[number],
        );
    return rank(a) - rank(b) || a.localeCompare(b);
};

/**
 * Which photo a person gets. `files` are the paths of the photos in
 * src/assets/images/people/.
 *
 * 1. `image` names a file in that folder ("ethan.png", "people/ethan.png",
 *    or just "ethan") -> that file.
 * 2. `image` is a link ("/images/x.jpg" in public/, "https://…") -> as is.
 * 3. Otherwise (or when step 1 finds nothing): a file named after the person's
 *    short name (`personSlug`), e.g. "tommy-h.jpg" for Tommy Ho. The file's
 *    name goes through the same slug rules, so "Tommy H.jpg" or "tommy_h.PNG"
 *    work too. A file with the full name ("tommy-ho.jpg") matches nobody.
 * 4. Nothing: the card shows the person's initials.
 *
 * Only exact name matches count: "ethan.png" is nobody's automatic photo
 * (there's no one called just "Ethan"); point an entry at it with `image`.
 */
export function choosePhoto(
    name: string,
    image: string | null | undefined,
    files: readonly string[],
): PhotoChoice {
    return photoFromImage(image, files) ?? photoForName(name, files);
}

/** Steps 1-2 of `choosePhoto`: what an entry's `image` points at, or null. */
export function photoFromImage(
    image: string | null | undefined,
    files: readonly string[],
): PhotoChoice {
    const raw = image?.trim();
    if (!raw) return null;
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("/")) {
        return { kind: "url", url: raw };
    }
    const photos = files.filter((f) => photoFileInfo(f) !== null);
    const wanted = raw.split(/[\\/]/).pop()!.toLowerCase();
    const exact = photos.find(
        (f) => photoFileInfo(f)!.file.toLowerCase() === wanted,
    );
    if (exact) return { kind: "file", path: exact };
    const wantedSlug = slugify(wanted.replace(/\.[a-z0-9]+$/i, ""));
    const loose = photos
        .filter((f) => photoFileInfo(f)!.slug === wantedSlug)
        .sort(byExtension)[0];
    return loose ? { kind: "file", path: loose } : null;
}

/**
 * Photo files in the folder that no one on the page uses (neither by name
 * nor through `image`). They aren't shown anywhere: the build warns about
 * them and leaves them out of the site (they're still in the public repo).
 * `people` are the page's entries; an `image` that isn't a string (an
 * imported image) counts through `usedPaths`.
 */
export function unusedPhotoFiles(
    people: readonly { name: string; image?: unknown }[],
    files: readonly string[],
    usedPaths: readonly string[] = [],
): string[] {
    const used = new Set(usedPaths);
    for (const p of people) {
        // An imported image is that entry's photo (counted in `usedPaths`).
        if (typeof p.image === "object" && p.image !== null) continue;
        const image = typeof p.image === "string" ? p.image : undefined;
        const choice = choosePhoto(p.name, image, files);
        if (choice?.kind === "file") used.add(choice.path);
    }
    return files.filter((f) => photoFileInfo(f) !== null && !used.has(f));
}

/** Step 3 of `choosePhoto`: the file named after the person, or null. */
export function photoForName(
    name: string,
    files: readonly string[],
): PhotoChoice {
    const slug = personSlug(name);
    if (!slug) return null;
    const own = files
        .filter((f) => photoFileInfo(f)?.slug === slug)
        .sort(byExtension)[0];
    return own ? { kind: "file", path: own } : null;
}

/* ------------------------------------------------------------------ */
/* Roster                                                              */
/* ------------------------------------------------------------------ */

export interface RosterPerson<M extends TeamMember = TeamMember> {
    slug: string;
    /** As first written in team.astro. */
    name: string;
    /** Every position, from every entry with this name, in order, no repeats. */
    roles: string[];
    /** Section titles the person is listed under. */
    sections: string[];
    /** Captain / any Lead, or listed under Leadership. */
    lead: boolean;
    /** Their color: gold for leads, else their subteam's (`personTone`). */
    tone: BadgeTone;
    /** Every entry's badges, each title once, ready to draw. */
    badges: ShownBadge[];
    /** The entries this person came from (a name can be listed twice). */
    entries: M[];
}

export const isLeadRole = (roles: readonly string[], section = "") =>
    roles.some((r) => /\b(lead|leader|captain)\b/i.test(r)) ||
    /leader/i.test(section);

/**
 * Everyone on the page, once each, in page order. Entries with the same name
 * are merged: "Tim Jung" listed under Build Team and Software Team is one
 * person with both positions (and both entries' badges). Two different names
 * with the same short name ("Jack Luo" and "Jack Lee" are both "Jack L.")
 * would share a link and a photo, so that stops the build with a message.
 */
export function buildRoster<M extends TeamMember>(
    sections: readonly TeamSection<M>[],
): RosterPerson<M>[] {
    const bySlug = new Map<string, RosterPerson<M>>();
    for (const section of sections) {
        for (const member of section.people) {
            const slug = personSlug(member.name);
            if (!slug) continue;
            let person = bySlug.get(slug);
            if (person && normalizeName(person.name) !== normalizeName(member.name)) {
                throw new Error(
                    `Our Team: "${person.name}" and "${member.name}" are both shown as ` +
                        `"${shortName(member.name)}". Write one of them differently in ` +
                        `src/pages/about/team.astro (e.g. add a middle initial).`,
                );
            }
            if (!person) {
                person = {
                    slug,
                    name: member.name.trim().replace(/\s+/g, " "),
                    roles: [],
                    sections: [],
                    lead: false,
                    tone: "green",
                    badges: [],
                    entries: [],
                };
                bySlug.set(slug, person);
            }
            person.entries.push(member);
            for (const role of member.roles) {
                const r = role.trim();
                if (r && !person.roles.includes(r)) person.roles.push(r);
            }
            if (section.title && !person.sections.includes(section.title)) {
                person.sections.push(section.title);
            }
            person.lead ||= isLeadRole(member.roles, section.title);
        }
    }
    for (const person of bySlug.values()) {
        person.tone = personTone(person.roles, person.lead);
        person.badges = shownBadges(
            person.entries.map((e) => e.badges),
            person.tone,
        );
    }
    return [...bySlug.values()];
}

/**
 * Portal subteams a list of positions points at ("Build Lead" -> BUILD), for
 * people without live data. "Design Team" isn't a portal subteam.
 */
export function subteamsFromRoles(roles: readonly string[]): string[] {
    const keys: string[] = [];
    for (const key of SUBTEAM_KEYS) {
        if (roles.some((r) => new RegExp(`\\b${key}\\b`, "i").test(r))) {
            keys.push(key);
        }
    }
    return keys;
}

/* ------------------------------------------------------------------ */
/* Matching with the portal's public progress                          */
/* ------------------------------------------------------------------ */

/**
 * Live progress for each roster slug. A person matches when their name
 * equals a `people[].name` of the public progress JSON, ignoring case,
 * spacing and accents. The page doesn't hand full names to the browser:
 * each roster entry carries `key`, its full name already turned into a key
 * by `keyOf` (the browser uses `teamPhotoKey`, a hash; tests can use
 * `normalizeName`), and each portal name goes through the same `keyOf`. That only works while the portal writes full names
 * (Admin -> Team website -> name style "full", the default); with
 * initials or hidden names nobody matches and the cards simply show no live
 * numbers. Two portal people with the same name match nobody (never show
 * someone else's numbers).
 */
export function matchLive(
    roster: readonly { slug: string; key: string | null }[],
    people: readonly ProgressPerson[],
    keyOf: (name: string) => string | null = normalizeName,
): Map<string, ProgressPerson> {
    const byKey = new Map<string, ProgressPerson | null>();
    for (const p of people) {
        const key = keyOf(p.name);
        if (!key) continue;
        byKey.set(key, byKey.has(key) ? null : p);
    }
    const out = new Map<string, ProgressPerson>();
    for (const r of roster) {
        const p = r.key ? byKey.get(r.key) : undefined;
        if (p) out.set(r.slug, p);
    }
    return out;
}

/**
 * Whether a portal name is a shortened one (the portal's name style isn't
 * "full"): initials ("E.C.", "E.") or a first name and initial ("Ethan C.").
 * Such a name isn't a person's name on this page, so it gets no profile link
 * and no profile of its own. A one-word name ("Prince") is a whole name.
 */
export function looksAbbreviated(name: string): boolean {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    if (/^(\p{L}\.)+$/u.test(words.join(""))) return true;
    return words.length > 1 && /^\p{L}\.$/u.test(words[words.length - 1]);
}

/**
 * A portal person for a ?person= slug that isn't on the page (someone the
 * owner hasn't added to team.astro yet). Unique matches of whole names only
 * (never "T.H.": that's nobody's profile).
 */
export function liveBySlug(
    slug: string,
    people: readonly ProgressPerson[],
): ProgressPerson | null {
    const hits = people.filter((p) => personSlug(p.name) === slug);
    return hits.length === 1 && !looksAbbreviated(hits[0].name)
        ? hits[0]
        : null;
}

/**
 * Which portal people /progress links to a profile on the Our Team page:
 * id -> slug, for whole names (not shortened, see `looksAbbreviated`) whose
 * slug no one else in the list shares — exactly the ones the Our Team page
 * can open (a card with that name, or `liveBySlug`). Everyone else is plain
 * text, so a link never lands on the wrong person or on nothing.
 */
export function profileLinks(
    people: readonly { id: string; name: string }[],
): Map<string, string> {
    const count = new Map<string, number>();
    for (const p of people) {
        const slug = personSlug(p.name);
        count.set(slug, (count.get(slug) ?? 0) + 1);
    }
    const out = new Map<string, string>();
    for (const p of people) {
        const slug = personSlug(p.name);
        if (slug && count.get(slug) === 1 && !looksAbbreviated(p.name)) {
            out.set(p.id, slug);
        }
    }
    return out;
}

/* ------------------------------------------------------------------ */
/* Deep links                                                          */
/* ------------------------------------------------------------------ */

export const PERSON_PARAM = "person";

/** The slug in ?person=, cleaned up, or null. */
export function personFromSearch(search: string): string | null {
    const raw = new URLSearchParams(search).get(PERSON_PARAM);
    if (!raw) return null;
    const slug = slugify(raw);
    return slug || null;
}

/** `href` with ?person= set to `slug` (or removed for null); other params kept. */
export function withPersonParam(href: string, slug: string | null): string {
    const url = new URL(href);
    if (slug) url.searchParams.set(PERSON_PARAM, slug);
    else url.searchParams.delete(PERSON_PARAM);
    return url.pathname + url.search + url.hash;
}

/** Link to someone's profile on the Our Team page (used by /progress). */
export function teamProfileHref(name: string, extraQuery = ""): string {
    const slug = personSlug(name);
    const base = "/about/team";
    if (!slug) return base;
    return `${base}?${PERSON_PARAM}=${encodeURIComponent(slug)}${extraQuery ? `&${extraQuery}` : ""}`;
}
