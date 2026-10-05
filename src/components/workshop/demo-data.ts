/**
 * DEV-ONLY mock of the portal's /api/public/workshop feed, so the page can be
 * designed without a running portal. Loaded through a dynamic import guarded
 * by `import.meta.env.DEV`, so it never ships in the production bundle.
 *
 * Open /workshop?demo=1 (or a bare ?demo), or ?demo=empty | error | flaky
 * (first load fails, Retry works) | slow (long loading state).
 *
 * Photos are generated SVG "blueprint renders" (data: URIs) and downloads are
 * tiny data: text files, so nothing here touches the network. All names below
 * are fictional.
 */
import type {
    PublicWorkshop,
    PublicWorkshopDownload,
    PublicWorkshopPhoto,
    PublicWorkshopProject,
} from "./types";
import type { WorkshopFetcher } from "./use-workshop";

/* ---------- Blueprint SVG renders ---------- */

type Shape =
    | "servo"
    | "hub"
    | "chain"
    | "camera"
    | "odometry"
    | "cart"
    | "sheet"
    | "dashboard"
    | "portal";

interface Render {
    title: string;
    label?: string;
    shape: Shape;
    /** Shape-specific variant (version number). */
    v?: number;
    w: number;
    h: number;
    dwg: string;
}

const LINE = "#6ee7a8";
const DIM = "#9fbcb0";
const RED = "#ff7a7a";
const AMBER = "#ffc857";
const FONT = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const t = (
    x: number,
    y: number,
    s: string,
    size = 11,
    fill = DIM,
    anchor = "start",
    weight = 400,
) =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}" font-family="${FONT}" letter-spacing="0.06em">${esc(s)}</text>`;

/** Horizontal dimension line with end ticks and a centred value. */
const dimH = (x1: number, x2: number, y: number, value: string) =>
    `<g stroke="${DIM}" stroke-width="1"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><line x1="${x1}" y1="${y - 7}" x2="${x1}" y2="${y + 7}"/><line x1="${x2}" y1="${y - 7}" x2="${x2}" y2="${y + 7}"/></g>${t((x1 + x2) / 2, y - 6, value, 11, DIM, "middle")}`;

function callout(x: number, y: number, r: number, label: string, color: string) {
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="5 4"/><line x1="${x + r * 0.7}" y1="${y - r * 0.7}" x2="${x + r + 26}" y2="${y - r - 22}" stroke="${color}" stroke-width="1.5"/>${t(x + r + 30, y - r - 26, label, 12, color, "start", 700)}`;
}

function shapeSvg(shape: Shape, v: number): string {
    const stroke = `stroke="${LINE}" stroke-width="2.5" fill="rgba(110,231,168,0.07)"`;
    switch (shape) {
        case "servo": {
            const rx = v >= 3 ? 22 : v === 2 ? 4 : 0;
            const holes = [
                [-128, -62],
                [128, -62],
                [-128, 62],
                [128, 62],
            ]
                .map(
                    ([x, y]) =>
                        `<circle cx="${x}" cy="${y}" r="9" stroke="${LINE}" stroke-width="2" fill="none"/><circle cx="${x}" cy="${y}" r="15" stroke="${LINE}" stroke-width="1" stroke-dasharray="3 3" fill="none"/>`,
                )
                .join("");
            let extra = "";
            if (v >= 2) {
                extra += `<rect x="-158" y="-78" width="316" height="156" rx="${Math.max(0, rx - 10)}" fill="none" stroke="${LINE}" stroke-width="1" stroke-dasharray="6 5" opacity="0.6"/>`;
            }
            if (v === 1) {
                extra +=
                    `<polyline points="-128,-71 -136,-79 -133,-85 -144,-90" fill="none" stroke="${RED}" stroke-width="2.5"/>` +
                    callout(-136, -80, 22, "CRACKED — PLA", RED);
            }
            if (v === 2) {
                extra += callout(78, 0, 20, "HORN RUBS WALL", AMBER);
            }
            if (v >= 3) {
                extra +=
                    `<path d="M -170 -68 Q -170 -90 -148 -90" fill="none" stroke="${AMBER}" stroke-width="2.5"/>` +
                    t(-150, -100, "R2 FILLETS ×8", 12, AMBER, "start", 700) +
                    t(96, 30, "+1.5 MM", 11, AMBER, "start", 700);
            }
            const pocketRx = v >= 3 ? 10 : 0;
            const hornR = v >= 3 ? 40 : 34;
            return (
                `<rect x="-170" y="-90" width="340" height="180" rx="${rx}" ${stroke}/>` +
                `<rect x="-86" y="-50" width="172" height="100" rx="${pocketRx}" stroke="${LINE}" stroke-width="2" fill="rgba(0,0,0,0.25)"/>` +
                `<circle cx="44" cy="0" r="${hornR}" fill="none" stroke="${LINE}" stroke-width="1.5" stroke-dasharray="8 5"/>` +
                `<circle cx="44" cy="0" r="6" fill="${LINE}"/>` +
                holes +
                extra +
                dimH(-170, 170, 122, "84.0 MM")
            );
        }
        case "hub": {
            let inner = "";
            if (v === 1) {
                inner = `<circle r="92" fill="rgba(110,231,168,0.22)" stroke="${LINE}" stroke-width="1.5"/>${t(0, 66, "100% INFILL", 11, RED, "middle", 700)}`;
            } else {
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2;
                    const x1 = Math.cos(a) * 28;
                    const y1 = Math.sin(a) * 28;
                    const x2 = Math.cos(a + 0.7) * 92;
                    const y2 = Math.sin(a + 0.7) * 92;
                    const cx = Math.cos(a + 0.15) * 70;
                    const cy = Math.sin(a + 0.15) * 70;
                    inner += `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${LINE}" stroke-width="5" stroke-linecap="round"/>`;
                }
                inner += callout(58, -58, 18, "FLEX SPOKES", AMBER);
            }
            const hex = Array.from({ length: 6 }, (_, i) => {
                const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
                return `${(Math.cos(a) * 22).toFixed(1)},${(Math.sin(a) * 22).toFixed(1)}`;
            }).join(" ");
            return (
                `<circle r="118" ${stroke}/><circle r="92" fill="none" stroke="${LINE}" stroke-width="1.5"/>` +
                inner +
                `<circle r="30" fill="rgba(0,0,0,0.35)" stroke="${LINE}" stroke-width="2"/><polygon points="${hex}" fill="none" stroke="${LINE}" stroke-width="2"/>` +
                dimH(-118, 118, 140, "Ø 72.0 MM")
            );
        }
        case "chain": {
            const links = [-150, -55, 40]
                .map(
                    (x) =>
                        `<rect x="${x}" y="-38" width="112" height="76" rx="36" ${stroke}/><circle cx="${x + 34}" cy="0" r="9" fill="none" stroke="${LINE}" stroke-width="2"/><circle cx="${x + 78}" cy="0" r="9" fill="none" stroke="${LINE}" stroke-width="2"/>`,
                )
                .join("");
            return (
                links +
                `<path d="M -150 -60 C -60 -110 60 -110 152 -60" fill="none" stroke="${LINE}" stroke-width="1" stroke-dasharray="6 5"/>` +
                t(0, -96, "WIRE PATH", 11, DIM, "middle") +
                dimH(-116, -21, 70, "18.0 PITCH")
            );
        }
        case "camera": {
            const tilt = v >= 2 ? -25 : -10;
            return (
                `<rect x="-160" y="60" width="320" height="22" ${stroke}/>` +
                `<path d="M -40 60 L -40 -20 L 40 -20 L 40 60" ${stroke}/>` +
                `<g transform="translate(0,-34) rotate(${tilt})"><rect x="-74" y="-36" width="148" height="72" rx="10" ${stroke}/><circle cx="30" cy="0" r="22" fill="rgba(0,0,0,0.35)" stroke="${LINE}" stroke-width="2"/><circle cx="30" cy="0" r="9" fill="${LINE}" opacity="0.6"/></g>` +
                `<path d="M 110 -34 A 110 110 0 0 0 ${(Math.cos((tilt * Math.PI) / 180) * 110).toFixed(1)} ${(-34 + Math.sin((tilt * Math.PI) / 180) * 110).toFixed(1)}" fill="none" stroke="${AMBER}" stroke-width="1.5"/>` +
                t(124, -46, `${Math.abs(tilt)}°`, 14, AMBER, "start", 700) +
                (v >= 2
                    ? `<path d="M -40 30 L -70 60 M 40 30 L 70 60" stroke="${LINE}" stroke-width="2.5"/>` +
                      t(-150, 112, "GUSSETS ADDED", 11, AMBER, "start", 700)
                    : "") +
                dimH(-160, 160, 132, "64.0 MM")
            );
        }
        case "odometry": {
            const rollers = Array.from({ length: 10 }, (_, i) => {
                const a = (i / 10) * Math.PI * 2;
                return `<ellipse cx="${(110 + Math.cos(a) * 50).toFixed(1)}" cy="${(Math.sin(a) * 50).toFixed(1)}" rx="9" ry="5" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(0)} ${(110 + Math.cos(a) * 50).toFixed(1)} ${(Math.sin(a) * 50).toFixed(1)})" fill="none" stroke="${LINE}" stroke-width="1.5"/>`;
            }).join("");
            return (
                `<rect x="-170" y="-24" width="270" height="48" rx="24" ${stroke}/>` +
                `<circle cx="-140" cy="0" r="12" fill="none" stroke="${LINE}" stroke-width="2"/>` +
                `<circle cx="110" cy="0" r="56" ${stroke}/><circle cx="110" cy="0" r="16" fill="none" stroke="${LINE}" stroke-width="2"/>` +
                rollers +
                `<polyline points="-100,-24 -90,-70 -76,-50 -62,-90 -48,-70 -34,-110" fill="none" stroke="${AMBER}" stroke-width="2"/>` +
                t(-30, -112, "SPRING PRELOAD", 11, AMBER, "start", 700) +
                dimH(-170, 166, 96, "112.0 MM")
            );
        }
        case "cart": {
            const wheels = [-140, 140]
                .map(
                    (x) =>
                        `<circle cx="${x}" cy="110" r="18" ${stroke}/><circle cx="${x}" cy="110" r="5" fill="${LINE}"/>`,
                )
                .join("");
            return (
                `<rect x="-170" y="-60" width="340" height="16" ${stroke}/>` +
                `<rect x="-170" y="10" width="340" height="16" ${stroke}/>` +
                `<rect x="-170" y="72" width="340" height="16" ${stroke}/>` +
                `<path d="M -160 -60 L -160 88 M 160 -60 L 160 88" stroke="${LINE}" stroke-width="5"/>` +
                `<path d="M 160 -60 L 160 -120 L 196 -120" fill="none" stroke="${LINE}" stroke-width="5" stroke-linecap="round"/>` +
                `<rect x="-120" y="-108" width="200" height="48" rx="6" fill="none" stroke="${LINE}" stroke-width="1.5" stroke-dasharray="6 5"/>` +
                t(-20, -78, "ROBOT", 12, DIM, "middle", 700) +
                [-120, -70, -20]
                    .map(
                        (x) =>
                            `<rect x="${x}" y="40" width="36" height="32" rx="3" fill="none" stroke="${AMBER}" stroke-width="1.5"/>`,
                    )
                    .join("") +
                t(30, 62, "CHARGING", 11, AMBER, "start", 700) +
                wheels
            );
        }
        case "sheet": {
            let cells = "";
            for (let r = 0; r < 9; r++) {
                const y = -82 + r * 22;
                cells += `<line x1="-186" y1="${y}" x2="186" y2="${y}" stroke="${DIM}" stroke-width="1" opacity="0.5"/>`;
                if (r > 0 && r < 9) {
                    cells += `<rect x="-178" y="${y + 7}" width="${60 + ((r * 37) % 70)}" height="8" rx="2" fill="${DIM}" opacity="0.45"/>`;
                    cells += `<rect x="-40" y="${y + 7}" width="${24 + ((r * 13) % 30)}" height="8" rx="2" fill="${DIM}" opacity="0.35"/>`;
                    cells += `<rect x="60" y="${y + 7}" width="${40 + ((r * 29) % 60)}" height="8" rx="2" fill="${DIM}" opacity="0.35"/>`;
                }
            }
            [-50, 50].forEach((x) => {
                cells += `<line x1="${x}" y1="-82" x2="${x}" y2="112" stroke="${DIM}" stroke-width="1" opacity="0.5"/>`;
            });
            return (
                `<rect x="-190" y="-126" width="380" height="252" rx="8" fill="#0f1c18" stroke="${DIM}" stroke-width="1.5"/>` +
                `<rect x="-190" y="-126" width="380" height="24" rx="8" fill="#16302a"/>` +
                `<rect x="-186" y="-82" width="372" height="22" fill="rgba(110,231,168,0.18)"/>` +
                t(-178, -66, "PART", 10, LINE, "start", 700) +
                t(-40, -66, "QTY", 10, LINE, "start", 700) +
                t(60, -66, "BIN", 10, LINE, "start", 700) +
                cells +
                t(-176, -110, "inventory.xlsx", 10, DIM)
            );
        }
        case "dashboard":
        case "portal": {
            const portal = shape === "portal";
            let body = "";
            // Stat cards
            [0, 1, 2].forEach((i) => {
                const x = -100 + i * 96;
                body += `<rect x="${x}" y="-92" width="86" height="46" rx="6" fill="rgba(110,231,168,0.08)" stroke="${DIM}" stroke-width="1"/><rect x="${x + 10}" y="-82" width="34" height="6" rx="2" fill="${DIM}" opacity="0.6"/><rect x="${x + 10}" y="-68" width="${portal ? 46 : 30}" height="12" rx="2" fill="${LINE}"/>`;
            });
            // Rows
            for (let r = 0; r < 5; r++) {
                const y = -30 + r * 26;
                body += `<rect x="-100" y="${y}" width="${portal ? 150 : 280}" height="20" rx="4" fill="rgba(255,255,255,0.03)" stroke="${DIM}" stroke-width="0.75" opacity="0.8"/>`;
                body += portal
                    ? `<rect x="-94" y="${y + 5}" width="10" height="10" rx="2" fill="${r < 3 ? LINE : "none"}" stroke="${LINE}" stroke-width="1.2"/><rect x="-76" y="${y + 7}" width="${50 + ((r * 31) % 60)}" height="6" rx="2" fill="${DIM}" opacity="0.6"/>`
                    : `<rect x="-92" y="${y + 7}" width="${70 + ((r * 41) % 80)}" height="6" rx="2" fill="${DIM}" opacity="0.6"/><rect x="${120 + ((r * 7) % 20)}" y="${y + 5}" width="40" height="10" rx="5" fill="${r === 1 ? AMBER : LINE}" opacity="0.8"/>`;
            }
            if (portal) {
                // Progress ring
                const c = 2 * Math.PI * 34;
                body += `<circle cx="132" cy="22" r="34" fill="none" stroke="${DIM}" stroke-width="7" opacity="0.3"/><circle cx="132" cy="22" r="34" fill="none" stroke="${LINE}" stroke-width="7" stroke-dasharray="${(c * 0.68).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 132 22)" stroke-linecap="round"/>${t(132, 27, "68%", 14, LINE, "middle", 700)}`;
            }
            return (
                `<rect x="-190" y="-126" width="380" height="252" rx="8" fill="#0f1c18" stroke="${DIM}" stroke-width="1.5"/>` +
                `<rect x="-190" y="-126" width="380" height="24" rx="8" fill="#16302a"/>` +
                [0, 1, 2]
                    .map(
                        (i) =>
                            `<circle cx="${-174 + i * 13}" cy="-114" r="4" fill="${[RED, AMBER, LINE][i]}" opacity="0.8"/>`,
                    )
                    .join("") +
                `<rect x="-190" y="-102" width="76" height="228" fill="rgba(110,231,168,0.06)"/>` +
                [0, 1, 2, 3, 4]
                    .map(
                        (i) =>
                            `<rect x="-180" y="${-88 + i * 22}" width="${i === 0 ? 56 : 44}" height="8" rx="3" fill="${i === 0 ? LINE : DIM}" opacity="${i === 0 ? 0.9 : 0.5}"/>`,
                    )
                    .join("") +
                body
            );
        }
    }
}

function render({ title, label, shape, v = 1, w, h, dwg }: Render): string {
    const screen = shape === "sheet" || shape === "dashboard" || shape === "portal";
    const s = screen
        ? Math.min((w * 0.84) / 400, (h * 0.78) / 270)
        : Math.min((w * 0.7) / 420, (h * 0.68) / 300);
    const cx = screen ? w / 2 : w * 0.46;
    const cy = screen ? h * 0.47 : h * 0.44;
    const tbW = Math.round(Math.min(w * 0.34, 420));
    const tbH = Math.round(tbW * 0.3);
    const tbX = w - tbW - Math.round(w * 0.03);
    const tbY = h - tbH - Math.round(h * 0.04);
    const fs = Math.max(11, Math.round(tbW / 26));

    const titleBlock = `<g transform="translate(${tbX},${tbY})"><rect width="${tbW}" height="${tbH}" fill="rgba(8,20,16,0.85)" stroke="${DIM}" stroke-width="1.5"/><line x1="0" y1="${tbH * 0.5}" x2="${tbW}" y2="${tbH * 0.5}" stroke="${DIM}" stroke-width="1"/><line x1="${tbW * 0.62}" y1="${tbH * 0.5}" x2="${tbW * 0.62}" y2="${tbH}" stroke="${DIM}" stroke-width="1"/>${t(fs * 0.9, tbH * 0.33, title.toUpperCase(), fs * 1.15, "#e8fff3", "start", 700)}${t(fs * 0.9, tbH * 0.8, label ? label.toUpperCase() : "FTC 19516", fs * 0.9, LINE, "start", 700)}${t(tbW * 0.62 + fs * 0.8, tbH * 0.8, dwg, fs * 0.8, DIM)}</g>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0c1d18"/><stop offset="1" stop-color="#0a1512"/></linearGradient><pattern id="g" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#6ee7a8" stroke-opacity="0.07" stroke-width="1"/></pattern><pattern id="G" width="120" height="120" patternUnits="userSpaceOnUse"><path d="M 120 0 L 0 0 0 120" fill="none" stroke="#6ee7a8" stroke-opacity="0.16" stroke-width="1"/></pattern><radialGradient id="glow" cx="0.45" cy="0.42" r="0.6"><stop offset="0" stop-color="#2bd17e" stop-opacity="0.16"/><stop offset="1" stop-color="#2bd17e" stop-opacity="0"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#bg)"/><rect width="${w}" height="${h}" fill="url(#g)"/><rect width="${w}" height="${h}" fill="url(#G)"/><rect width="${w}" height="${h}" fill="url(#glow)"/><g transform="translate(${cx.toFixed(1)},${cy.toFixed(1)}) scale(${s.toFixed(3)})">${shapeSvg(shape, v)}</g>${t(Math.round(w * 0.03), Math.round(h * 0.06), "DEMO RENDER · NOT A PHOTO", fs * 0.85, DIM)}${screen ? "" : titleBlock}</svg>`;
}

const svgUri = (svg: string) =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/* ---------- Projects ---------- */

let photoSeq = 0;
function photo(
    r: Omit<Render, "dwg"> & { note?: string },
    dwg: string,
): PublicWorkshopPhoto {
    photoSeq += 1;
    return {
        id: `demo-photo-${photoSeq}`,
        path: svgUri(render({ ...r, dwg })),
        width: r.w,
        height: r.h,
        label: r.label ?? "",
        note: r.note ?? "",
    };
}

function file(
    id: string,
    filename: string,
    format: string,
    size: number,
    label = "",
): PublicWorkshopDownload {
    const body = `The Huskyteers — Workshop demo file\n\nThis stands in for "${filename}" (${format}).\nReal design files are downloaded from the team portal.\n`;
    return {
        id,
        path: `data:text/plain;charset=utf-8,${encodeURIComponent(body)}`,
        filename,
        format,
        size,
        label,
    };
}

const daysAgo = (n: number) =>
    new Date(Date.now() - n * 86_400_000).toISOString();

function buildProjects(): PublicWorkshopProject[] {
    photoSeq = 0;

    const servo = [
        photo(
            {
                title: "Outtake servo mount",
                label: "Version 1",
                shape: "servo",
                v: 1,
                w: 1200,
                h: 900,
                note: "Printed in PLA with sharp inside corners. After two practice matches of hard wrist flips it cracked right through the screw bosses.",
            },
            "DWG 19516-OSM-01",
        ),
        photo(
            {
                title: "Outtake servo mount",
                label: "Version 2",
                shape: "servo",
                v: 2,
                w: 1200,
                h: 900,
                note: "Reprinted in PETG with thicker walls. No more cracks, but the servo horn rubbed the side wall and stalled the wrist at full rotation.",
            },
            "DWG 19516-OSM-02",
        ),
        photo(
            {
                title: "Outtake servo mount",
                label: "Version 3",
                shape: "servo",
                v: 3,
                w: 1200,
                h: 900,
                note: "Added 2 mm fillets to every inside corner, moved the horn clearance out 1.5 mm and printed at 40% gyroid infill. Zero failures in 30+ matches.",
            },
            "DWG 19516-OSM-03",
        ),
    ];

    const hub = [
        photo(
            {
                title: "Intake roller hub",
                label: "Version 1",
                shape: "hub",
                v: 1,
                w: 1080,
                h: 1080,
                note: "Printed solid. Way too stiff — when a game piece jammed, the hub couldn't give and the intake motor stalled.",
            },
            "DWG 19516-IRH-01",
        ),
        photo(
            {
                title: "Intake roller hub",
                label: "Version 2",
                shape: "hub",
                v: 2,
                w: 1080,
                h: 1080,
                note: "Curved TPU spokes that flex under load, so a jammed piece squeezes through instead of stopping the roller.",
            },
            "DWG 19516-IRH-02",
        ),
    ];

    const chain = [
        photo(
            {
                title: "Cable chain link",
                shape: "chain",
                w: 1200,
                h: 900,
            },
            "DWG 19516-CCL-01",
        ),
    ];

    const camera = [
        photo(
            { title: "Webcam mount", shape: "camera", v: 1, w: 1200, h: 900 },
            "DWG 19516-WCM-01",
        ),
        photo(
            { title: "Webcam mount", shape: "camera", v: 2, w: 1200, h: 900 },
            "DWG 19516-WCM-02",
        ),
    ];

    const odometry = [
        photo(
            {
                title: "Odometry pod arm",
                shape: "odometry",
                w: 1400,
                h: 900,
            },
            "DWG 19516-ODO-04",
        ),
    ];

    const inventory = [
        photo(
            {
                title: "Inventory program",
                label: "First version",
                shape: "sheet",
                w: 1600,
                h: 1000,
                note: "Started as a shared spreadsheet. Two people editing at once kept overwriting each other's counts.",
            },
            "SCREEN 01",
        ),
        photo(
            {
                title: "Inventory program",
                label: "Today",
                shape: "dashboard",
                w: 1600,
                h: 1000,
                note: "Rewritten as a small app with a real database, check-in/check-out and low-stock warnings before competitions.",
            },
            "SCREEN 02",
        ),
    ];

    const portal = [
        photo(
            {
                title: "Teammate Portal",
                shape: "portal",
                w: 1600,
                h: 1000,
            },
            "SCREEN 01",
        ),
    ];

    const cart = [
        photo(
            { title: "Pit cart", shape: "cart", w: 1200, h: 900 },
            "DWG 19516-PIT-01",
        ),
    ];

    return [
        {
            id: "demo-outtake-servo-mount",
            kind: "PART",
            title: "Outtake servo mount",
            summary:
                "Holds the outtake claw's wrist servo square to the arm, so the claw lines up with the basket on every cycle.",
            material: "PETG",
            season: "2025–26",
            designers: ["Priya Raman", "Diego Alvarez"],
            featured: true,
            link: "https://example.com/demo/onshape/outtake-servo-mount",
            codeLink: null,
            cover: servo[2],
            photos: servo,
            downloads: [
                file("demo-f1", "outtake-servo-mount-v3.stl", "STL", 412_337, "Print-ready STL"),
                file("demo-f2", "outtake-servo-mount-v3.step", "STEP", 1_864_200, "Editable CAD (STEP)"),
            ],
            publishedAt: daysAgo(12),
            updatedAt: daysAgo(3),
        },
        {
            id: "demo-intake-roller-hub",
            kind: "PART",
            title: "Intake roller hub",
            summary:
                "Grips the intake's compliant wheels to the hex shaft, and flexes just enough that a jammed game piece slips through instead of stalling the motor.",
            material: "TPU 95A",
            season: "2025–26",
            designers: ["Hana Sato"],
            featured: false,
            link: null,
            codeLink: null,
            cover: hub[1],
            photos: hub,
            downloads: [
                file("demo-f3", "intake-roller-hub-v2.3mf", "3MF", 268_900, "Print project (3MF)"),
            ],
            publishedAt: daysAgo(20),
            updatedAt: daysAgo(20),
        },
        {
            id: "demo-cable-chain-link",
            kind: "PART",
            title: "Cable chain link",
            summary:
                "Snap-together links that guide the linear slide's wires, so nothing snags or unplugs at full extension.",
            material: "PLA+",
            season: "2025–26",
            designers: ["Noah Kim", "Sofia Rossi", "Marcus Johnson"],
            featured: false,
            link: null,
            codeLink: null,
            cover: chain[0],
            photos: chain,
            downloads: [file("demo-f4", "cable-chain-link.stl", "STL", 96_412)],
            publishedAt: daysAgo(31),
            updatedAt: daysAgo(31),
        },
        {
            id: "demo-webcam-mount",
            kind: "PART",
            title: "Webcam mount",
            summary:
                "Locks the webcam at a fixed 25° tilt, so the vision pipeline's calibration still holds after a hard hit.",
            material: "PETG-CF",
            season: "2025–26",
            designers: ["Caleb Wright"],
            featured: false,
            link: "https://example.com/demo/printables/webcam-mount",
            codeLink: null,
            cover: camera[1],
            photos: camera,
            downloads: [],
            publishedAt: daysAgo(44),
            updatedAt: daysAgo(40),
        },
        {
            id: "demo-odometry-pod-arm",
            kind: "PART",
            title: "Odometry pod arm",
            summary:
                "Spring-loaded arm that keeps the dead-wheel pressed flat on the field tiles for accurate position tracking in autonomous.",
            material: "Nylon (PA12)",
            season: "2024–25",
            designers: [],
            featured: false,
            link: null,
            codeLink: null,
            cover: odometry[0],
            photos: odometry,
            downloads: [],
            publishedAt: daysAgo(300),
            updatedAt: daysAgo(300),
        },
        {
            id: "demo-inventory-program",
            kind: "SOFTWARE",
            title: "Inventory program",
            summary:
                "Tracks every motor, servo, bolt and spool of filament in the shop, so we know what we have before we order more — and who borrowed the hex keys.",
            material: "Python, SQLite",
            season: "2025–26",
            designers: ["Owen Brooks", "Maya Patel"],
            featured: true,
            link: "https://example.com/demo/inventory",
            codeLink: "https://example.com/demo/inventory-source",
            cover: inventory[1],
            photos: inventory,
            downloads: [
                file("demo-f5", "huskyteers-inventory-windows.zip", "ZIP", 3_567_001, "Windows build"),
            ],
            publishedAt: daysAgo(9),
            updatedAt: daysAgo(2),
        },
        {
            id: "demo-teammate-portal",
            kind: "SOFTWARE",
            title: "Teammate Portal",
            summary:
                "Our own team web app: leaders assign tasks, members check them off, and leader review makes it official. It also powers the live Progress page on this site.",
            material: "Next.js, PostgreSQL",
            season: "2025–26",
            designers: ["Jonah Park"],
            featured: false,
            link: "https://example.com/demo/portal",
            codeLink: null,
            cover: portal[0],
            photos: portal,
            downloads: [],
            publishedAt: daysAgo(15),
            updatedAt: daysAgo(15),
        },
        {
            id: "demo-pit-cart",
            kind: "OTHER",
            title: "Pit cart",
            summary:
                "Rolling pit cart that carries the robot, batteries and tools to competitions, with a charging shelf built in.",
            material: "Plywood, 2020 aluminum extrusion",
            season: "2025–26",
            designers: ["Grace Liu", "Theo Martin"],
            featured: false,
            link: null,
            codeLink: null,
            cover: cart[0],
            photos: cart,
            downloads: [
                file("demo-f6", "pit-cart-plans.pdf", "PDF", 1_003_520, "Cut list & plans"),
            ],
            publishedAt: daysAgo(60),
            updatedAt: daysAgo(60),
        },
    ];
}

const sleep = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        });
    });

export function createDemoFetcher(mode: string): WorkshopFetcher {
    let calls = 0;
    return async (signal) => {
        calls += 1;
        await sleep(mode === "slow" ? 4_000 : 500 + Math.random() * 300, signal);
        if (mode === "error") throw new Error("Demo: portal unreachable");
        if (mode === "flaky" && calls === 1)
            throw new Error("Demo: portal asleep");
        const payload: PublicWorkshop = {
            updatedAt: new Date().toISOString(),
            projects: mode === "empty" ? [] : buildProjects(),
        };
        return payload;
    };
}
