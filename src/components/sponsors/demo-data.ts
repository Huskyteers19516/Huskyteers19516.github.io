/**
 * DEV-ONLY mock of the portal's /api/public/sponsors feed, so the band can be
 * designed without a running portal. Loaded through a dynamic import guarded
 * by `import.meta.env.DEV`, so it never ships in the production bundle.
 *
 * Open /sponsors?demo=1, or ?demo=few (fits without scrolling) | nologos |
 * empty | private | error | slow.
 *
 * Every company below is fictional; the logos are simple generated SVGs.
 */
import type { JsonFetcher } from "../progress/use-live-feed";

type Demo = {
    name: string;
    url: string | null;
    years: number[];
    /** Key into LOGOS, "broken" (fails to load), or null (no logo). */
    logo: string | null;
};

const svg = (w: number, h: number, body: string) =>
    `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`,
    )}`;

const FONT = `font-family="Helvetica, Arial, sans-serif"`;

const LOGOS: Record<string, string> = {
    copperline: svg(
        320,
        80,
        `<circle cx="40" cy="40" r="28" fill="#c2662d"/><path d="M26 40a14 14 0 0 1 28 0" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/><text x="82" y="52" ${FONT} font-size="34" font-weight="800" fill="#3b2a20" letter-spacing="1">COPPERLINE</text>`,
    ),
    kestrel: svg(
        300,
        90,
        `<path d="M14 62 L52 18 L64 40 L92 26 L60 72 Z" fill="#1f4e8c"/><text x="104" y="50" ${FONT} font-size="32" font-weight="700" fill="#1f4e8c">Kestrel</text><text x="106" y="74" ${FONT} font-size="15" font-weight="600" letter-spacing="5" fill="#5f7ea8">AEROSPACE</text>`,
    ),
    brightpath: svg(
        120,
        120,
        `<rect x="6" y="6" width="108" height="108" rx="26" fill="#0f766e"/><path d="M30 84 C 44 40, 70 76, 90 34" stroke="#facc15" stroke-width="10" fill="none" stroke-linecap="round"/><circle cx="90" cy="34" r="8" fill="#fff"/>`,
    ),
    redwood: svg(
        250,
        96,
        `<path d="M40 10 L68 52 H54 L74 82 H6 L26 52 H12 Z" fill="#9f1d1d"/><rect x="36" y="80" width="8" height="12" fill="#5b3a1e"/><text x="88" y="46" ${FONT} font-size="28" font-weight="800" fill="#7f1d1d">REDWOOD</text><text x="89" y="72" ${FONT} font-size="17" font-weight="500" letter-spacing="3" fill="#57534e">PRECISION</text>`,
    ),
    lumen: svg(
        260,
        80,
        `<circle cx="40" cy="40" r="16" fill="#f59e0b"/><g stroke="#f59e0b" stroke-width="5" stroke-linecap="round"><path d="M40 6v8M40 66v8M6 40h8M66 40h8M16 16l6 6M58 58l6 6M64 16l-6 6M22 58l-6 6"/></g><text x="90" y="52" ${FONT} font-size="34" font-weight="300" fill="#1e293b">lumen<tspan font-weight="800">labs</tspan></text>`,
    ),
    tidewater: svg(
        300,
        84,
        `<path d="M8 50 q16 -18 32 0 t32 0 t32 0" stroke="#0284c7" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M8 66 q16 -18 32 0 t32 0 t32 0" stroke="#38bdf8" stroke-width="7" fill="none" stroke-linecap="round"/><text x="120" y="48" ${FONT} font-size="26" font-weight="700" fill="#0c4a6e">Tidewater</text><text x="121" y="70" ${FONT} font-size="15" font-weight="500" fill="#0369a1">Fabrication Co.</text>`,
    ),
    sequoia: svg(
        280,
        80,
        `<path d="M36 70 C 8 50, 14 18, 36 8 C 58 18, 64 50, 36 70 Z" fill="#15803d"/><path d="M36 66 V24" stroke="#dcfce7" stroke-width="4" stroke-linecap="round"/><text x="78" y="40" ${FONT} font-size="24" font-weight="700" fill="#14532d">Sequoia</text><text x="79" y="64" ${FONT} font-size="17" font-weight="400" fill="#166534">Family Dental</text>`,
    ),
    orbitline: svg(
        280,
        80,
        `<circle cx="40" cy="40" r="14" fill="#6d28d9"/><ellipse cx="40" cy="40" rx="32" ry="12" stroke="#a78bfa" stroke-width="4" fill="none" transform="rotate(-24 40 40)"/><text x="84" y="40" ${FONT} font-size="26" font-weight="800" fill="#4c1d95">ORBITLINE</text><text x="85" y="62" ${FONT} font-size="14" font-weight="600" letter-spacing="3" fill="#7c3aed">CREDIT UNION</text>`,
    ),
};

const SPONSORS: Demo[] = [
    {
        name: "Copperline Supply",
        url: "https://example.com/copperline",
        years: [2023, 2024, 2025, 2026],
        logo: "copperline",
    },
    {
        name: "Kestrel Aerospace",
        url: "https://example.com/kestrel",
        years: [2026],
        logo: "kestrel",
    },
    {
        name: "Brightpath Engineering",
        url: "https://example.com/brightpath",
        years: [2025, 2026],
        logo: "brightpath",
    },
    {
        name: "Redwood Precision",
        url: "https://example.com/redwood",
        years: [2021, 2022, 2023, 2025, 2026],
        logo: "redwood",
    },
    {
        name: "Lumen Labs",
        url: "https://example.com/lumen",
        years: [2026],
        logo: "lumen",
    },
    {
        name: "Northwind Robotics Supply",
        url: "https://example.com/northwind",
        years: [2026],
        logo: null,
    },
    {
        name: "Sequoia Family Dental",
        url: null,
        years: [2025, 2026],
        logo: "sequoia",
    },
    {
        name: "Maple & Main Bakery",
        url: null,
        years: [2024, 2025, 2026],
        logo: null,
    },
    {
        name: "Tidewater Fabrication",
        url: "https://example.com/tidewater",
        years: [2024, 2025],
        logo: "tidewater",
    },
    {
        name: "Harbor Ridge Rotary Club",
        url: "https://example.com/rotary",
        years: [2025],
        logo: "broken",
    },
    {
        name: "Orbitline Credit Union",
        url: "https://example.com/orbitline",
        years: [2022, 2023],
        logo: "orbitline",
    },
];

const LOGO_PATH = "/api/public/sponsors/logos/";

function payload(list: Demo[], withLogos: boolean) {
    return {
        enabled: true,
        updatedAt: new Date().toISOString(),
        sponsors: list.map((s) => ({
            name: s.name,
            url: s.url,
            years: s.years,
            logo: withLogos && s.logo ? `${LOGO_PATH}demo-${s.logo}` : null,
        })),
    };
}

const sleep = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, ms);
        signal.addEventListener("abort", () => {
            clearTimeout(t);
            reject(new DOMException("Aborted", "AbortError"));
        });
    });

export function createDemoSponsorsSource(mode: string): {
    fetcher: JsonFetcher;
    logoSrc: (url: string) => string;
} {
    const fetcher: JsonFetcher = async (signal) => {
        await sleep(mode === "slow" ? 3000 : 250 + Math.random() * 250, signal);
        if (mode === "error") throw new Error("Demo: portal unreachable");
        if (mode === "private") return { enabled: false };
        if (mode === "empty") return payload([], true);
        if (mode === "few") return payload(SPONSORS.slice(0, 3), true);
        return payload(SPONSORS, mode !== "nologos");
    };
    // The parser turns logo paths into portal URLs; map them to the
    // generated SVGs instead ("broken" stays unloadable on purpose).
    const logoSrc = (url: string) => {
        const id = url.slice(url.lastIndexOf("/") + 1).replace(/^demo-/, "");
        return LOGOS[id] ?? "data:image/png;base64,broken";
    };
    return { fetcher, logoSrc };
}
