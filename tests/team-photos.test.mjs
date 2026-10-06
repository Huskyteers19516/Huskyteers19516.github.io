// Tests for teammates' own photos from the Teammate Portal
// (src/components/team/portal-photos.ts): the GET /api/public/team-photos
// contract, the name keys (src/components/team/name-key.ts — the same
// vectors as the portal's tests/user-photos.test.ts), name matching, which
// photo a card shows, the not-public statuses and the dev demo. Run with
// `npm test`.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { PortalHttpError } from "../src/lib/portal-json.ts";
import {
    sha256Hex,
    TEAM_PHOTO_KEY_LENGTH,
    TEAM_PHOTO_KEY_PREFIX,
    TEAM_PHOTO_KEY_RE,
    teamPhotoKey,
} from "../src/components/team/name-key.ts";
import {
    MAX_TEAM_PHOTOS,
    NO_PHOTOS,
    parseTeamPhotos,
    photoIndex,
    portalPhotoFor,
    shownPhoto,
    TEAM_PHOTO_PREFIX,
    TEAM_PHOTOS_PATH,
    teamPhotosFetcher,
    teamPhotoUrl,
} from "../src/components/team/portal-photos.ts";
import {
    createDemoPhotos,
    demoPhotosPayload,
    demoPortrait,
} from "../src/components/team/demo-photos.ts";

const PORTAL = "https://portal.example.com";
const photo = (id) => `${TEAM_PHOTO_PREFIX}${id}`;
const abs = (id) => `${PORTAL}${TEAM_PHOTO_PREFIX}${id}`;
const key = (name) => teamPhotoKey(name);

describe("name keys (the portal's publicTeamPhotoKey)", () => {
    it("hashes the normalized name like the portal: the same vectors as its tests", () => {
        assert.equal(TEAM_PHOTO_KEY_PREFIX, "huskyteers-team-photo-v1:");
        assert.equal(TEAM_PHOTO_KEY_LENGTH, 32);
        assert.equal(teamPhotoKey("Maya Patel"), "26ec013ef85a6d422b9cb8158191cf83");
        assert.equal(teamPhotoKey("José  O’Neil"), "5cfa8a3f05f9afcbcb2e7ca5e7cde4fa");
        assert.equal(teamPhotoKey("Ethan Chen"), "83c8ddfd98973272348688899a8133fc");
        assert.equal(teamPhotoKey("  ZOE   park "), "430c9a24c998fe3de046a33d44b957b5");
        assert.equal(teamPhotoKey("张伟"), "f9e2cbbc79ddcb7cff0a5b670c253a20");
        assert.equal(teamPhotoKey("   "), null);
        assert.equal(teamPhotoKey("jose o'neil"), teamPhotoKey("José  O’Neil"));
        assert.match(teamPhotoKey("Tommy Ho"), TEAM_PHOTO_KEY_RE);
    });

    it("computes SHA-256 exactly like node:crypto (block edges, multi-byte UTF-8)", () => {
        const samples = ["", "abc", "x".repeat(55), "x".repeat(56), "x".repeat(64), "y".repeat(1000), "José O’Neil 张伟 🤖"];
        for (let i = 0; i < 150; i++) {
            samples.push(Array.from({ length: i }, (_, k) => String.fromCharCode(32 + ((k * 7 + i) % 900))).join(""));
        }
        for (const s of samples) {
            assert.equal(sha256Hex(s), createHash("sha256").update(s, "utf8").digest("hex"), JSON.stringify(s).slice(0, 30));
        }
        assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    });
});

describe("teamPhotoUrl", () => {
    it("accepts the portal's photo route with one plain id, relative or absolute", () => {
        assert.equal(TEAM_PHOTOS_PATH, "/api/public/team-photos");
        assert.equal(teamPhotoUrl(photo("cm1abc_DEF-9"), PORTAL), abs("cm1abc_DEF-9"));
        assert.equal(teamPhotoUrl(abs("x1"), PORTAL), abs("x1"));
        // A portal URL with a trailing slash or a path is just the origin.
        assert.equal(teamPhotoUrl(photo("x1"), `${PORTAL}/`), abs("x1"));
    });

    it("refuses other hosts, paths, query strings, fragments and odd ids", () => {
        for (const bad of [
            "https://evil.example.com/api/public/team-photos/x1",
            "//evil.example.com/api/public/team-photos/x1",
            "http://portal.example.com/api/public/team-photos/x1", // other scheme = other origin
            "https://user:pw@portal.example.com/api/public/team-photos/x1",
            "/api/public/sponsors/logos/x1",
            "/api/public/team-photos/",
            "/api/public/team-photos/x1/more",
            "/api/public/team-photos/x1?download=1",
            "/api/public/team-photos/x1#frag",
            "/api/public/team-photos/..%2Fsecret",
            "/api/public/team-photos/a.b",
            `/api/public/team-photos/${"a".repeat(65)}`,
            "/api/public/team-photos/../progress",
            "javascript:alert(1)",
            "data:image/png;base64,AAAA",
            "",
            42,
            null,
            undefined,
            { url: photo("x1") },
        ]) {
            assert.equal(teamPhotoUrl(bad, PORTAL), null, String(bad));
        }
        assert.equal(teamPhotoUrl(photo("x1"), "not a url"), null);
    });
});

describe("parseTeamPhotos", () => {
    const payload = (photos, over = {}) => ({
        enabled: true,
        updatedAt: "2026-10-05T07:00:00.000Z",
        photos,
        ...over,
    });

    it("keeps each entry's key and an absolute photo URL, nothing else", () => {
        const parsed = parseTeamPhotos(
            payload([
                {
                    key: key("Tommy Ho"),
                    photo: photo("p1"),
                    name: "Tommy Ho",
                    email: "tommy@example.com",
                    id: "user_1",
                    role: "CAPTAIN",
                },
                { key: key("Ethan Zhang"), photo: abs("p2") },
            ]),
            PORTAL,
        );
        assert.deepEqual(parsed, {
            enabled: true,
            updatedAt: "2026-10-05T07:00:00.000Z",
            photos: [
                { key: key("Tommy Ho"), src: abs("p1") },
                { key: key("Ethan Zhang"), src: abs("p2") },
            ],
        });
    });

    it("answers { enabled: false } when the owner turned photos off", () => {
        assert.deepEqual(parseTeamPhotos({ enabled: false }, PORTAL), { enabled: false });
        assert.deepEqual(
            parseTeamPhotos({ enabled: false, photos: [{ key: key("A B"), photo: photo("p") }] }, PORTAL),
            { enabled: false },
        );
    });

    it("refuses a payload of the wrong shape", () => {
        for (const bad of [
            null,
            [],
            "x",
            {},
            { enabled: "yes", photos: [] },
            { enabled: true },
            { enabled: true, photos: {} },
        ]) {
            assert.equal(parseTeamPhotos(bad, PORTAL), null, JSON.stringify(bad));
        }
    });

    it("drops entries without a proper key or with a photo that isn't on the portal's photo route", () => {
        const parsed = parseTeamPhotos(
            payload([
                null,
                "Tommy Ho",
                { key: "", photo: photo("p1") },
                { name: "Tommy Ho", photo: photo("p1") }, // a name instead of a key
                { key: key("Tommy Ho").toUpperCase(), photo: photo("p1") },
                { key: key("Tommy Ho").slice(1), photo: photo("p1") },
                { key: key("Tommy Ho") + "0", photo: photo("p1") },
                { key: 42, photo: photo("p1") },
                { key: key("No Photo") },
                { key: key("Elsewhere"), photo: "https://cdn.example.com/a.jpg" },
                { key: key("Query"), photo: `${photo("p2")}?t=1` },
                { key: key("Ok Person"), photo: photo("p3") },
            ]),
            PORTAL,
        );
        assert.deepEqual(parsed.photos, [{ key: key("Ok Person"), src: abs("p3") }]);
    });

    it("caps the list and fills in a missing timestamp", () => {
        const many = Array.from({ length: MAX_TEAM_PHOTOS + 50 }, (_, i) => ({
            key: key(`Person ${i}`),
            photo: photo(`p${i}`),
        }));
        const parsed = parseTeamPhotos(payload(many, { updatedAt: "nope" }), PORTAL);
        assert.equal(parsed.photos.length, MAX_TEAM_PHOTOS);
        assert.ok(!Number.isNaN(Date.parse(parsed.updatedAt)));
        assert.deepEqual(parseTeamPhotos(payload([]), PORTAL).photos, []);
    });
});

describe("matching photos by name", () => {
    // Keys of the portal's names (the portal hashes them; the site hashes its own names the same way).
    const photos = [
        { key: key("José  O’Neil"), src: abs("p1") },
        { key: key("Tommy Ho"), src: abs("p2") },
        { key: key("Sam Lee"), src: abs("p3") },
        { key: key("sam  lee"), src: abs("p4") },
    ];

    it("matches full names ignoring case, spacing, accents and apostrophe style", () => {
        const index = photoIndex(photos);
        assert.equal(portalPhotoFor(index, "Jose O'Neil"), abs("p1"));
        assert.equal(portalPhotoFor(index, "TOMMY  HO"), abs("p2"));
        assert.equal(portalPhotoFor(index, "Tommy"), null);
        assert.equal(portalPhotoFor(index, "T.H."), null);
        assert.equal(portalPhotoFor(index, "Tommy H."), null);
        assert.equal(portalPhotoFor(NO_PHOTOS, "Tommy Ho"), null);
    });

    it("gives a name two portal people share to neither (never someone else's photo)", () => {
        const index = photoIndex(photos);
        assert.equal(portalPhotoFor(index, "Sam Lee"), null);
        assert.equal(index.size, 2);
    });

    it("maps each URL through `resolve` (the dev demo)", () => {
        const index = photoIndex(photos.slice(1, 2), (src) => `demo:${src}`);
        assert.equal(portalPhotoFor(index, "Tommy Ho"), `demo:${abs("p2")}`);
    });
});

describe("which photo a person shows", () => {
    it("explicit image > portal photo > folder photo > initials", () => {
        const portal = abs("p1");
        assert.equal(shownPhoto("image", portal), "image");
        assert.equal(shownPhoto("image", null), "image");
        assert.equal(shownPhoto("folder", portal), "portal");
        assert.equal(shownPhoto(null, portal), "portal");
        assert.equal(shownPhoto("folder", null), "folder");
        assert.equal(shownPhoto(null, null), "initials");
    });
});

describe("teamPhotosFetcher (a portal without photos means off)", () => {
    const signal = new AbortController().signal;
    const throwing = (e) => async () => {
        throw e;
    };

    it("passes answers through", async () => {
        const body = { enabled: true, photos: [] };
        assert.equal(await teamPhotosFetcher(async () => body)(signal), body);
    });

    it("turns 401 / 403 / 404 / 410 into { enabled: false }", async () => {
        for (const status of [401, 403, 404, 410]) {
            assert.deepEqual(
                await teamPhotosFetcher(throwing(new PortalHttpError(status)))(signal),
                { enabled: false },
                String(status),
            );
        }
    });

    it("still throws outages (retried with backoff)", async () => {
        await assert.rejects(
            teamPhotosFetcher(throwing(new PortalHttpError(503)))(signal),
            PortalHttpError,
        );
        await assert.rejects(
            teamPhotosFetcher(throwing(new TypeError("Failed to fetch")))(signal),
            TypeError,
        );
    });
});

describe("dev demo photos (?demo=1)", () => {
    const names = ["Tommy Ho", "Ethan Zhang", "Gwen Lengsfeld", "Jack Luo", "Grant Story", "Avery Lin"];
    const signal = new AbortController().signal;

    it("matches the contract: some people without a photo, one that fails to load", async () => {
        const raw = demoPhotosPayload(names);
        const parsed = parseTeamPhotos(raw, PORTAL);
        assert.ok(parsed && parsed.enabled);
        assert.equal(parsed.photos.length, raw.photos.length);
        assert.ok(parsed.photos.length < names.length);
        const { photoSrc } = createDemoPhotos("1", names);
        const index = photoIndex(parsed.photos, photoSrc);
        assert.equal(portalPhotoFor(index, "Ethan Zhang"), null); // no photo
        assert.match(portalPhotoFor(index, "Tommy Ho"), /^data:image\/svg\+xml/);
        assert.equal(
            portalPhotoFor(index, "Gwen Lengsfeld"),
            "data:image/png;base64,broken",
        );
        assert.match(demoPortrait(3), /^data:image\/svg\+xml;utf8,/);
    });

    it("answers like the portal in each mode", async () => {
        const off = await createDemoPhotos("nophotos", names).fetcher(signal);
        assert.deepEqual(parseTeamPhotos(off, PORTAL), { enabled: false });
        await assert.rejects(createDemoPhotos("photoerror", names).fetcher(signal), PortalHttpError);
        const on = await createDemoPhotos("private", names).fetcher(signal);
        assert.ok(parseTeamPhotos(on, PORTAL).enabled);
    });
});
