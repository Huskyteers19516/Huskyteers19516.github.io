// Tests for the Our Team page's data handling (src/components/team): slugs,
// matching people with the portal's public progress, photo lookup, deep
// links, the per-person answer and the wording. Run with `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    findPhotoMetadata,
    photoMetadataProblems,
    pruneUnusedPeoplePhotos,
} from "../src/integrations/people-photos.mjs";
import { PortalHttpError } from "../src/lib/portal-json.ts";
import { personTone, shownBadges } from "../src/components/team/badges.ts";
import {
    doneDate,
    doneLabel,
    doneTitle,
    itemsLabel,
    joinRoles,
    lastDoneAgo,
    liveSummary,
    niceTop,
    UNTITLED_TASK,
    weeklyTotal,
} from "../src/components/team/format.ts";
import {
    MAX_DONE,
    NOT_PUBLIC_STATUSES,
    parsePersonDetail,
    personDetailFetcher,
    personDetailPath,
} from "../src/components/team/person-detail.ts";
import {
    buildRoster,
    choosePhoto,
    firstName,
    isLeadRole,
    liveBySlug,
    looksAbbreviated,
    matchLive,
    normalizeName,
    personFromSearch,
    photoFileInfo,
    photoForName,
    photoFromImage,
    profileLinks,
    slugify,
    subteamsFromRoles,
    teamProfileHref,
    unusedPhotoFiles,
    withPersonParam,
} from "../src/components/team/roster.ts";

const live = (over = {}) => ({
    id: "AbC123_-xyz",
    name: "Tommy Ho",
    subteam: null,
    role: "Captain",
    itemsDone: 12,
    itemsOpen: 4,
    itemsSubmitted: 1,
    completion: 75,
    doneLast7Days: 3,
    lastDoneAt: "2026-10-04T18:30:00.000Z",
    ...over,
});

describe("slugify / normalizeName", () => {
    it("lowercases, hyphenates and strips accents", () => {
        assert.equal(slugify("Tommy Ho"), "tommy-ho");
        assert.equal(slugify("  Wolfgang   Lengsfeld "), "wolfgang-lengsfeld");
        assert.equal(slugify("José Núñez"), "jose-nunez");
        assert.equal(slugify("Zoë Ångström"), "zoe-angstrom");
    });

    it("drops apostrophes and turns other punctuation into one hyphen", () => {
        assert.equal(slugify("Liam O'Connor"), "liam-oconnor");
        assert.equal(slugify("Liam O’Connor"), "liam-oconnor");
        assert.equal(slugify("Mary-Jane  Watson Jr."), "mary-jane-watson-jr");
        assert.equal(slugify("tommy_ho"), "tommy-ho");
        assert.equal(slugify("--Tommy--"), "tommy");
    });

    it("keeps letters of other scripts and is empty for nothing", () => {
        assert.equal(slugify("张伟"), "张伟");
        assert.equal(slugify("   "), "");
        assert.equal(slugify("!!!"), "");
    });

    it("normalizes for comparing (case, spaces, accents, apostrophe style)", () => {
        assert.equal(normalizeName("  JOSÉ   O’Neil "), "jose o'neil");
        assert.equal(normalizeName("Ethan Zhang"), normalizeName("ethan  zhang"));
    });

    it("first names", () => {
        assert.equal(firstName("Tommy Ho"), "Tommy");
        assert.equal(firstName(" Cher "), "Cher");
    });
});

describe("choosePhoto", () => {
    const files = [
        "/src/assets/images/people/ethan.png",
        "/src/assets/images/people/tommy-ho.jpg",
        "/src/assets/images/people/Gwen Lengsfeld.JPG",
        "/src/assets/images/people/jack-luo.png",
        "/src/assets/images/people/jack-luo.webp",
        "/src/assets/images/people/notes.txt",
        "/src/assets/images/people/jose-nunez.jpeg",
    ];

    it("picks a file named after the person", () => {
        assert.deepEqual(choosePhoto("Tommy Ho", undefined, files), {
            kind: "file",
            path: "/src/assets/images/people/tommy-ho.jpg",
        });
        assert.deepEqual(choosePhoto("José Núñez", undefined, files), {
            kind: "file",
            path: "/src/assets/images/people/jose-nunez.jpeg",
        });
    });

    it("slugifies file names too (spaces, capitals, upper-case extension)", () => {
        assert.equal(
            choosePhoto("Gwen Lengsfeld", undefined, files)?.path,
            "/src/assets/images/people/Gwen Lengsfeld.JPG",
        );
    });

    it("prefers webp when one name has several files", () => {
        assert.equal(
            choosePhoto("Jack Luo", undefined, files)?.path,
            "/src/assets/images/people/jack-luo.webp",
        );
    });

    it("only matches exact names: ethan.png is nobody's automatic photo", () => {
        assert.equal(choosePhoto("Ethan Zhang", undefined, files), null);
        assert.equal(choosePhoto("Ethan", undefined, files)?.path, files[0]);
        assert.equal(choosePhoto("Jack Hu", undefined, files), null);
    });

    it("uses `image` first: a file in the folder by name or path", () => {
        for (const image of [
            "ethan.png",
            "ETHAN.PNG",
            "people/ethan.png",
            "../../assets/images/people/ethan.png",
            "ethan",
        ]) {
            assert.deepEqual(choosePhoto("Ethan Zhang", image, files), {
                kind: "file",
                path: "/src/assets/images/people/ethan.png",
            }, image);
        }
    });

    it("uses links in `image` as is", () => {
        assert.deepEqual(choosePhoto("Tommy Ho", "/images/tommy.jpg", files), {
            kind: "url",
            url: "/images/tommy.jpg",
        });
        assert.deepEqual(
            choosePhoto("Tommy Ho", " https://example.com/t.png ", files),
            { kind: "url", url: "https://example.com/t.png" },
        );
    });

    it("falls back to the name when `image` names a missing file", () => {
        assert.equal(photoFromImage("missing.png", files), null);
        assert.equal(
            choosePhoto("Tommy Ho", "missing.png", files)?.path,
            "/src/assets/images/people/tommy-ho.jpg",
        );
        assert.equal(photoForName("", files), null);
    });

    it("ignores other file types", () => {
        assert.equal(photoFileInfo("/x/notes.txt"), null);
        assert.equal(photoFileInfo("/x/.png"), null);
        assert.deepEqual(photoFileInfo("/x/Tommy Ho.JPG"), {
            file: "Tommy Ho.JPG",
            slug: "tommy-ho",
            ext: "jpg",
        });
        assert.equal(choosePhoto("Notes", undefined, files), null);
    });
});

describe("buildRoster", () => {
    const sections = [
        {
            title: "Leadership",
            people: [
                { name: "Tommy Ho", roles: ["Captain"] },
                { name: "Jack Luo", roles: ["Software Lead"] },
            ],
        },
        {
            title: "Members",
            people: [
                { name: "Tim Jung", roles: ["Build Team"] },
                { name: "Michael Hyodo", roles: ["Software Team"] },
                { name: "Tim  Jung", roles: ["Software Team"], image: "tim.png" },
                { name: "Elizabeth Hyodo", roles: ["Business Team"] },
                { name: "  ", roles: ["Build Team"] },
            ],
        },
    ];

    it("lists everyone once, in page order", () => {
        const r = buildRoster(sections);
        assert.deepEqual(
            r.map((p) => p.slug),
            ["tommy-ho", "jack-luo", "tim-jung", "michael-hyodo", "elizabeth-hyodo"],
        );
    });

    it("merges a name listed twice: both positions, both entries", () => {
        const tim = buildRoster(sections).find((p) => p.slug === "tim-jung");
        assert.deepEqual(tim.roles, ["Build Team", "Software Team"]);
        assert.equal(tim.entries.length, 2);
        assert.equal(tim.entries.find((e) => e.image)?.image, "tim.png");
        assert.equal(tim.name, "Tim Jung");
        assert.equal(tim.lead, false);
    });

    it("marks leads by role or by the Leadership section", () => {
        const r = buildRoster(sections);
        assert.equal(r[0].lead, true);
        assert.equal(r[1].lead, true);
        assert.equal(isLeadRole(["Co-Captain"]), true);
        assert.equal(isLeadRole(["Build Team"]), false);
        assert.equal(isLeadRole(["Build Team"], "Leadership"), true);
    });

    it("finds subteams in positions", () => {
        assert.deepEqual(subteamsFromRoles(["Build Lead"]), ["BUILD"]);
        assert.deepEqual(subteamsFromRoles(["Build Team", "Software Team"]), [
            "BUILD",
            "SOFTWARE",
        ]);
        assert.deepEqual(subteamsFromRoles(["Captain", "Design Team"]), []);
    });
});

describe("badges", () => {
    it("colors people: gold for leads, else their subteam", () => {
        assert.equal(personTone(["Team Captain"]), "gold");
        assert.equal(personTone(["Build Lead"]), "gold");
        assert.equal(personTone(["Build Team"], true), "gold");
        assert.equal(personTone(["Software Team"]), "teal");
        assert.equal(personTone(["Build Team", "Software Team"]), "teal");
        assert.equal(personTone(["Business Team"]), "violet");
        assert.equal(personTone(["Build Team"]), "green");
        assert.equal(personTone([]), "green");
    });

    it("fills in icon and tone, trims, drops blanks and repeated titles", () => {
        const badges = shownBadges(
            [
                [
                    { title: " Mission Commander ", description: " Team lead ", icon: "crown", tone: "gold" },
                    { title: "  " },
                    { title: "Tech Architect", icon: "nope", tone: "pink" },
                ],
                undefined,
                [{ title: "mission commander", description: "again" }, { title: "Web Developer" }],
            ],
            "teal",
        );
        assert.deepEqual(badges, [
            { title: "Mission Commander", description: "Team lead", icon: "crown", tone: "gold" },
            { title: "Tech Architect", description: "", icon: "sparkles", tone: "teal" },
            { title: "Web Developer", description: "", icon: "sparkles", tone: "teal" },
        ]);
    });

    it("merges a name listed twice into one list, in the person's tone", () => {
        const [tim, tommy] = buildRoster([
            {
                title: "Members",
                people: [
                    { name: "Tim Jung", roles: ["Build Team"], badges: [{ title: "Drivetrain Builder", tone: "green" }] },
                    { name: "Tim Jung", roles: ["Software Team"], badges: [{ title: "Autonomous Coder" }] },
                    { name: "Tommy Ho", roles: ["Team Captain"], badges: [{ title: "Mission Commander" }] },
                ],
            },
        ]);
        assert.equal(tim.tone, "teal");
        assert.deepEqual(
            tim.badges.map((b) => [b.title, b.tone]),
            [["Drivetrain Builder", "green"], ["Autonomous Coder", "teal"]],
        );
        assert.equal(tommy.tone, "gold");
        assert.equal(tommy.badges[0].tone, "gold");
    });
});

describe("matchLive", () => {
    const roster = buildRoster([
        {
            title: "",
            people: [
                { name: "Tommy Ho", roles: [] },
                { name: "José Núñez", roles: [] },
                { name: "Jack Luo", roles: [] },
                { name: "Alice Wang", roles: [] },
            ],
        },
    ]);

    it("matches full names ignoring case, spaces and accents", () => {
        const m = matchLive(roster, [
            live({ id: "a", name: "tommy  ho" }),
            live({ id: "b", name: "Jose Nunez" }),
        ]);
        assert.equal(m.get("tommy-ho")?.id, "a");
        assert.equal(m.get("jose-nunez")?.id, "b");
        assert.equal(m.has("jack-luo"), false);
    });

    it("doesn't match shortened names (portal name style not 'full')", () => {
        const m = matchLive(roster, [
            live({ id: "a", name: "Tommy H." }),
            live({ id: "b", name: "J.L." }),
        ]);
        assert.equal(m.size, 0);
    });

    it("matches nobody when two portal people share a name", () => {
        const m = matchLive(roster, [
            live({ id: "a", name: "Alice Wang" }),
            live({ id: "b", name: "alice wang" }),
            live({ id: "c", name: "Jack Luo" }),
        ]);
        assert.equal(m.has("alice-wang"), false);
        assert.equal(m.get("jack-luo")?.id, "c");
    });

    it("finds portal-only people by slug (unique only)", () => {
        const people = [
            live({ id: "a", name: "Avery Lin" }),
            live({ id: "b", name: "E.C." }),
            live({ id: "c", name: "E C" }),
        ];
        assert.equal(liveBySlug("avery-lin", people)?.id, "a");
        assert.equal(liveBySlug("e-c", people), null);
        assert.equal(liveBySlug("nobody", people), null);
    });
});

describe("deep links", () => {
    it("reads ?person= as a slug", () => {
        assert.equal(personFromSearch("?person=tommy-ho"), "tommy-ho");
        assert.equal(personFromSearch("?demo=1&person=Tommy%20Ho"), "tommy-ho");
        assert.equal(personFromSearch("?person="), null);
        assert.equal(personFromSearch("?person=%3Cscript%3E"), "script");
        assert.equal(personFromSearch(""), null);
    });

    it("sets and clears ?person= keeping other params and the hash", () => {
        const base = "https://huskyteers19516.github.io/about/team?demo=1#members";
        assert.equal(
            withPersonParam(base, "tommy-ho"),
            "/about/team?demo=1&person=tommy-ho#members",
        );
        assert.equal(
            withPersonParam(
                "https://x.org/about/team?person=tommy-ho&demo=1",
                null,
            ),
            "/about/team?demo=1",
        );
        assert.equal(withPersonParam("https://x.org/about/team", null), "/about/team");
    });

    it("links /progress people to their profile", () => {
        assert.equal(teamProfileHref("Tommy Ho"), "/about/team?person=tommy-ho");
        assert.equal(
            teamProfileHref("José Núñez", "demo=1"),
            "/about/team?person=jose-nunez&demo=1",
        );
        assert.equal(teamProfileHref("张伟"), `/about/team?person=${encodeURIComponent("张伟")}`);
        assert.equal(teamProfileHref("!!"), "/about/team");
    });
});

describe("parsePersonDetail", () => {
    const answer = (over = {}) => ({
        enabled: true,
        updatedAt: "2026-10-05T17:00:00.000Z",
        since: "2026-08-31",
        person: live(),
        weekly: [
            { weekStart: "2026-09-28", itemsDone: 3 },
            { weekStart: "2026-08-17", itemsDone: 1 },
            { weekStart: "2026-08-24", itemsDone: -2 },
            { weekStart: "2026-08-31", itemsDone: 2 },
            { weekStart: "2026-09-07", itemsDone: 0 },
            { weekStart: "2026-09-14", itemsDone: 4 },
            { weekStart: "2026-09-21", itemsDone: 1.7 },
            { weekStart: "2026-10-05", itemsDone: 1 },
            { weekStart: "2026-10-05", itemsDone: 9 },
            { weekStart: "2026-02-30", itemsDone: 9 },
            { weekStart: "2026-08-10", itemsDone: 6 },
        ],
        done: [
            { title: "Old one", subteam: "BUILD", at: "2026-09-01T10:00:00.000Z", withTask: false },
            { title: "  Tune   PID ", subteam: "SOFTWARE", at: "2026-10-04T18:30:00.000Z", withTask: true },
            { title: null, subteam: null, at: "2026-10-02T09:00:00.000Z" },
            { title: "No date", subteam: "BUILD", at: "yesterday" },
            "junk",
        ],
        ...over,
    });

    it("reads the person, weeks (sorted, last 8, deduped) and finished items", () => {
        const d = parsePersonDetail(answer(), "AbC123_-xyz");
        assert.ok(d && d.enabled);
        assert.equal(d.person.name, "Tommy Ho");
        assert.equal(d.person.itemsSubmitted, 1);
        assert.deepEqual(
            d.weekly.map((w) => [w.weekStart, w.itemsDone]),
            [
                ["2026-08-17", 1],
                ["2026-08-24", 0],
                ["2026-08-31", 2],
                ["2026-09-07", 0],
                ["2026-09-14", 4],
                ["2026-09-21", 1],
                ["2026-09-28", 3],
                ["2026-10-05", 1],
            ],
        );
        assert.deepEqual(
            d.done.map((x) => [x.title, x.subteam, x.withTask]),
            [
                ["Tune PID", "SOFTWARE", true],
                [null, null, false],
                ["Old one", "BUILD", false],
            ],
        );
        assert.equal(d.since, "2026-08-31");
    });

    it("keeps at most MAX_DONE items, newest first", () => {
        const done = Array.from({ length: 40 }, (_, i) => ({
            title: `T${i}`,
            subteam: "BUILD",
            at: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(),
            withTask: false,
        }));
        const d = parsePersonDetail(answer({ done }));
        assert.equal(d.done.length, MAX_DONE);
        assert.equal(d.done[0].title, "T39");
    });

    it("refuses unusable answers and answers about someone else", () => {
        assert.equal(parsePersonDetail(null), null);
        assert.equal(parsePersonDetail({ error: "Not found" }), null);
        assert.equal(parsePersonDetail(answer({ person: { name: "No id" } })), null);
        assert.equal(parsePersonDetail(answer(), "someone-else"), null);
        assert.deepEqual(parsePersonDetail({ enabled: false }), { enabled: false });
    });

    it("never keeps fields outside the contract", () => {
        const d = parsePersonDetail(
            answer({
                person: live({ email: "x@example.com" }),
                done: [
                    {
                        title: "A",
                        subteam: "BUILD",
                        at: "2026-10-01T00:00:00.000Z",
                        withTask: "yes",
                        note: "secret",
                    },
                ],
            }),
        );
        assert.equal("email" in d.person, false);
        assert.deepEqual(Object.keys(d.done[0]).sort(), ["at", "subteam", "title", "withTask"]);
        assert.equal(d.done[0].withTask, false);
    });

    it("builds the endpoint path only for safe ids", () => {
        assert.equal(
            personDetailPath("AbC123_-xyz"),
            "/api/public/progress/people/AbC123_-xyz",
        );
        assert.equal(personDetailPath("../admin"), null);
        assert.equal(personDetailPath(""), null);
        assert.equal(personDetailPath("a".repeat(65)), null);
    });
});

describe("format", () => {
    const now = Date.parse("2026-10-05T19:00:00.000Z"); // Mon, Oct 5 (LA)

    it("item counts", () => {
        assert.equal(itemsLabel(0), "0 items");
        assert.equal(itemsLabel(1), "1 item");
        assert.equal(itemsLabel(1234), "1,234 items");
    });

    it("roles, done labels and untitled tasks", () => {
        assert.equal(joinRoles(["Build Team", " ", "Software Team"]), "Build Team · Software Team");
        assert.equal(doneLabel(1234), "1,234 done");
        assert.equal(doneTitle(null), UNTITLED_TASK);
        assert.equal(doneTitle("Wire the hub"), "Wire the hub");
    });

    it("screen-reader summary of a card", () => {
        assert.equal(
            liveSummary(live()),
            "12 checklist items done, 75% of their items, 1 in review",
        );
        assert.equal(
            liveSummary(live({ itemsDone: 0, itemsOpen: 0, itemsSubmitted: 0 })),
            "No checklist items assigned yet",
        );
    });

    it("dates and ages in the team's timezone", () => {
        assert.equal(lastDoneAgo("2026-10-05T16:00:00.000Z", now), "today");
        assert.equal(lastDoneAgo("2026-10-04T16:00:00.000Z", now), "yesterday");
        assert.equal(lastDoneAgo("2026-10-01T16:00:00.000Z", now), "4 days ago");
        assert.equal(lastDoneAgo("2026-09-14T16:00:00.000Z", now), "3 weeks ago");
        assert.equal(lastDoneAgo("2026-08-01T16:00:00.000Z", now), "Aug 1");
        assert.equal(doneDate("2025-12-12T20:00:00.000Z", now), "Dec 12, 2025");
        assert.equal(doneDate("nope", now), "nope");
    });

    it("chart helpers", () => {
        assert.equal(niceTop(0), 4);
        assert.equal(niceTop(7), 10);
        assert.equal(niceTop(13), 20);
        assert.equal(niceTop(21), 25);
        assert.equal(weeklyTotal([{ weekStart: "x", itemsDone: 2 }, { weekStart: "y", itemsDone: 5 }]), 7);
    });
});

/** The team's calendar day (YYYY-MM-DD, Los Angeles), like the portal. */
const teamDayOf = (t) =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(t));

describe("dev demo data (?demo=1)", async () => {
    const { createTeamDemo, demoWeeks } = await import("../src/components/team/demo-data.ts");
    const { parseProgress } = await import("../src/components/progress/types.ts");
    const roster = buildRoster([
        {
            title: "Leadership",
            people: [
                { name: "Tommy Ho", roles: ["Captain"] },
                { name: "Ethan Zhang", roles: ["Build Lead"] },
            ],
        },
        {
            title: "Members",
            people: Array.from({ length: 12 }, (_, i) => ({
                name: `Member ${String.fromCharCode(65 + i)}`,
                roles: [["Build Team", "Software Team", "Business Team"][i % 3]],
            })),
        },
    ]);
    const names = roster.map((r) => ({ name: r.name, roles: r.roles }));
    const signal = new AbortController().signal;

    it("matches the team feed contract and the page's names", async () => {
        const demo = createTeamDemo("1", names);
        const team = parseProgress(await demo.fetcher(signal));
        assert.ok(team && team.enabled);
        const matched = matchLive(roster, team.people);
        assert.ok(matched.size >= roster.length - 2, `${matched.size} matched`);
        assert.ok(liveBySlug("avery-lin", team.people));
        // Like the portal: the weeks start at the week `since` falls in (at
        // most 8), and the team's weeks add up to everything done.
        assert.deepEqual(
            team.weekly.map((w) => w.weekStart),
            demoWeeks(team.since, Date.now()),
        );
        assert.ok(team.weekly.length >= 1 && team.weekly.length <= 8);
        assert.ok(team.weekly[0].weekStart >= "2026-08-31");
        assert.equal(
            team.weekly.reduce((a, w) => a + w.itemsDone, 0),
            team.totals.itemsDone,
        );
        assert.equal(
            team.people.reduce((a, p) => a + p.doneLast7Days, 0),
            team.totals.doneLast7Days,
        );
    });

    it("matches the per-person contract, with numbers that agree with the list", async () => {
        const demo = createTeamDemo("notitles", names);
        const team = parseProgress(await demo.fetcher(signal));
        const now = Date.now();
        let checked = 0;
        for (const someone of team.people) {
            const d = parsePersonDetail(
                await demo.detailFetcher(someone.id)(signal),
                someone.id,
            );
            assert.ok(d && d.enabled);
            assert.equal(d.person.id, someone.id);
            assert.deepEqual(d.person, someone);
            assert.deepEqual(
                d.weekly.map((w) => w.weekStart),
                team.weekly.map((w) => w.weekStart),
            );
            assert.equal(weeklyTotal(d.weekly), someone.itemsDone, someone.name);
            assert.equal(d.done.length, Math.min(someone.itemsDone, MAX_DONE));
            assert.equal(d.done[0]?.at ?? null, someone.lastDoneAt);
            assert.ok(d.done.every((x) => x.title === null));
            for (const x of d.done) assert.ok(x.at >= `${d.since}T07:00:00.000Z`, x.at);
            if (someone.itemsDone <= MAX_DONE) {
                const weekAgo = teamDayOf(now - 6 * 86_400_000);
                const recent = d.done.filter((x) => teamDayOf(Date.parse(x.at)) >= weekAgo);
                assert.equal(recent.length, someone.doneLast7Days, someone.name);
            }
            checked += 1;
        }
        assert.ok(checked > 5);
    });

    it("answers like the portal: 404 for unknown people, hidden names, and profiles off; 503 when it fails", async () => {
        const status = (p) =>
            p.then(
                () => "ok",
                (e) => (e instanceof PortalHttpError ? e.status : String(e)),
            );
        const demo = createTeamDemo("hidden", names);
        const team = parseProgress(await demo.fetcher(signal));
        assert.equal(team.people.length, 0);
        assert.equal(await status(demo.detailFetcher("demoNewMember1")(signal)), 404);
        assert.equal(await status(createTeamDemo("1", names).detailFetcher("nope")(signal)), 404);
        const off = createTeamDemo("nodetail", names);
        assert.equal(await status(off.detailFetcher("demoNewMember1")(signal)), 404);
        // What the page makes of it: not public (not an outage).
        assert.deepEqual(
            await personDetailFetcher(off.detailFetcher("demoNewMember1"))(signal),
            { enabled: false },
        );
        const failing = createTeamDemo("detailerror", names);
        assert.equal(await status(failing.detailFetcher("demoNewMember1")(signal)), 503);
        await assert.rejects(
            personDetailFetcher(failing.detailFetcher("demoNewMember1"))(signal),
            PortalHttpError,
        );
    });
});

describe("personDetailFetcher (a 404 means not public)", () => {
    const signal = new AbortController().signal;
    const throwing = (e) => async () => {
        throw e;
    };

    it("turns the portal's not-public answers into { enabled: false }", async () => {
        for (const code of [401, 403, 404, 410]) {
            assert.ok(NOT_PUBLIC_STATUSES.includes(code));
            assert.deepEqual(
                await personDetailFetcher(throwing(new PortalHttpError(code)))(signal),
                { enabled: false },
                String(code),
            );
        }
        // …which parses as "not public".
        assert.deepEqual(parsePersonDetail({ enabled: false }, "x"), { enabled: false });
    });

    it("keeps outages as errors (retried) and passes answers through", async () => {
        for (const code of [500, 502, 503, 429]) {
            await assert.rejects(
                personDetailFetcher(throwing(new PortalHttpError(code)))(signal),
                (e) => e instanceof PortalHttpError && e.status === code,
            );
        }
        await assert.rejects(
            personDetailFetcher(throwing(new TypeError("Failed to fetch")))(signal),
            TypeError,
        );
        const body = { enabled: true };
        assert.equal(await personDetailFetcher(async () => body)(signal), body);
    });

    it("PortalHttpError carries the status", () => {
        const e = new PortalHttpError(404);
        assert.ok(e instanceof Error);
        assert.equal(e.status, 404);
        assert.equal(e.message, "HTTP 404");
    });
});

describe("profile links (/progress -> Our Team)", () => {
    it("knows shortened names from whole ones", () => {
        for (const name of ["E.C.", "E.", "T.H.", "Ethan C.", "Mary L.", "Ö.Ä.", " ", ""]) {
            assert.equal(looksAbbreviated(name), true, JSON.stringify(name));
        }
        for (const name of ["Ethan Chen", "Prince", "J. R. Smith", "Malcolm X", "张伟", "Mary-Jane Watson Jr."]) {
            assert.equal(looksAbbreviated(name), false, name);
        }
    });

    it("links whole, unique names only", () => {
        const links = profileLinks([
            { id: "a", name: "Tommy Ho" },
            { id: "b", name: "J.L." },
            { id: "c", name: "J.L." },
            { id: "d", name: "Tim Jung" },
            { id: "e", name: "Tim-Jung" },
            { id: "f", name: "Ethan C." },
            { id: "g", name: "Prince" },
            { id: "h", name: "!!" },
        ]);
        assert.deepEqual([...links], [
            ["a", "tommy-ho"],
            ["g", "prince"],
        ]);
        assert.equal(teamProfileHref(links.get("a"), "demo=1"), "/about/team?person=tommy-ho&demo=1");
    });

    it("links nobody when the portal shows initials (and the team page opens no stray profile)", () => {
        const people = [
            live({ id: "a", name: "T.H." }),
            live({ id: "b", name: "C.M." }),
            live({ id: "c", name: "Ethan Z." }),
        ];
        assert.equal(profileLinks(people).size, 0);
        assert.equal(liveBySlug("t-h", people), null);
        assert.equal(liveBySlug("ethan-z", people), null);
        assert.equal(liveBySlug("avery-lin", [live({ id: "x", name: "Avery Lin" })])?.id, "x");
    });
});

describe("unused photos", () => {
    const files = [
        "/src/assets/images/people/ethan.png",
        "/src/assets/images/people/tommy-ho.jpg",
        "/src/assets/images/people/group.webp",
        "/src/assets/images/people/old-member.png",
        "/src/assets/images/people/notes.txt",
    ];

    it("names the files nobody uses by name or `image`", () => {
        assert.deepEqual(
            unusedPhotoFiles(
                [
                    { name: "Tommy Ho", roles: [] },
                    { name: "Ethan Zhang", image: "group.webp" },
                    { name: "Grant Story" },
                ],
                files,
            ),
            ["/src/assets/images/people/ethan.png", "/src/assets/images/people/old-member.png"],
        );
    });

    it("counts imported images through their paths", () => {
        assert.deepEqual(
            unusedPhotoFiles(
                [{ name: "Ethan Zhang", image: { src: "/x.png" } }, { name: "Old Member" }],
                files,
                ["/src/assets/images/people/ethan.png"],
            ),
            ["/src/assets/images/people/tommy-ho.jpg", "/src/assets/images/people/group.webp"],
        );
    });
});

describe("photo metadata", () => {
    const bytes = (...parts) => {
        const chunks = parts.map((p) => (typeof p === "string" ? Buffer.from(p, "latin1") : Buffer.from(p)));
        return new Uint8Array(Buffer.concat(chunks));
    };
    const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const u32le = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    const png = (...chunks) =>
        bytes(
            "\x89PNG\r\n\x1a\n",
            ...chunks.flatMap(([type, data]) => [u32(data.length), type, data, [0, 0, 0, 0]]),
            u32(0),
            "IEND",
            [0, 0, 0, 0],
        );
    const jpeg = (...segments) =>
        bytes(
            [0xff, 0xd8],
            ...segments.flatMap(([marker, data]) => [[0xff, marker, ((data.length + 2) >> 8) & 255, (data.length + 2) & 255], data]),
            [0xff, 0xda, 0, 2],
            [0xff, 0xd9],
        );
    const webp = (...chunks) => {
        const body = bytes("WEBP", ...chunks.flatMap(([type, data]) => [type, u32le(data.length), data, data.length % 2 ? [0] : []]));
        return bytes("RIFF", u32le(body.length), body);
    };

    it("finds EXIF and GPS data in JPEG, PNG and WebP files", () => {
        assert.match(photoMetadataProblems(jpeg([0xe1, "Exif\0\0MM\0*"]))[0], /EXIF/);
        assert.match(
            photoMetadataProblems(jpeg([0xe1, "http://ns.adobe.com/xap/1.0/\0<x exif:GPSLatitude='34'/>"]))[0],
            /GPS/,
        );
        assert.match(photoMetadataProblems(png(["eXIf", "MM\0*"]))[0], /EXIF/);
        assert.match(photoMetadataProblems(png(["tEXt", "Raw profile type exif\0abc"]))[0], /EXIF/);
        assert.match(photoMetadataProblems(png(["iTXt", "XML:com.adobe.xmp\0\0\0\0\0<exif:GPSLatitude/>"]))[0], /GPS/);
        assert.match(photoMetadataProblems(png(["zTXt", "XML:com.adobe.xmp\0\0xyz"]))[0], /compressed/);
        assert.match(photoMetadataProblems(webp(["VP8 ", "abcd"], ["EXIF", "MM\0*1"]))[0], /EXIF/);
        assert.match(photoMetadataProblems(webp(["XMP ", "<GPSLatitude/>"]))[0], /GPS/);
    });

    it("leaves clean files alone (sizes, colors, a screenshot's XMP)", () => {
        assert.deepEqual(photoMetadataProblems(jpeg([0xe0, "JFIF\0\x01\x01"], [0xdb, "\0\x01\x02"])), []);
        assert.deepEqual(
            photoMetadataProblems(png(["pHYs", "\0\0\0\0\0\0\0\0\x01"], ["iTXt", "XML:com.adobe.xmp\0\0\0\0\0<exif:PixelXDimension>9</exif:PixelXDimension>"])),
            [],
        );
        assert.deepEqual(photoMetadataProblems(webp(["VP8 ", "abcd"])), []);
        assert.deepEqual(photoMetadataProblems(bytes("GIF89a")), []);
    });

    it("every photo in src/assets/images/people/ is clean (remove EXIF / GPS before adding one)", async () => {
        const dir = fileURLToPath(new URL("../src/assets/images/people/", import.meta.url));
        const found = await findPhotoMetadata(dir);
        assert.deepEqual(
            found,
            [],
            found.map((f) => `${f.file}: ${f.problems.join(", ")} — run: exiftool -all= -overwrite_original "src/assets/images/people/${f.file}"`).join("\n"),
        );
    });
});

describe("pruneUnusedPeoplePhotos (build)", () => {
    it("deletes copies of people photos that nothing in the build mentions", async () => {
        const root = await mkdtemp(join(tmpdir(), "team-photos-"));
        try {
            const photos = join(root, "people");
            const dist = join(root, "dist");
            await mkdir(photos);
            await mkdir(join(dist, "_astro"), { recursive: true });
            await mkdir(join(dist, "about"), { recursive: true });
            await writeFile(join(photos, "ethan.png"), "ETHAN-ORIGINAL");
            await writeFile(join(photos, "tommy-ho.jpg"), "TOMMY-ORIGINAL");
            await writeFile(join(photos, "notes.txt"), "not a photo");
            // Vite's full-size copies; one is used by a page.
            await writeFile(join(dist, "_astro", "ethan.Bzn_9dkw.png"), "ETHAN-ORIGINAL");
            await writeFile(join(dist, "_astro", "tommy-ho.Ab12Cd34.jpg"), "TOMMY-ORIGINAL");
            // Same name, other bytes (a resized copy): never touched.
            await writeFile(join(dist, "_astro", "ethan.Zz99Yy88.webp"), "RESIZED");
            await writeFile(
                join(dist, "about", "index.html"),
                '<img src="/_astro/tommy-ho.Ab12Cd34.jpg"><img src="/_astro/ethan.Zz99Yy88.webp">',
            );

            const removed = await pruneUnusedPeoplePhotos({ distDir: dist, photosDir: photos });
            assert.deepEqual(removed, [join("_astro", "ethan.Bzn_9dkw.png")]);
            assert.deepEqual((await readdir(join(dist, "_astro"))).sort(), [
                "ethan.Zz99Yy88.webp",
                "tommy-ho.Ab12Cd34.jpg",
            ]);
            assert.equal(await readFile(join(photos, "ethan.png"), "utf8"), "ETHAN-ORIGINAL");
            // Nothing to do: no photos folder, or nothing left.
            assert.deepEqual(await pruneUnusedPeoplePhotos({ distDir: dist, photosDir: join(root, "missing") }), []);
            assert.deepEqual(await pruneUnusedPeoplePhotos({ distDir: dist, photosDir: photos }), []);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
