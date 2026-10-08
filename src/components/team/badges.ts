/**
 * Badges on the Our Team page: the short list of titles under each
 * teammate's position ("Mission Commander — Team lead and competition
 * robot"), on their card (Person.astro) and in their profile dialog.
 *
 * They're hand-written in team.astro's `sections`, on each person's entry:
 *
 *     badges: [
 *         { icon: "crown", tone: "gold", title: "Mission Commander",
 *           description: "Team lead and competition robot" },
 *     ]
 *
 * `icon` is one of BADGE_ICONS (drawn by BadgeList.astro on the card and
 * badge-list.tsx in the dialog); `tone` is the badge's color, by default the
 * person's own (`personTone`: gold for captains and leads, else their
 * subteam's). Base them on what the person actually did or is responsible
 * for — the business team keeps them up to date.
 *
 * Pure module (tests/team.test.mjs loads it with type stripping).
 */

/** Icons a badge can use. */
export const BADGE_ICONS = [
    "crown", // leading the team
    "cpu", // technical lead / architecture
    "wrench", // building
    "cog", // drivetrain, mechanisms
    "compass", // CAD
    "package", // inventory, parts
    "code", // programming
    "bot", // autonomous
    "route", // autonomous paths
    "gamepad", // TeleOp, driving
    "globe", // website
    "notebook", // engineering portfolio
    "presentation", // judging, pitches
    "megaphone", // outreach
    "handshake", // sponsors
    "palette", // design, posters
    "camera", // photos, social media
    "trophy", // awards
    "users", // recruiting, mentoring
    "sparkles", // anything else
] as const;
export type BadgeIcon = (typeof BADGE_ICONS)[number];

/** Badge colors. */
export const BADGE_TONES = ["gold", "green", "teal", "violet"] as const;
export type BadgeTone = (typeof BADGE_TONES)[number];

export interface Badge {
    title: string;
    /** One short line: what they do or did. */
    description?: string;
    /** Default "sparkles". */
    icon?: BadgeIcon;
    /** Default: the person's tone (`personTone`). */
    tone?: BadgeTone;
}

/** A badge ready to draw: icon and tone filled in, text trimmed. */
export type ShownBadge = Required<Badge>;

/**
 * A person's color: gold for captains and leads, else their subteam's
 * (build green, software teal, business violet), green when unknown.
 */
export function personTone(roles: readonly string[], lead = false): BadgeTone {
    if (lead || roles.some((r) => /\b(lead|leader|captain)\b/i.test(r))) {
        return "gold";
    }
    const text = roles.join(" ");
    if (/\bsoftware\b/i.test(text)) return "teal";
    if (/\b(business|outreach|marketing)\b/i.test(text)) return "violet";
    return "green";
}

const isIcon = (v: unknown): v is BadgeIcon =>
    (BADGE_ICONS as readonly unknown[]).includes(v);
const isTone = (v: unknown): v is BadgeTone =>
    (BADGE_TONES as readonly unknown[]).includes(v);

/**
 * The badges to draw, from every entry of one person (a name listed twice
 * brings both lists): blank titles dropped, the same title only once (the
 * first one wins), unknown icons -> "sparkles", no tone -> `fallbackTone`.
 */
export function shownBadges(
    lists: readonly (readonly Badge[] | undefined)[],
    fallbackTone: BadgeTone,
): ShownBadge[] {
    const out: ShownBadge[] = [];
    const seen = new Set<string>();
    for (const list of lists) {
        for (const b of list ?? []) {
            const title = b?.title?.trim();
            if (!title) continue;
            const key = title.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
                title,
                description: b.description?.trim() ?? "",
                icon: isIcon(b.icon) ? b.icon : "sparkles",
                tone: isTone(b.tone) ? b.tone : fallbackTone,
            });
        }
    }
    return out;
}
