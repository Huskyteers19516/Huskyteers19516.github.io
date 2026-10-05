// Tests for the Workshop page's data handling (src/components/workshop).
// Run with `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    coverOf,
    formatBytes,
    hasStory,
    iterationBadge,
    joinNames,
    stepLabel,
    viewerPhotos,
} from "../src/components/workshop/format.ts";
import {
    parseWorkshop,
    portalResolver,
    safeHttpUrl,
} from "../src/components/workshop/types.ts";

const PORTAL = "https://portal.example.org/";
const resolve = portalResolver(PORTAL);

const photo = (id, over = {}) => ({
    id,
    path: `/api/public/workshop/photos/${id}`,
    width: 1600,
    height: 1200,
    label: "",
    note: "",
    ...over,
});

const project = (over = {}) => ({
    id: "cmount",
    kind: "PART",
    title: "Claw servo mount",
    summary: "Holds the claw servo.",
    material: "PETG",
    season: "2025–26",
    designers: ["Ethan Chen", "Isabella Rossi"],
    featured: false,
    link: "https://cad.onshape.com/documents/abc",
    codeLink: null,
    cover: photo("p3", { label: "Version 3" }),
    photos: [
        photo("p1", { label: "Version 1", note: "Cracked in PLA." }),
        photo("p2", { label: "Version 2" }),
        photo("p3", { label: "Version 3" }),
    ],
    downloads: [
        {
            id: "f1",
            path: "/api/public/workshop/files/f1",
            filename: "mount.stl",
            format: "STL",
            size: 1258291,
            label: "Print-ready STL",
        },
    ],
    publishedAt: "2026-10-04T12:00:00.000Z",
    updatedAt: "2026-10-04T12:00:00.000Z",
    ...over,
});

function parse(projects) {
    const data = parseWorkshop(
        { updatedAt: "2026-10-04T12:00:00.000Z", projects },
        resolve,
    );
    if (!data) throw new Error("expected a payload");
    return data;
}

describe("parseWorkshop", () => {
    it("refuses garbage", () => {
        assert.equal(parseWorkshop("nope", resolve), null);
        assert.equal(parseWorkshop({}, resolve), null);
        assert.equal(parseWorkshop({ projects: "x" }, resolve), null);
        assert.deepEqual(parseWorkshop({ projects: [] }, resolve), {
            updatedAt: null,
            projects: [],
        });
    });

    it("puts the portal's address in front of photo and download paths", () => {
        const [p] = parse([project()]).projects;
        assert.equal(
            p.photos[0].src,
            "https://portal.example.org/api/public/workshop/photos/p1",
        );
        assert.equal(
            p.downloads[0].href,
            "https://portal.example.org/api/public/workshop/files/f1",
        );
        assert.equal(p.cover?.id, "p3");
        assert.deepEqual(p.designers, ["Ethan Chen", "Isabella Rossi"]);
    });

    it("never lets a path point at another site", () => {
        const [p] = parse([
            project({
                photos: [
                    photo("a", { path: "//evil.example/x.png" }),
                    photo("b", { path: "https://evil.example/x.png" }),
                    photo("c"),
                ],
                cover: null,
            }),
        ]).projects;
        assert.deepEqual(
            p.photos.map((x) => x.id),
            ["c"],
        );
    });

    it("keeps only http(s) links", () => {
        assert.equal(safeHttpUrl("javascript:alert(1)"), null);
        assert.equal(safeHttpUrl("data:text/html,hi"), null);
        assert.equal(safeHttpUrl("https://github.com/x"), "https://github.com/x");
        const [p] = parse([project({ link: "javascript:alert(1)", codeLink: "ftp://x" })]).projects;
        assert.equal(p.link, null);
        assert.equal(p.codeLink, null);
    });

    it("keeps two people who share a shortened name", () => {
        const [p] = parse([project({ designers: ["E.C.", "E.C.", "  "] })]).projects;
        assert.deepEqual(p.designers, ["E.C.", "E.C."]);
    });

    it("drops broken and repeated projects, and reads an unknown kind as Other builds", () => {
        const { projects } = parse([
            project(),
            project(), // same id
            { id: "x" }, // no title
            "garbage",
            project({ id: "robot-cart", kind: "ROBOT" }),
        ]);
        assert.deepEqual(
            projects.map((p) => [p.id, p.kind]),
            [
                ["cmount", "PART"],
                ["robot-cart", "OTHER"],
            ],
        );
    });
});

describe("format helpers", () => {
    it("joins names and sizes the way people read them", () => {
        assert.equal(joinNames([]), "");
        assert.equal(joinNames(["A"]), "A");
        assert.equal(joinNames(["A", "B"]), "A and B");
        assert.equal(joinNames(["A", "B", "C"]), "A, B and C");
        assert.equal(formatBytes(812), "812 B");
        assert.equal(formatBytes(1258291), "1.2 MB");
        assert.equal(formatBytes(0), "");
    });

    it("tells the iteration story from the photos", () => {
        const [p] = parse([project()]).projects;
        assert.equal(iterationBadge(p), "Version 1 → Version 3");
        assert.equal(hasStory(p), true);
        assert.equal(stepLabel("PART", { ...p.photos[0], label: "" }, 1), "Version 2");
        assert.equal(stepLabel("SOFTWARE", { ...p.photos[0], label: "" }, 0), "Step 1");

        const [plain] = parse([
            project({ photos: [photo("p1"), photo("p2")], cover: null }),
        ]).projects;
        assert.equal(iterationBadge(plain), "2 versions");
        // No cover picked (the portal always sends one when there are photos): the newest version.
        assert.equal(coverOf(plain)?.id, "p2");

        const [software] = parse([
            project({ kind: "SOFTWARE", photos: [photo("s1"), photo("s2")], cover: null }),
        ]).projects;
        assert.equal(iterationBadge(software), null);
        assert.equal(hasStory(software), false);
    });

    it("always shows the cover in the viewer", () => {
        const [p] = parse([
            project({ photos: [photo("p1")], cover: photo("p9") }),
        ]).projects;
        assert.deepEqual(
            viewerPhotos(p).map((x) => x.id),
            ["p9", "p1"],
        );
    });
});
