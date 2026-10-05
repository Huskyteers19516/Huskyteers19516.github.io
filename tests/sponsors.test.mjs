// Tests for the sponsor band's data handling (src/components/sponsors) and
// the shared payload validators (src/lib/portal-json.ts). Run with
// `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { day, httpUrl, text } from "../src/lib/portal-json.ts";
import {
    formatYears,
    logoUrl,
    MAX_SPONSORS,
    monogram,
    parseSponsors,
    sponsorHomeUrl,
    spokenYears,
} from "../src/components/sponsors/types.ts";

const PORTAL = "https://portal.example.com";

const sponsor = (over = {}) => ({
    name: "Copperline Supply",
    url: "https://copperline.example.com",
    years: [2025, 2026],
    logo: "/api/public/sponsors/logos/clx9abc_DEF-1",
    ...over,
});

/** @returns {import("../src/components/sponsors/types.ts").SponsorsEnabled} */
function parse(sponsors) {
    const p = parseSponsors(
        { enabled: true, updatedAt: "2026-10-04T12:00:00.000Z", sponsors },
        PORTAL,
    );
    if (!p || !p.enabled) throw new Error("expected an enabled payload");
    return p;
}

describe("portal-json", () => {
    it("httpUrl keeps http(s) links and refuses everything else", () => {
        assert.equal(httpUrl("https://a.example.com/x?y=1"), "https://a.example.com/x?y=1");
        assert.equal(httpUrl("http://a.example.com"), "http://a.example.com/");
        assert.equal(httpUrl("example.com/team"), "https://example.com/team");
        assert.equal(httpUrl("javascript:alert(1)"), null);
        assert.equal(httpUrl("data:text/html,hi"), null);
        assert.equal(httpUrl("mailto:a@example.com"), null);
        assert.equal(httpUrl("https://user:pw@example.com"), null);
        assert.equal(httpUrl("https://exa mple.com"), null);
        assert.equal(httpUrl("//evil.example.com"), null);
        assert.equal(httpUrl(""), null);
        assert.equal(httpUrl(42), null);
    });

    it("day accepts real calendar days only", () => {
        assert.equal(day("2026-10-04"), "2026-10-04");
        assert.equal(day("2026-02-30"), null);
        assert.equal(day("2026-1-4"), null);
        assert.equal(day(null), null);
    });

    it("text trims, collapses spaces and cuts", () => {
        assert.equal(text("  Lumen   Labs \n"), "Lumen Labs");
        assert.equal(text("   "), null);
        assert.equal(text("abcdef", 3), "abc");
    });
});

describe("logoUrl", () => {
    it("resolves the portal's logo route against the portal", () => {
        assert.equal(
            logoUrl("/api/public/sponsors/logos/abc123", PORTAL),
            `${PORTAL}/api/public/sponsors/logos/abc123`,
        );
        assert.equal(
            logoUrl(`${PORTAL}/api/public/sponsors/logos/abc123`, `${PORTAL}/`),
            `${PORTAL}/api/public/sponsors/logos/abc123`,
        );
    });

    it("refuses other hosts, paths, ids and query strings", () => {
        for (const bad of [
            "https://evil.example.com/api/public/sponsors/logos/abc",
            "//evil.example.com/api/public/sponsors/logos/abc",
            "/api/public/progress",
            "/api/public/sponsors/logos/",
            "/api/public/sponsors/logos/a/b",
            "/api/public/sponsors/logos/a%2Fb",
            "/api/public/sponsors/logos/../files/x",
            "/api/public/sponsors/logos/abc?x=1",
            "/api/public/sponsors/logos/" + "a".repeat(65),
            "javascript:alert(1)",
            null,
        ]) {
            assert.equal(logoUrl(bad, PORTAL), null, String(bad));
        }
    });
});

describe("parseSponsors", () => {
    it("reads the off switch and refuses garbage", () => {
        assert.deepEqual(parseSponsors({ enabled: false }, PORTAL), {
            enabled: false,
        });
        assert.equal(parseSponsors("nope", PORTAL), null);
        assert.equal(parseSponsors({ enabled: true }, PORTAL), null);
        assert.equal(parseSponsors(null, PORTAL), null);
    });

    it("keeps the public fields and resolves the logo", () => {
        const [s] = parse([sponsor({ amount: 5000, contact: "x@y.z" })]).sponsors;
        assert.deepEqual(s, {
            key: "copperline supply",
            name: "Copperline Supply",
            url: "https://copperline.example.com/",
            years: [2025, 2026],
            logo: `${PORTAL}/api/public/sponsors/logos/clx9abc_DEF-1`,
        });
    });

    it("cleans years: integers in range, unique, ascending", () => {
        const [s] = parse([
            sponsor({ years: [2026, 2024, 2026, "2025", 2025.5, 1890, 2024] }),
        ]).sponsors;
        assert.deepEqual(s.years, [2024, 2026]);
        assert.deepEqual(parse([sponsor({ years: "2026" })]).sponsors[0].years, []);
    });

    it("drops nameless entries and unsafe links", () => {
        const p = parse([
            sponsor({ name: "  " }),
            "junk",
            sponsor({ name: "Lumen Labs", url: "javascript:alert(1)", logo: "https://evil.example.com/x.png" }),
        ]);
        assert.equal(p.sponsors.length, 1);
        assert.equal(p.sponsors[0].url, null);
        assert.equal(p.sponsors[0].logo, null);
    });

    it("merges the same name (case and spaces) and sorts by latest year, then name", () => {
        const p = parse([
            sponsor({ name: "Zeta Corp", years: [2025], logo: null }),
            sponsor({ name: "alpha  co", years: [2022], url: null, logo: null }),
            sponsor({ name: "Alpha Co", years: [2025] }),
            sponsor({ name: "Beta LLC", years: [2026] }),
            sponsor({ name: "Gamma", years: [] }),
        ]);
        assert.deepEqual(
            p.sponsors.map((s) => [s.name, s.years]),
            [
                ["Beta LLC", [2026]],
                ["alpha  co".replace(/\s+/g, " "), [2022, 2025]],
                ["Zeta Corp", [2025]],
                ["Gamma", []],
            ],
        );
        const alpha = p.sponsors[1];
        assert.equal(alpha.url, "https://copperline.example.com/");
        assert.ok(alpha.logo);
    });

    it("links only to a sponsor's homepage, never a path, query or #fragment", () => {
        const [s] = parse([
            sponsor({
                url: "https://grants.example.com/portal/application/88213?invite=Zx9-secret&token=T#draft",
            }),
        ]).sponsors;
        assert.equal(s.url, "https://grants.example.com/");
        assert.equal(sponsorHomeUrl("http://Shop.Example.org:8080/a?b=c"), "http://shop.example.org:8080/");
        assert.equal(sponsorHomeUrl("rev.example.com/apply?id=1"), "https://rev.example.com/");
        for (const bad of ["javascript:alert(1)", "https://u:p@x.example/", "", null, 42]) {
            assert.equal(sponsorHomeUrl(bad), null);
        }
    });

    it("caps the list", () => {
        const many = Array.from({ length: MAX_SPONSORS + 40 }, (_, i) =>
            sponsor({ name: `Sponsor ${i}` }),
        );
        assert.equal(parse(many).sponsors.length, MAX_SPONSORS);
    });
});

describe("year labels", () => {
    it("formats years, collapsing runs of three or more", () => {
        assert.equal(formatYears([]), "");
        assert.equal(formatYears([2026]), "2026");
        assert.equal(formatYears([2025, 2026]), "2025 · 2026");
        assert.equal(formatYears([2023, 2024, 2025, 2026]), "2023–2026");
        assert.equal(
            formatYears([2019, 2021, 2022, 2023, 2025, 2026]),
            "2019 · 2021–2023 · 2025 · 2026",
        );
    });

    it("reads well to screen readers", () => {
        assert.equal(spokenYears([2026]), "2026");
        assert.equal(spokenYears([2025, 2026]), "2025 and 2026");
        assert.equal(
            spokenYears([2021, 2022, 2023, 2026]),
            "2021 to 2023 and 2026",
        );
    });

    it("makes a monogram for sponsors without a logo", () => {
        assert.equal(monogram("Maple & Main Bakery"), "MM");
        assert.equal(monogram("The Rotary Club of Anaheim"), "RC");
        assert.equal(monogram("Lumen"), "LU");
        assert.equal(monogram("!!!"), "!");
    });
});
