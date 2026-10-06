/**
 * DEV-ONLY mock of the portal's GET /api/public/team-photos for the Our Team
 * page and /progress (?demo=1), built from the names the page shows. Loaded
 * through a dynamic import guarded by `import.meta.env.DEV`, so it never
 * ships in the production bundle. The "photos" are simple generated
 * drawings, nobody's real picture.
 *
 * Every 4th name has no portal photo (their card keeps the build-time photo
 * or initials), and one photo fails to load (its card falls back the same
 * way). Modes on top of the page's own: ?demo=nophotos (the owner turned
 * members' photos off), ?demo=photoerror (the list fails: retried, cards
 * unchanged), ?demo=slow (the list takes 3 s: the photos fade in late,
 * without moving anything).
 */
import { PortalHttpError } from "../../lib/portal-json.ts";
import type { JsonFetcher } from "../progress/use-live-feed";
import { teamPhotoKey } from "./name-key.ts";
import { TEAM_PHOTO_PREFIX } from "./portal-photos.ts";

const BROKEN = "broken";

const BACKGROUNDS = [
    ["#0f766e", "#5eead4"],
    ["#1d4ed8", "#93c5fd"],
    ["#7c3aed", "#c4b5fd"],
    ["#b45309", "#fcd34d"],
    ["#be123c", "#fda4af"],
    ["#15803d", "#86efac"],
    ["#334155", "#cbd5e1"],
];
const SKIN = ["#f1c7a5", "#d9a47c", "#b67a52", "#8d5a3b", "#f5d6bd", "#c98e63"];
const HAIR = ["#1f1a17", "#3b2618", "#5b3a1e", "#0f0f10", "#7a4a26", "#2b2b2b"];
const SHIRT = ["#f8fafc", "#0f172a", "#14532d", "#1e3a8a", "#7f1d1d", "#a16207"];

/** A small generated head-and-shoulders drawing (an SVG data URL). */
export function demoPortrait(i: number): string {
    const [a, b] = BACKGROUNDS[i % BACKGROUNDS.length];
    const skin = SKIN[(i * 5 + 1) % SKIN.length];
    const hair = HAIR[(i * 7 + 2) % HAIR.length];
    const shirt = SHIRT[(i * 3 + 4) % SHIRT.length];
    const long = i % 3 === 0;
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="512" height="512">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
        `<rect width="160" height="160" fill="url(#g)"/>` +
        (long
            ? `<path d="M44 70 q-2 -46 36 -46 q38 0 36 46 l4 44 h-80 z" fill="${hair}"/>`
            : "") +
        `<path d="M24 164 q2 -52 56 -52 q54 0 56 52 z" fill="${shirt}"/>` +
        `<rect x="70" y="92" width="20" height="24" rx="8" fill="${skin}"/>` +
        `<ellipse cx="80" cy="70" rx="27" ry="31" fill="${skin}"/>` +
        `<path d="M52 66 q0 -36 28 -36 q30 0 28 36 q-6 -18 -26 -20 q-18 2 -30 20 z" fill="${hair}"/>` +
        `</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const sleep = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, ms);
        signal.addEventListener("abort", () => {
            clearTimeout(t);
            reject(new DOMException("Aborted", "AbortError"));
        });
    });

/** The mock payload: like the portal's (name keys, relative photo addresses). */
export function demoPhotosPayload(names: readonly string[]) {
    return {
        enabled: true,
        updatedAt: new Date().toISOString(),
        photos: names.flatMap((name, i) => {
            const key = teamPhotoKey(name);
            return i % 4 === 1 || !key
                ? []
                : [
                      {
                          key,
                          photo: `${TEAM_PHOTO_PREFIX}demo-${i === 2 ? BROKEN : i}`,
                      },
                  ];
        }),
    };
}

export function createDemoPhotos(
    mode: string,
    names: readonly string[],
): { fetcher: JsonFetcher; photoSrc: (url: string) => string } {
    const fetcher: JsonFetcher = async (signal) => {
        await sleep(mode === "slow" ? 3000 : 300 + Math.random() * 300, signal);
        if (mode === "photoerror") throw new PortalHttpError(503);
        if (mode === "nophotos") return { enabled: false };
        return demoPhotosPayload(names);
    };
    // The parser turns the addresses into portal URLs; point them at the
    // generated drawings instead ("broken" stays unloadable on purpose).
    const photoSrc = (url: string) => {
        const id = url.slice(url.lastIndexOf("/") + 1).replace(/^demo-/, "");
        const i = Number(id);
        return id !== BROKEN && Number.isInteger(i)
            ? demoPortrait(i)
            : "data:image/png;base64,broken";
    };
    return { fetcher, photoSrc };
}
