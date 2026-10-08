/**
 * DEV-ONLY mock of the portal's public progress for the Our Team page:
 * GET /api/public/progress (the team feed) and
 * GET /api/public/progress/people/{id} (one person), built from the names on
 * the page so the cards match. Loaded through a dynamic import guarded by
 * `import.meta.env.DEV`, so it never ships in the production bundle. The
 * numbers and task titles are made up.
 *
 * Open /about/team?demo=1, or ?demo=notitles (titles hidden) | hidden (names
 * hidden: no matches, every person 404s) | private | error | empty (nothing
 * done yet) | nodetail (profiles off: the per-person endpoint 404s for
 * everyone) | detailerror (it fails with a 503) | slow (it's slow) | leave
 * (the first person hides themselves after ~20 s: gone from the feed, their
 * profile 404s — an open profile must drop their numbers and list).
 * A few people on the page aren't in the mock portal (no live numbers), and
 * one portal person isn't on the page: /about/team?person=avery-l&demo=1.
 *
 * Like the portal, every number comes from the same list of finished items:
 * `doneLast7Days`, `lastDoneAt`, `weekly` and `done` agree, and the weeks
 * start at the week `since` falls in (at most 8).
 */
import { PortalHttpError } from "../../lib/portal-json.ts";
import type { JsonFetcher } from "../progress/use-live-feed";
import { subteamsFromRoles } from "./roster.ts";

type Key = "BUILD" | "SOFTWARE" | "BUSINESS";

const SUBTEAMS: { key: Key; name: string; tasksActive: number }[] = [
    { key: "SOFTWARE", name: "Software", tasksActive: 5 },
    { key: "BUILD", name: "Build", tasksActive: 7 },
    { key: "BUSINESS", name: "Business", tasksActive: 4 },
];

const TITLES: Record<Key, string[]> = {
    BUILD: [
        "Machine intake side plates",
        "Assemble linear slide v3",
        "CAD outtake servo mount",
        "Re-tension drivetrain belts",
        "Wire the control hub",
        "Print replacement bumper clips",
        "Cut polycarb for the claw guard",
        "Build a practice field element",
    ],
    SOFTWARE: [
        "Tune drivetrain heading PID",
        "Autonomous path: left start",
        "Calibrate odometry pods",
        "Vision pipeline for samples",
        "Refactor TeleOp controls",
        "Add slide limit switches to code",
        "Log match telemetry to CSV",
    ],
    BUSINESS: [
        "Draft sponsor outreach email",
        "Update engineering portfolio",
        "Film robot reveal teaser",
        "Plan outreach day at library",
        "Design team T-shirts",
        "Write the Inspire award essay",
    ],
};

type Done = { title: string; subteam: Key | null; at: string; withTask: boolean };

interface DemoPerson {
    id: string;
    name: string;
    subteam: Key | null;
    role: string;
    itemsOpen: number;
    itemsSubmitted: number;
    /** Every item they finished, newest first: all their numbers come from it. */
    history: Done[];
}

/** Where counting starts (the portal's `since`). */
export const DEMO_SINCE = "2026-08-31";
/** Midnight at the start of DEMO_SINCE in the team's timezone (PDT). */
const SINCE_START = Date.parse(`${DEMO_SINCE}T07:00:00Z`);

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

function teamDay(at: number): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(at));
}

function mondayOf(day: string): string {
    const [y, m, d] = day.split("-").map(Number);
    const t = Date.UTC(y, m - 1, d);
    const back = (new Date(t).getUTCDay() + 6) % 7;
    return new Date(t - back * 86_400_000).toISOString().slice(0, 10);
}

function addDays(day: string, n: number): string {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000)
        .toISOString()
        .slice(0, 10);
}

/**
 * The portal's weeks: from the week `since` falls in, or 8 weeks back when
 * that's later, through this week (never after it).
 */
export function demoWeeks(since: string, now: number): string[] {
    const thisWeek = mondayOf(teamDay(now));
    const sinceWeek = mondayOf(since);
    const eightBack = addDays(thisWeek, -7 * 7);
    const first =
        sinceWeek > thisWeek ? thisWeek : sinceWeek > eightBack ? sinceWeek : eightBack;
    const weeks: string[] = [];
    for (let w = first; w <= thisWeek; w = addDays(w, 7)) weeks.push(w);
    return weeks;
}

/** A person's numbers, all from their `history` (like the portal's SQL). */
function statsOf(p: DemoPerson, now: number, weeks: string[]) {
    const last7From = addDays(teamDay(now), -6);
    const perWeek = new Map(weeks.map((w) => [w, 0]));
    let doneLast7Days = 0;
    for (const d of p.history) {
        const day = teamDay(Date.parse(d.at));
        if (day >= last7From) doneLast7Days += 1;
        const week = mondayOf(day);
        if (perWeek.has(week)) perWeek.set(week, perWeek.get(week)! + 1);
    }
    return {
        itemsDone: p.history.length,
        doneLast7Days,
        lastDoneAt: p.history[0]?.at ?? null,
        weekly: weeks.map((weekStart) => ({
            weekStart,
            itemsDone: perWeek.get(weekStart) ?? 0,
        })),
    };
}

/** The portal's wording for a position ("Build Lead", "Software Team"). */
function portalRole(roles: string[], key: Key | null): string {
    const joined = roles.join(" ");
    if (/captain/i.test(joined)) return "Captain";
    const label = key ? key.charAt(0) + key.slice(1).toLowerCase() : "Team";
    return /lead/i.test(joined) ? `${label} Lead` : key ? `${label} Team` : "Team Member";
}

function createWorld(now: number, roster: { name: string; roles: string[] }[]) {
    const rand = mulberry32(19516);
    const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
    // Finished items fall between the start of counting and a little before now.
    const from = Math.min(SINCE_START, now - 7 * 86_400_000);
    const to = now - 20 * 60_000;
    const people: DemoPerson[] = [];
    roster.forEach((r, i) => {
        // Every 9th person isn't in the (mock) portal: no live numbers.
        if (i % 9 === 4) return;
        const keys = subteamsFromRoles(r.roles) as Key[];
        const captain = /captain/i.test(r.roles.join(" "));
        const subteam = captain ? null : (keys[0] ?? null);
        const lead = /lead|captain/i.test(r.roles.join(" "));
        const empty = i === roster.length - 2; // brand new: nothing yet
        const itemsDone = empty ? 0 : Math.round(3 + rand() * (lead ? 30 : 20));
        const itemsOpen = empty ? 1 : Math.round(rand() * (lead ? 7 : 5));
        const itemsSubmitted = Math.min(itemsOpen, Math.round(rand() * 2));

        // Everything they finished, spread over the season, newest first.
        const times = Array.from({ length: itemsDone }, () =>
            Math.round(from + rand() * (to - from)),
        ).sort((a, b) => b - a);
        const history: Done[] = times.map((t) => {
            const key = subteam ?? pick(SUBTEAMS).key;
            return {
                title: pick(TITLES[key]),
                subteam: key,
                at: new Date(t).toISOString(),
                withTask: rand() < 0.14,
            };
        });
        people.push({
            id: `demo${(0x9e3779b1 * (i + 7)).toString(36).replace(/[^a-z0-9]/g, "").slice(-10)}`,
            name: r.name,
            subteam,
            role: portalRole(r.roles, subteam),
            itemsOpen,
            itemsSubmitted,
            history,
        });
    });
    // Someone in the portal who isn't on the page yet (fictional).
    people.push({
        id: "demoNewMember1",
        name: "Avery Lin",
        subteam: "BUILD",
        role: "Build Team",
        itemsOpen: 2,
        itemsSubmitted: 1,
        history: Array.from({ length: 4 }, (_, k) => ({
            title: TITLES.BUILD[k],
            subteam: "BUILD" as Key,
            at: new Date(now - (3 + k * 30) * 3_600_000).toISOString(),
            withTask: k === 3,
        })),
    });
    return { people };
}

type World = ReturnType<typeof createWorld>;

/** A completion or two since the last poll. */
function tick(world: World, now: number, rand: () => number) {
    if (rand() < 0.4) return;
    const open = world.people.filter((p) => p.itemsOpen > 0);
    if (open.length === 0) return;
    const p = open[Math.floor(rand() * open.length)];
    p.itemsOpen -= 1;
    p.itemsSubmitted = Math.min(p.itemsSubmitted, p.itemsOpen);
    const key = p.subteam ?? "BUILD";
    p.history.unshift({
        title: TITLES[key][Math.floor(rand() * TITLES[key].length)],
        subteam: key,
        at: new Date(now).toISOString(),
        withTask: false,
    });
}

type Opts = { hideNames: boolean; hideTitles: boolean; empty: boolean };

function publicPerson(p: DemoPerson, now: number, weeks: string[], empty: boolean) {
    const z = empty;
    const s = statsOf(p, now, weeks);
    return {
        id: p.id,
        name: p.name,
        subteam: p.subteam,
        role: p.role,
        itemsDone: z ? 0 : s.itemsDone,
        itemsOpen: z ? 0 : p.itemsOpen,
        itemsSubmitted: z ? 0 : p.itemsSubmitted,
        completion: z ? 0 : pct(s.itemsDone, p.itemsOpen),
        doneLast7Days: z ? 0 : s.doneLast7Days,
        lastDoneAt: z ? null : s.lastDoneAt,
    };
}

function teamSnapshot(world: World, now: number, o: Opts) {
    const weeks = demoWeeks(DEMO_SINCE, now);
    const ppl = world.people.map((p) => publicPerson(p, now, weeks, o.empty));
    const sum = (xs: typeof ppl, f: (p: (typeof ppl)[number]) => number) =>
        xs.reduce((a, p) => a + f(p), 0);
    const subteams = SUBTEAMS.map((s) => {
        const m = ppl.filter((p) => p.subteam === s.key);
        const done = sum(m, (p) => p.itemsDone);
        const open = sum(m, (p) => p.itemsOpen);
        return {
            key: s.key,
            name: s.name,
            itemsDone: done,
            itemsOpen: open,
            itemsSubmitted: sum(m, (p) => p.itemsSubmitted),
            completion: pct(done, open),
            doneLast7Days: sum(m, (p) => p.doneLast7Days),
            tasksActive: o.empty ? 0 : s.tasksActive,
            people: m.length,
        };
    });
    const done = sum(ppl, (p) => p.itemsDone);
    const open = sum(ppl, (p) => p.itemsOpen);
    const perPerson = world.people.map((p) => statsOf(p, now, weeks).weekly);
    return {
        enabled: true,
        team: { name: "The Huskyteers", number: 19516 },
        since: DEMO_SINCE,
        updatedAt: new Date(now).toISOString(),
        totals: {
            itemsDone: done,
            itemsOpen: open,
            itemsSubmitted: sum(ppl, (p) => p.itemsSubmitted),
            completion: pct(done, open),
            doneLast7Days: sum(ppl, (p) => p.doneLast7Days),
            tasksFinished: o.empty ? 0 : 41,
            tasksActive: o.empty ? 0 : 16,
            people: ppl.length,
        },
        subteams,
        people: o.hideNames ? [] : ppl,
        recent: [],
        weekly: weeks.map((weekStart, w) => ({
            weekStart,
            itemsDone: o.empty
                ? 0
                : perPerson.reduce((a, weekly) => a + weekly[w].itemsDone, 0),
        })),
    };
}

function personSnapshot(p: DemoPerson, now: number, o: Opts) {
    const weeks = demoWeeks(DEMO_SINCE, now);
    const s = statsOf(p, now, weeks);
    return {
        enabled: true,
        updatedAt: new Date(now).toISOString(),
        since: DEMO_SINCE,
        person: publicPerson(p, now, weeks, o.empty),
        weekly: o.empty
            ? weeks.map((weekStart) => ({ weekStart, itemsDone: 0 }))
            : s.weekly,
        done: o.empty
            ? []
            : p.history.slice(0, 25).map((d) => ({
                  ...d,
                  title: o.hideTitles ? null : d.title,
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

export function createTeamDemo(
    mode: string,
    roster: { name: string; roles: string[] }[],
): {
    fetcher: JsonFetcher;
    detailFetcher: (id: string) => JsonFetcher | null;
    pollMs: number;
} {
    const world = createWorld(Date.now(), roster);
    const rand = mulberry32(42);
    const opts: Opts = {
        hideNames: mode === "hidden",
        hideTitles: mode === "notitles",
        empty: mode === "empty",
    };
    let calls = 0;
    const started = Date.now();
    /** ?demo=leave: the first person has hidden themselves by now. */
    const left = (id: string) =>
        mode === "leave" && id === world.people[0]?.id && Date.now() - started > 20_000;
    return {
        pollMs: 8_000,
        fetcher: async (signal) => {
            calls += 1;
            await sleep(250 + Math.random() * 250, signal);
            if (mode === "error") throw new Error("Demo: portal unreachable");
            if (mode === "private") return { enabled: false };
            const now = Date.now();
            if (calls > 1 && !opts.empty) tick(world, now, rand);
            const snapshot = teamSnapshot(world, now, opts);
            return {
                ...snapshot,
                people: snapshot.people.filter((p) => !left(p.id)),
            };
        },
        // Throws like portalJsonFetcher (the page wraps it with
        // personDetailFetcher, as it does the real one).
        detailFetcher: (id) => async (signal) => {
            await sleep(mode === "slow" ? 4_000 : 300 + Math.random() * 300, signal);
            if (mode === "error" || mode === "detailerror") {
                throw new PortalHttpError(503);
            }
            const p = world.people.find((x) => x.id === id);
            if (!p || opts.hideNames || mode === "private" || mode === "nodetail" || left(id)) {
                throw new PortalHttpError(404);
            }
            return personSnapshot(p, Date.now(), opts);
        },
    };
}
