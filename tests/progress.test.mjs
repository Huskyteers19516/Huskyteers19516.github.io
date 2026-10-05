// Regression tests for the live Progress page's data handling
// (src/components/progress). Run with `npm test` (Node's built-in test
// runner, which loads the TypeScript sources with type stripping). Plain JS
// so the site's TypeScript check doesn't need Node's type definitions.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    feedRows,
    untitledHeadline,
} from "../src/components/progress/feed-rows.ts";
import {
    MAX_PAYLOAD_CHARS,
    MAX_PEOPLE,
    MAX_SUBTEAMS,
    parseProgress,
    readJson,
} from "../src/components/progress/types.ts";

const base = {
    enabled: true,
    team: { name: "The Huskyteers", number: 19516 },
    since: "2026-08-31",
    updatedAt: "2026-09-24T19:00:00.000Z",
    totals: {
        itemsDone: 7,
        itemsOpen: 3,
        itemsSubmitted: 1,
        completion: 70,
        doneLast7Days: 5,
        tasksFinished: 4,
        tasksActive: 2,
        people: 5,
    },
    subteams: [
        {
            key: "BUILD",
            name: "Build",
            itemsDone: 4,
            itemsOpen: 2,
            itemsSubmitted: 1,
            completion: 67,
            doneLast7Days: 4,
            tasksActive: 1,
            people: 2,
        },
    ],
    people: [
        {
            id: "abc",
            name: "Ethan Chen",
            subteam: "BUILD",
            role: "Build Team",
            itemsDone: 2,
            itemsOpen: 1,
            itemsSubmitted: 0,
            completion: 67,
            doneLast7Days: 2,
            lastDoneAt: "2026-09-24T18:59:00.000Z",
        },
    ],
    recent: [],
    weekly: [
        { weekStart: "2026-08-31", itemsDone: 0 },
        { weekStart: "2026-09-07", itemsDone: 1 },
    ],
};

/** @returns {import("../src/components/progress/types.ts").ProgressEnabled} */
function parse(raw) {
    const p = parseProgress(raw);
    if (!p || !p.enabled) throw new Error("expected an enabled payload");
    return p;
}

describe("parseProgress", () => {
    it("reads items waiting for review, never more than the open items", () => {
        const p = parse(base);
        assert.equal(p.totals.itemsSubmitted, 1);
        assert.equal(p.subteams[0].itemsSubmitted, 1);
        assert.equal(p.people[0].itemsSubmitted, 0);

        const odd = parse({
            ...base,
            totals: { ...base.totals, itemsOpen: 2, itemsSubmitted: 9 },
            people: [{ ...base.people[0], itemsSubmitted: undefined }],
        });
        assert.equal(odd.totals.itemsSubmitted, 2);
        assert.equal(odd.people[0].itemsSubmitted, 0); // older portal: 0
    });

    it("keeps fewer than 8 weeks as sent (the season started recently)", () => {
        assert.deepEqual(
            parse(base).weekly.map((w) => w.weekStart),
            ["2026-08-31", "2026-09-07"],
        );
        const dup = parse({
            ...base,
            weekly: [...base.weekly, { weekStart: "2026-09-07", itemsDone: 5 }],
        });
        assert.equal(dup.weekly.length, 2);
    });

    it("caps people and subteams, and drops duplicate subteams", () => {
        const people = Array.from({ length: MAX_PEOPLE + 50 }, (_, i) => ({
            ...base.people[0],
            id: `p${i}`,
        }));
        const subteams = [
            base.subteams[0],
            { ...base.subteams[0], name: "Build again" },
            ...Array.from({ length: 10 }, (_, i) => ({
                ...base.subteams[0],
                key: `S${i}`,
            })),
        ];
        const p = parse({ ...base, people, subteams });
        assert.equal(p.people.length, MAX_PEOPLE);
        assert.equal(p.subteams.length, MAX_SUBTEAMS);
        assert.equal(p.subteams.filter((s) => s.key === "BUILD").length, 1);
        assert.equal(p.subteams[0].name, "Build");
    });

    it("reads the private answer and refuses garbage", () => {
        assert.deepEqual(parseProgress({ enabled: false }), { enabled: false });
        assert.equal(parseProgress("nope"), null);
        assert.equal(parseProgress({ enabled: true }), null);
    });
});

describe("readJson", () => {
    it("parses a normal body", async () => {
        const res = new Response(JSON.stringify(base));
        assert.deepEqual(await readJson(res), base);
    });

    it("refuses a body over the limit", async () => {
        const big = JSON.stringify({ pad: "x".repeat(MAX_PAYLOAD_CHARS) });
        await assert.rejects(readJson(new Response(big)), /too large/);
        const declared = new Response("{}", {
            headers: { "content-length": String(MAX_PAYLOAD_CHARS + 1) },
        });
        await assert.rejects(readJson(declared), /too large/);
    });
});

describe("feedRows", () => {
    const row = (at, over = {}) => ({
        title: null,
        subteam: "BUILD",
        who: null,
        at,
        ...over,
    });

    it("merges untitled items next to each other from the same subteam", () => {
        const rows = feedRows([
            row("2026-09-24T18:00:00Z"),
            row("2026-09-24T17:00:00Z"),
            row("2026-09-24T16:00:00Z"),
            row("2026-09-24T15:00:00Z", { subteam: "SOFTWARE" }),
            row("2026-09-24T14:00:00Z"),
        ]);
        assert.deepEqual(
            rows.map((r) => [r.subteam, r.count, r.at]),
            [
                ["BUILD", 3, "2026-09-24T18:00:00Z"],
                ["SOFTWARE", 1, "2026-09-24T15:00:00Z"],
                ["BUILD", 1, "2026-09-24T14:00:00Z"],
            ],
        );
        assert.equal(untitledHeadline(rows[0], "Build"), "Build finished 3 items");
        assert.equal(
            untitledHeadline(rows[1], "Software"),
            "Software finished an item",
        );
    });

    it("keeps different people apart, names them, and never merges titled items", () => {
        const rows = feedRows([
            row("2026-09-24T18:00:00Z", { who: "Hannah S." }),
            row("2026-09-24T17:00:00Z", { who: "Ethan C." }),
            row("2026-09-24T16:00:00Z", { who: "Ethan C." }),
            row("2026-09-24T15:00:00Z", { title: "Wire it" }),
            row("2026-09-24T14:00:00Z", { title: "Wire it" }),
        ]);
        assert.deepEqual(
            rows.map((r) => r.count),
            [1, 2, 1, 1],
        );
        assert.equal(untitledHeadline(rows[1], "Build"), "Ethan C. finished 2 items");
        assert.equal(new Set(rows.map((r) => r.key)).size, rows.length);
    });

    it("keeps keys of rows already shown when newer ones arrive", () => {
        const older = [
            row("2026-09-24T17:00:00Z", { title: "A" }),
            row("2026-09-24T17:00:00Z", { title: "A" }),
        ];
        const before = feedRows(older).map((r) => r.key);
        const after = feedRows([
            row("2026-09-24T18:00:00Z", { title: "B" }),
            ...older,
        ]).map((r) => r.key);
        assert.deepEqual(after.slice(1), before);
    });
});
