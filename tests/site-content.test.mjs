// Tests for "Website Coding" (src/lib/site-content.ts): slot keys, the
// portal's site-content payload, link safety and image addresses.
// Run with `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    MAX_ALT_LENGTH,
    MAX_KEY_LENGTH,
    MAX_LINK_LENGTH,
    MAX_TEXT_LENGTH,
    isSlotKey,
    normalizeText,
    parseSiteContent,
    portalBase,
    portalOrigin,
    safeLink,
    siteContentUrl,
    siteImageUrl,
    withEditParam,
} from "../src/lib/site-content.ts";

const BASE = "https://portal.example";

describe("isSlotKey", () => {
    it("accepts the documented key style", () => {
        for (const key of [
            "home.hero.tagline",
            "season.2025-2026.team-photo",
            "events.dogbot-1.description",
            "footer.email",
            "404.message",
            "a",
        ]) {
            assert.equal(isSlotKey(key), true, key);
        }
    });

    it("rejects anything else", () => {
        for (const key of [
            "",
            "Home.hero",
            "home..hero",
            "home.",
            ".home",
            "-home",
            "home--hero",
            "home.-hero",
            "home_hero",
            "home hero",
            "home/hero",
            "hôme",
            "__proto__",
            "a".repeat(MAX_KEY_LENGTH + 1),
            42,
            null,
            undefined,
        ]) {
            assert.equal(isSlotKey(key), false, String(key));
        }
        assert.equal(isSlotKey("a".repeat(MAX_KEY_LENGTH)), true);
    });
});

describe("safeLink", () => {
    it("keeps http(s), mailto and site paths", () => {
        assert.equal(safeLink("https://example.com/a?b=1#c"), "https://example.com/a?b=1#c");
        assert.equal(safeLink("http://example.com"), "http://example.com/");
        assert.equal(safeLink("  https://example.com/x  "), "https://example.com/x");
        assert.equal(safeLink("mailto:team@example.com"), "mailto:team@example.com");
        assert.equal(
            safeLink("mailto:team@example.com?subject=Hi"),
            "mailto:team@example.com?subject=Hi",
        );
        assert.equal(safeLink("/events"), "/events");
        assert.equal(safeLink("/about/team#leadership"), "/about/team#leadership");
        assert.equal(safeLink("/"), "/");
    });

    it("refuses script and data URLs in any spelling", () => {
        for (const bad of [
            "javascript:alert(1)",
            "JavaScript:alert(1)",
            " javascript:alert(1)",
            "java\tscript:alert(1)",
            "java\nscript:alert(1)",
            "javascript&colon;alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "vbscript:msgbox(1)",
            "file:///etc/passwd",
            "blob:https://example.com/x",
        ]) {
            assert.equal(safeLink(bad), null, bad);
        }
    });

    it("refuses protocol-relative, relative and odd links", () => {
        for (const bad of [
            "//evil.example/x",
            "/\\evil.example",
            "\\\\evil.example",
            "events",
            "./events",
            "../x",
            "example.com",
            "https:example.com",
            "https://user:pw@example.com/",
            "https://",
            "https://exa mple.com",
            "mailto:",
            "mailto://x",
            "",
            "   ",
            null,
            42,
            { href: "https://example.com" },
        ]) {
            assert.equal(safeLink(bad), null, String(bad));
        }
    });

    it("refuses links over the limit", () => {
        const long = `https://example.com/${"a".repeat(MAX_LINK_LENGTH)}`;
        assert.equal(safeLink(long), null);
    });
});

describe("portal base and origin", () => {
    it("trims trailing slashes and finds the origin", () => {
        assert.equal(portalBase("https://portal.example/"), "https://portal.example");
        assert.equal(portalBase("https://portal.example/sub//"), "https://portal.example/sub");
        assert.equal(portalOrigin("https://portal.example/sub/"), "https://portal.example");
        assert.equal(portalBase("javascript:alert(1)"), null);
        assert.equal(portalBase("not a url"), null);
        assert.equal(portalOrigin(undefined), null);
    });

    it("builds the feed URL with a 60 s bucket", () => {
        assert.equal(
            siteContentUrl(BASE, 120_000),
            "https://portal.example/api/public/site-content?t=2",
        );
        assert.equal(siteContentUrl(BASE, 179_999), siteContentUrl(BASE, 120_000));
    });
});

describe("siteImageUrl", () => {
    it("prefixes the portal to the relative site-images path", () => {
        assert.equal(
            siteImageUrl("/api/public/site-images/abc_DEF-123", BASE),
            "https://portal.example/api/public/site-images/abc_DEF-123",
        );
    });

    it("refuses any other src from the feed", () => {
        for (const bad of [
            "https://portal.example/api/public/site-images/abc",
            "https://evil.example/api/public/site-images/abc",
            "//evil.example/api/public/site-images/abc",
            "/api/public/site-images/",
            "/api/public/site-images/abc/def",
            "/api/public/site-images/../secrets",
            "/api/public/site-images/abc?x=1",
            "/api/public/site-images/abc.png",
            `/api/public/site-images/${"a".repeat(65)}`,
            "/api/public/team-photos/abc",
            "javascript:alert(1)",
            "data:image/png;base64,AAAA",
            "",
            null,
        ]) {
            assert.equal(siteImageUrl(bad, BASE), null, String(bad));
        }
    });

    it("lets the editor preview use absolute URLs on the portal only", () => {
        const opts = { allowAbsolute: true };
        assert.equal(
            siteImageUrl("https://portal.example/api/public/site-images/abc", BASE, opts),
            "https://portal.example/api/public/site-images/abc",
        );
        assert.equal(
            siteImageUrl("https://portal.example/api/public/site-images/abc?v=2", BASE, opts),
            "https://portal.example/api/public/site-images/abc?v=2",
        );
        for (const bad of [
            "https://evil.example/api/public/site-images/abc",
            "http://portal.example/api/public/site-images/abc",
            "https://portal.example:444/api/public/site-images/abc",
            "https://portal.example/api/public/other/abc",
            "https://u:p@portal.example/api/public/site-images/abc",
            "https://portal.example/api/public/site-images/abc#x",
            "blob:https://portal.example/123",
            "data:image/png;base64,AAAA",
        ]) {
            assert.equal(siteImageUrl(bad, BASE, opts), null, bad);
        }
    });
});

describe("parseSiteContent", () => {
    const feed = () => ({
        enabled: true,
        updatedAt: "2026-10-06T12:00:00.000Z",
        texts: { "home.hero.tagline": "Hi, we're\nthe Huskyteers" },
        links: { "footer.email.link": "mailto:team@example.com" },
        images: {
            "season.2025-2026.team-photo": {
                src: "/api/public/site-images/img1",
                alt: "Team at league meet",
                width: 1600,
                height: 900,
            },
        },
    });

    it("keeps a well-formed feed", () => {
        assert.deepEqual(parseSiteContent(feed(), BASE), {
            texts: { "home.hero.tagline": "Hi, we're\nthe Huskyteers" },
            links: { "footer.email.link": "mailto:team@example.com" },
            images: {
                "season.2025-2026.team-photo": {
                    src: "https://portal.example/api/public/site-images/img1",
                    alt: "Team at league meet",
                    width: 1600,
                    height: 900,
                },
            },
        });
    });

    it("returns null for no feed or a disabled one", () => {
        assert.equal(parseSiteContent(null, BASE), null);
        assert.equal(parseSiteContent([], BASE), null);
        assert.equal(parseSiteContent("{}", BASE), null);
        assert.equal(parseSiteContent({ enabled: false }, BASE), null);
        assert.equal(parseSiteContent({ ...feed(), enabled: "true" }, BASE), null);
        assert.equal(parseSiteContent({ texts: {} }, BASE), null);
    });

    it("accepts a preview without `enabled` when asked", () => {
        const { enabled, ...preview } = feed();
        assert.equal(enabled, true);
        assert.ok(parseSiteContent(preview, BASE, { requireEnabled: false }));
    });

    it("tolerates missing or malformed sections", () => {
        assert.deepEqual(
            parseSiteContent({ enabled: true, texts: [], links: "x" }, BASE),
            { texts: {}, links: {}, images: {} },
        );
    });

    it("drops bad keys and oversize or non-string texts", () => {
        const out = parseSiteContent(
            {
                enabled: true,
                texts: {
                    "ok.key": "fine",
                    "empty.ok": "",
                    "Bad Key": "x",
                    "too.long": "x".repeat(MAX_TEXT_LENGTH + 1),
                    "at.limit": "x".repeat(MAX_TEXT_LENGTH),
                    "not.string": 5,
                    "html.stays.text": "<b>bold</b>",
                },
            },
            BASE,
        );
        assert.deepEqual(Object.keys(out.texts).sort(), [
            "at.limit",
            "empty.ok",
            "html.stays.text",
            "ok.key",
        ]);
        // Texts are applied with textContent, never parsed as HTML.
        assert.equal(out.texts["html.stays.text"], "<b>bold</b>");
    });

    it("drops unsafe links", () => {
        const out = parseSiteContent(
            {
                enabled: true,
                links: {
                    "a.ok": "https://example.com",
                    "b.js": "javascript:alert(1)",
                    "c.data": "data:text/html,hi",
                    "d.proto": "//evil.example",
                    "e.path": "/events",
                    "f.long": `https://example.com/${"a".repeat(MAX_LINK_LENGTH)}`,
                    "g.num": 1,
                },
            },
            BASE,
        );
        assert.deepEqual(out.links, {
            "a.ok": "https://example.com/",
            "e.path": "/events",
        });
    });

    it("drops images with a bad src, alt or shape", () => {
        const img = (extra) => ({ src: "/api/public/site-images/ok", alt: "x", ...extra });
        const out = parseSiteContent(
            {
                enabled: true,
                images: {
                    "a.ok": img({}),
                    "b.no-alt": { src: "/api/public/site-images/ok2" },
                    "c.abs": img({ src: "https://portal.example/api/public/site-images/ok" }),
                    "d.evil": img({ src: "https://evil.example/x.png" }),
                    "e.js": img({ src: "javascript:alert(1)" }),
                    "f.alt-long": img({ alt: "a".repeat(MAX_ALT_LENGTH + 1) }),
                    "g.alt-num": img({ alt: 5 }),
                    "h.string": "/api/public/site-images/ok",
                    "i.dims": img({ width: -1, height: 1.5 }),
                },
            },
            BASE,
        );
        assert.deepEqual(Object.keys(out.images).sort(), ["a.ok", "b.no-alt", "i.dims"]);
        assert.equal(out.images["b.no-alt"].alt, "");
        assert.equal(out.images["i.dims"].width, undefined);
        assert.equal(out.images["i.dims"].height, undefined);
    });

    it("allows absolute portal image URLs only for previews", () => {
        const preview = {
            images: {
                "a.abs": {
                    src: "https://portal.example/api/public/site-images/x",
                    alt: "",
                },
            },
        };
        const out = parseSiteContent(preview, BASE, {
            allowAbsolute: true,
            requireEnabled: false,
        });
        assert.equal(out.images["a.abs"].src, "https://portal.example/api/public/site-images/x");
    });

    it("ignores prototype tricks", () => {
        const payload = JSON.parse(
            '{"enabled":true,"texts":{"__proto__":"x","constructor":"y","ok":"z"}}',
        );
        const out = parseSiteContent(payload, BASE);
        assert.deepEqual(Object.keys(out.texts).sort(), ["constructor", "ok"]);
        assert.equal(Object.getPrototypeOf(out.texts), Object.prototype);
    });
});

describe("helpers", () => {
    it("normalizes source formatting whitespace", () => {
        assert.equal(normalizeText("\n    Hi, we're\n    19516  "), "Hi, we're 19516");
    });

    it("adds hk-edit=1 to links", () => {
        assert.equal(
            withEditParam("/events?x=1#top", "https://site.example/"),
            "https://site.example/events?x=1&hk-edit=1#top",
        );
        assert.equal(
            withEditParam("https://site.example/?hk-edit=0", "https://site.example/"),
            "https://site.example/?hk-edit=1",
        );
    });
});

describe("own", () => {
    it("never returns inherited properties", async () => {
        const { own } = await import("../src/lib/site-content.ts");
        assert.equal(own({}, "constructor"), undefined);
        assert.equal(own({}, "toString"), undefined);
        assert.equal(own({ a: "x" }, "a"), "x");
        assert.equal(own(undefined, "a"), undefined);
    });
});
