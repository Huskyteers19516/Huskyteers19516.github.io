/**
 * DEV-ONLY mock of the portal's /api/public/events feed, so the page can be
 * designed without a running portal. Loaded through a dynamic import guarded
 * by `import.meta.env.DEV`, so it never ships in the production bundle.
 *
 * Open /events?demo=1, or ?demo=live (an outreach event is on right now) |
 * past (nothing upcoming) | empty | private | error | flaky.
 *
 * Dates are relative to the next Saturday (meets and scrimmages fall on
 * weekends, like the real season); all venues and names are fictional.
 */
import type { JsonFetcher } from "../progress/use-live-feed";
import { addDays, todayIn } from "./time";

const TZ = "America/Los_Angeles";

type Row = {
    title: string;
    kind: "MEET" | "ILT" | "SCRIMMAGE" | "COMPETITION" | "OUTREACH";
    /** Days from the next Saturday. */
    in: number;
    /** Extra days (multi-day events). */
    span?: number;
    start?: string;
    end?: string;
    location?: string;
    link?: string;
};

const LABELS = {
    MEET: "League meet",
    ILT: "League tournament (ILT)",
    SCRIMMAGE: "League scrimmage",
    COMPETITION: "Competition",
    OUTREACH: "Outreach",
} as const;

const ROWS: Row[] = [
    {
        title: "Season kickoff scrimmage",
        kind: "SCRIMMAGE",
        in: -28,
        start: "09:00",
        end: "15:00",
        location: "Harbor Ridge High School, Anaheim, CA",
    },
    {
        title: "Robot demo at Canyon Vista Library",
        kind: "OUTREACH",
        in: -21,
        start: "10:30",
        end: "12:30",
        location: "Canyon Vista Library",
    },
    {
        title: "League Meet 1",
        kind: "MEET",
        in: -14,
        start: "08:00",
        end: "16:00",
        location: "Mesa Verde Convention Hall",
        link: "https://example.org/events/meet-1",
    },
    {
        title: "STEM night at Sunnyslope Elementary",
        kind: "OUTREACH",
        in: -10,
        start: "17:30",
        end: "19:30",
        location: "Sunnyslope Elementary",
    },
    {
        title: "League Meet 2",
        kind: "MEET",
        in: 0,
        start: "08:30",
        end: "16:30",
        location: "Mesa Verde Convention Hall, 400 Mesa Verde Dr",
        link: "https://example.org/events/meet-2",
    },
    {
        title: "Mentor a rookie team: build day",
        kind: "OUTREACH",
        in: 4,
        start: "13:00",
        location: "Lakeside Community Center",
    },
    {
        title: "Inter-league scrimmage",
        kind: "SCRIMMAGE",
        in: 7,
        start: "09:00",
        end: "14:00",
        location: "Harbor Ridge High School, Anaheim, CA",
        link: "https://example.org/events/scrimmage",
    },
    {
        title: "League Meet 3",
        kind: "MEET",
        in: 21,
        start: "08:30",
        end: "16:30",
        location: "Mesa Verde Convention Hall",
    },
    {
        title: "Community holiday parade booth",
        kind: "OUTREACH",
        in: 36,
        location: "Downtown Main Street",
    },
    {
        title: "Orange Coast League Tournament",
        kind: "ILT",
        in: 70,
        span: 1,
        start: "08:00",
        end: "17:00",
        location: "Pacific Crest University Arena",
        link: "https://example.org/events/ilt",
    },
    {
        title: "SoCal Regional Championship",
        kind: "COMPETITION",
        in: 104,
        span: 2,
        location: "Coastline Expo Center, Long Beach, CA",
        link: "https://example.org/events/regional",
    },
];

/** An outreach event that's on right now (for ?demo=live). */
const LIVE: Row = {
    title: "Robotics open house",
    kind: "OUTREACH",
    in: 0,
    start: "00:00",
    end: "23:59",
    location: "Lakeside Community Center",
};

function payload(rows: Row[], now: number, live?: Row) {
    const today = todayIn(now, TZ);
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
    const saturday = addDays(today, 6 - dow || 7);
    const all = live ? [...rows, live] : rows;
    return {
        enabled: true,
        updatedAt: new Date(now).toISOString(),
        timezone: TZ,
        events: all.map((r, i) => ({
            id: `cdemo${String(i).padStart(4, "0")}${r.kind.toLowerCase()}`,
            title: r.title,
            kind: r.kind,
            kindLabel: LABELS[r.kind],
            startsOn: addDays(r === live ? today : saturday, r.in),
            endsOn: r.span ? addDays(saturday, r.in + r.span) : null,
            startTime: r.start ?? null,
            endTime: r.end ?? null,
            location: r.location ?? "",
            link: r.link ?? null,
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

export function createDemoEventsFetcher(mode: string): JsonFetcher {
    let calls = 0;
    return async (signal) => {
        calls += 1;
        await sleep(250 + Math.random() * 250, signal);
        if (mode === "error") throw new Error("Demo: portal unreachable");
        if (mode === "flaky" && calls % 3 === 0)
            throw new Error("Demo: flaky network");
        if (mode === "private") return { enabled: false };
        const now = Date.now();
        if (mode === "empty") return payload([], now);
        if (mode === "past") return payload(ROWS.filter((r) => r.in < 0), now);
        if (mode === "live") return payload(ROWS, now, LIVE);
        return payload(ROWS, now);
    };
}
