/**
 * DEV-ONLY mock of the portal's /api/public/progress feed, so the page can be
 * designed without a running portal. Loaded through a dynamic import guarded
 * by `import.meta.env.DEV`, so it never ships in the production bundle.
 *
 * Open /progress?demo=1 (live-updating), or ?demo=private | error | flaky |
 * hidden (names + titles hidden) | notitles (titles hidden) | empty, or
 * nophotos | photoerror for the people's portal photos
 * (src/components/team/demo-photos.ts).
 *
 * All names below are fictional.
 */
import type { ProgressFetcher } from "./use-progress-feed";

type Key = "BUILD" | "SOFTWARE" | "BUSINESS";

interface DemoPerson {
    id: string;
    name: string;
    subteam: Key | null;
    role: string;
    itemsDone: number;
    itemsOpen: number;
    itemsSubmitted: number;
    doneLast7Days: number;
    lastDoneAt: string | null;
}

const SUBTEAMS: { key: Key; name: string; tasksActive: number }[] = [
    { key: "BUILD", name: "Build", tasksActive: 7 },
    { key: "SOFTWARE", name: "Software", tasksActive: 5 },
    { key: "BUSINESS", name: "Business", tasksActive: 4 },
];

const ROSTER: [string, Key | null, string][] = [
    ["Avery Lin", null, "Captain"],
    ["Marcus Johnson", "BUILD", "Build Lead"],
    ["Priya Raman", "BUILD", "Build Lead"],
    ["Ethan Chen", "BUILD", "Build Team"],
    ["Diego Alvarez", "BUILD", "Build Team"],
    ["Hana Sato", "BUILD", "Build Team"],
    ["Liam O'Connor", "BUILD", "Build Team"],
    ["Noah Kim", "BUILD", "Build Team"],
    ["Sofia Rossi", "BUILD", "Build Team"],
    ["Jonah Park", "SOFTWARE", "Software Lead"],
    ["Maya Patel", "SOFTWARE", "Software Team"],
    ["Owen Brooks", "SOFTWARE", "Software Team"],
    ["Zoe Nguyen", "SOFTWARE", "Software Team"],
    ["Caleb Wright", "SOFTWARE", "Software Team"],
    ["Isabella Moreno", "SOFTWARE", "Software Team"],
    ["Grace Liu", "BUSINESS", "Business Lead"],
    ["Aaron Feld", "BUSINESS", "Business Team"],
    ["Chloe Tanaka", "BUSINESS", "Business Team"],
    ["Ruby Singh", "BUSINESS", "Business Team"],
    ["Theo Martin", "BUSINESS", "Business Team"],
];

/** The mock people's names (the dev photo demo lists them). */
export const DEMO_NAMES: readonly string[] = ROSTER.map(([name]) => name);

const TITLES: Record<Key, string[]> = {
    BUILD: [
        "Machine intake side plates",
        "Assemble linear slide v3",
        "CAD outtake servo mount",
        "Re-tension drivetrain belts",
        "Wire the control hub",
        "Print replacement bumper clips",
    ],
    SOFTWARE: [
        "Tune drivetrain heading PID",
        "Autonomous path: left start",
        "Calibrate odometry pods",
        "Vision pipeline for samples",
        "Refactor TeleOp controls",
    ],
    BUSINESS: [
        "Draft sponsor outreach email",
        "Update engineering portfolio",
        "Film robot reveal teaser",
        "Plan outreach day at library",
        "Design team T-shirts",
    ],
};

/** Deterministic PRNG so screenshots are stable between runs. */
function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const pct = (done: number, open: number) =>
    done + open === 0 ? 0 : Math.round((done / (done + open)) * 100);

/** Monday of the week containing `day` (YYYY-MM-DD), as YYYY-MM-DD. */
function mondayOf(day: string): string {
    const [y, m, d] = day.split("-").map(Number);
    const t = Date.UTC(y, m - 1, d);
    const dow = new Date(t).getUTCDay(); // 0 Sun .. 6 Sat
    const back = (dow + 6) % 7;
    return new Date(t - back * 86_400_000).toISOString().slice(0, 10);
}

function addDays(day: string, n: number): string {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000)
        .toISOString()
        .slice(0, 10);
}

function teamDay(now: number): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(now));
}

function createWorld(now: number) {
    const rand = mulberry32(19516);
    const people: DemoPerson[] = ROSTER.map(([name, subteam, role], i) => {
        const lead = /Lead|Captain/.test(role);
        const done = Math.round(4 + rand() * (lead ? 26 : 18));
        const open = Math.round(rand() * (lead ? 7 : 6));
        const submitted = Math.min(open, Math.round(rand() * 2));
        const week = Math.min(done, Math.round(rand() * 6));
        const ageMin = Math.round(8 + rand() * 60 * 50);
        return {
            id: `p_${(0x9e3779b1 * (i + 7)).toString(36).slice(-10)}`,
            name,
            subteam,
            role,
            itemsDone: done,
            itemsOpen: open,
            itemsSubmitted: submitted,
            doneLast7Days: week,
            lastDoneAt:
                i === 13 ? null : new Date(now - ageMin * 60_000).toISOString(),
        };
    });
    // One brand-new member with nothing assigned yet.
    people[13].itemsDone = 0;
    people[13].itemsOpen = 0;
    people[13].itemsSubmitted = 0;
    people[13].doneLast7Days = 0;

    const recent: {
        title: string;
        subteam: Key | null;
        who: string;
        at: string;
    }[] = [];
    let t = now - 4 * 60_000;
    for (let i = 0; i < 15; i++) {
        const p = people[Math.floor(rand() * people.length)];
        if (p.itemsDone === 0) continue;
        const key = p.subteam ?? SUBTEAMS[Math.floor(rand() * 3)].key;
        const titles = TITLES[key];
        recent.push({
            title: titles[Math.floor(rand() * titles.length)],
            subteam: key,
            who: p.name,
            at: new Date(t).toISOString(),
        });
        t -= Math.round((15 + rand() * 240) * 60_000);
    }

    const thisMonday = mondayOf(teamDay(now));
    const weekly = Array.from({ length: 8 }, (_, i) => ({
        weekStart: addDays(thisMonday, (i - 7) * 7),
        itemsDone: [9, 14, 12, 21, 18, 27, 31, 0][i] ?? 0,
    }));
    weekly[7].itemsDone = people.reduce(
        (s, p) => s + Math.min(p.doneLast7Days, 2),
        0,
    );

    // Hidden-from-public members (two in Build, so they're counted in the
    // totals): done, open, waiting for review.
    const hidden = {
        BUILD: [6, 1, 1],
        SOFTWARE: [0, 0, 0],
        BUSINESS: [0, 0, 0],
    } as Record<Key, [number, number, number]>;
    return { people, recent, weekly, hidden, tasksFinished: 38 };
}

type World = ReturnType<typeof createWorld>;

/** Simulate a few completions since the last poll. */
function tick(world: World, now: number, rand: () => number) {
    const n = rand() < 0.35 ? 0 : 1 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
        const candidates = world.people.filter((p) => p.itemsOpen > 0);
        if (candidates.length === 0) break;
        const p = candidates[Math.floor(rand() * candidates.length)];
        p.itemsOpen -= 1;
        p.itemsSubmitted = Math.min(p.itemsSubmitted, p.itemsOpen);
        p.itemsDone += 1;
        p.doneLast7Days += 1;
        p.lastDoneAt = new Date(now).toISOString();
        const key = p.subteam ?? "BUILD";
        const titles = TITLES[key];
        world.recent.unshift({
            title: titles[Math.floor(rand() * titles.length)],
            subteam: key,
            who: p.name,
            at: new Date(now - i * 1000).toISOString(),
        });
        world.weekly[world.weekly.length - 1].itemsDone += 1;
    }
    world.recent = world.recent.slice(0, 15);
    // Occasionally a leader assigns new work.
    if (rand() < 0.25) {
        const p = world.people[Math.floor(rand() * world.people.length)];
        p.itemsOpen += 1 + Math.floor(rand() * 2);
    }
}

function nameFor(name: string, style: "full" | "hidden"): string | null {
    return style === "hidden" ? null : name;
}

function snapshot(
    world: World,
    now: number,
    opts: { hideNames: boolean; hideTitles: boolean; empty: boolean },
) {
    const people = opts.empty
        ? world.people.map((p) => ({
              ...p,
              itemsDone: 0,
              itemsOpen: 0,
              itemsSubmitted: 0,
              doneLast7Days: 0,
              lastDoneAt: null,
          }))
        : world.people;

    const subteams = SUBTEAMS.map((s) => {
        const members = people.filter((p) => p.subteam === s.key);
        const [hd, ho, hs] = opts.empty ? [0, 0, 0] : world.hidden[s.key];
        const done = members.reduce((a, p) => a + p.itemsDone, 0) + hd;
        const open = members.reduce((a, p) => a + p.itemsOpen, 0) + ho;
        const submitted =
            members.reduce((a, p) => a + p.itemsSubmitted, 0) + hs;
        return {
            key: s.key,
            name: s.name,
            itemsDone: done,
            itemsOpen: open,
            itemsSubmitted: submitted,
            completion: pct(done, open),
            doneLast7Days: members.reduce((a, p) => a + p.doneLast7Days, 0),
            tasksActive: opts.empty ? 0 : s.tasksActive,
            people: members.length + (s.key === "BUILD" ? 2 : 0),
        };
    });
    const captain = people.filter((p) => p.subteam === null);
    const done =
        subteams.reduce((a, s) => a + s.itemsDone, 0) +
        captain.reduce((a, p) => a + p.itemsDone, 0);
    const open =
        subteams.reduce((a, s) => a + s.itemsOpen, 0) +
        captain.reduce((a, p) => a + p.itemsOpen, 0);
    const submitted =
        subteams.reduce((a, s) => a + s.itemsSubmitted, 0) +
        captain.reduce((a, p) => a + p.itemsSubmitted, 0);
    const style = opts.hideNames ? "hidden" : "full";

    return {
        enabled: true,
        team: { name: "The Huskyteers", number: 19516 },
        since: "2026-08-31",
        updatedAt: new Date(now).toISOString(),
        totals: {
            itemsDone: done,
            itemsOpen: open,
            itemsSubmitted: submitted,
            completion: pct(done, open),
            doneLast7Days:
                subteams.reduce((a, s) => a + s.doneLast7Days, 0) +
                captain.reduce((a, p) => a + p.doneLast7Days, 0),
            tasksFinished: opts.empty ? 0 : world.tasksFinished,
            tasksActive: subteams.reduce((a, s) => a + s.tasksActive, 0),
            people: people.length + 2,
        },
        subteams,
        people: opts.hideNames
            ? []
            : people.map((p) => ({
                  id: p.id,
                  name: p.name,
                  subteam: p.subteam,
                  role: p.role,
                  itemsDone: p.itemsDone,
                  itemsOpen: p.itemsOpen,
                  itemsSubmitted: p.itemsSubmitted,
                  completion: pct(p.itemsDone, p.itemsOpen),
                  doneLast7Days: p.doneLast7Days,
                  lastDoneAt: p.lastDoneAt,
              })),
        recent: opts.empty
            ? []
            : world.recent.map((r) => ({
                  title: opts.hideTitles ? null : r.title,
                  subteam: r.subteam,
                  who: nameFor(r.who, style),
                  at: r.at,
              })),
        weekly: world.weekly.map((w) => ({
            weekStart: w.weekStart,
            itemsDone: opts.empty ? 0 : w.itemsDone,
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

export function createDemoFetcher(mode: string): ProgressFetcher {
    const world = createWorld(Date.now());
    const rand = mulberry32(42);
    let calls = 0;
    return async (signal) => {
        calls += 1;
        await sleep(250 + Math.random() * 250, signal);
        if (mode === "error") throw new Error("Demo: portal unreachable");
        if (mode === "flaky" && calls % 3 === 0)
            throw new Error("Demo: flaky network");
        if (mode === "private") return { enabled: false };
        const now = Date.now();
        if (calls > 1) tick(world, now, rand);
        return snapshot(world, now, {
            hideNames: mode === "hidden",
            hideTitles: mode === "hidden" || mode === "notitles",
            empty: mode === "empty",
        });
    };
}
