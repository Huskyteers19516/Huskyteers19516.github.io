// Tests for the Events page's data handling (src/components/events).
// Run with `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    countdown,
    dayOfEvent,
    eventWindow,
    formatClock,
    longDateLabel,
    monthHeading,
    relativeLabel,
    spokenCountdown,
    splitSchedule,
    timeLabel,
    todayIn,
    zonedTime,
} from "../src/components/events/time.ts";
import {
    DEFAULT_TIMEZONE,
    MAX_EVENTS,
    parseEvents,
} from "../src/components/events/types.ts";

const TZ = "America/Los_Angeles";
const iso = (t) => new Date(t).toISOString();

const ev = (over = {}) => ({
    id: "cmeet2",
    title: "League Meet 2",
    kind: "MEET",
    kindLabel: "League meet",
    startsOn: "2026-10-10",
    endsOn: null,
    startTime: "08:30",
    endTime: "16:30",
    location: "Mesa Verde Convention Hall",
    link: "https://example.org/meet-2",
    ...over,
});

/** @returns {import("../src/components/events/types.ts").EventsEnabled} */
function parse(events, over = {}) {
    const p = parseEvents({
        enabled: true,
        updatedAt: "2026-10-04T12:00:00.000Z",
        timezone: TZ,
        events,
        ...over,
    });
    if (!p || !p.enabled) throw new Error("expected an enabled payload");
    return p;
}

describe("parseEvents", () => {
    it("reads the off switch and refuses garbage", () => {
        assert.deepEqual(parseEvents({ enabled: false }), { enabled: false });
        assert.equal(parseEvents("nope"), null);
        assert.equal(parseEvents({ enabled: true }), null);
    });

    it("keeps only the public fields", () => {
        const [e] = parse([
            ev({ notes: "Bring the spare battery", createdBy: "x", sourceKey: "k" }),
        ]).events;
        assert.deepEqual(Object.keys(e).sort(), [
            "endTime",
            "endsOn",
            "id",
            "kind",
            "kindLabel",
            "link",
            "location",
            "startTime",
            "startsOn",
            "title",
        ]);
        assert.equal(e.link, "https://example.org/meet-2");
    });

    it("never shows kinds that aren't public, even if sent", () => {
        const p = parse([
            ev({ id: "a", kind: "MEETING" }),
            ev({ id: "b", kind: "TEAM" }),
            ev({ id: "c", kind: "DEADLINE" }),
            ev({ id: "d", kind: "OTHER" }),
            ev({ id: "e", kind: "OUTREACH", kindLabel: undefined }),
            ev({ id: "f", kind: "ILT" }),
        ]);
        assert.deepEqual(
            p.events.map((e) => [e.id, e.kind]),
            [
                ["e", "OUTREACH"],
                ["f", "ILT"],
            ],
        );
        assert.equal(p.events.find((e) => e.id === "e").kindLabel, "Outreach");
    });

    it("cleans dates, times and links", () => {
        const p = parse([
            ev({ id: "bad-day", startsOn: "2026-02-30" }),
            ev({ id: "no-title", title: " " }),
            ev({ id: "ends-before", endsOn: "2026-10-09" }),
            ev({ id: "ends-same", endsOn: "2026-10-10" }),
            ev({ id: "bad-times", startTime: "25:00", endTime: "10:00" }),
            ev({ id: "end-first", startTime: "10:00", endTime: "09:00" }),
            ev({ id: "js", link: "javascript:alert(1)" }),
        ]);
        const byId = new Map(p.events.map((e) => [e.id, e]));
        assert.ok(!byId.has("bad-day"));
        assert.ok(!byId.has("no-title"));
        assert.equal(byId.get("ends-before").endsOn, null);
        assert.equal(byId.get("ends-same").endsOn, null);
        assert.equal(byId.get("bad-times").startTime, null);
        assert.equal(byId.get("bad-times").endTime, null);
        assert.equal(byId.get("end-first").endTime, null);
        assert.equal(byId.get("js").link, null);
    });

    it("sorts by day, all-day first, then time; drops duplicate ids; caps", () => {
        const p = parse([
            ev({ id: "late", startsOn: "2026-10-11" }),
            ev({ id: "timed", startTime: "09:00" }),
            ev({ id: "allday", startTime: null, endTime: null }),
            ev({ id: "timed", title: "Duplicate" }),
        ]);
        assert.deepEqual(
            p.events.map((e) => e.id),
            ["allday", "timed", "late"],
        );
        const many = Array.from({ length: MAX_EVENTS + 20 }, (_, i) =>
            ev({ id: `e${i}` }),
        );
        assert.equal(parse(many).events.length, MAX_EVENTS);
    });

    it("falls back to the team timezone when the payload's is unknown", () => {
        assert.equal(parse([], { timezone: "Mars/Olympus" }).timezone, DEFAULT_TIMEZONE);
        assert.equal(parse([], { timezone: "Europe/Berlin" }).timezone, "Europe/Berlin");
    });
});

describe("zonedTime", () => {
    it("converts team wall time to the instant, DST-aware", () => {
        assert.equal(iso(zonedTime("2026-10-18", "09:00", TZ)), "2026-10-18T16:00:00.000Z");
        assert.equal(iso(zonedTime("2026-12-18", "09:00", TZ)), "2026-12-18T17:00:00.000Z");
        assert.equal(iso(zonedTime("2026-10-18", null, TZ)), "2026-10-18T07:00:00.000Z");
        assert.equal(iso(zonedTime("2026-10-18", "09:00", "Asia/Kolkata")), "2026-10-18T03:30:00.000Z");
    });

    it("picks the first of a repeated time and skips a missing one", () => {
        // 1:30 AM happens twice on Nov 1 2026 (PDT, then PST).
        assert.equal(iso(zonedTime("2026-11-01", "01:30", TZ)), "2026-11-01T08:30:00.000Z");
        // 2:30 AM doesn't exist on Mar 14 2027: lands on 3:30 PDT.
        assert.equal(iso(zonedTime("2027-03-14", "02:30", TZ)), "2027-03-14T10:30:00.000Z");
    });

    it("knows the team's today", () => {
        assert.equal(todayIn(Date.parse("2026-10-04T06:59:00Z"), TZ), "2026-10-03");
        assert.equal(todayIn(Date.parse("2026-10-04T07:00:00Z"), TZ), "2026-10-04");
    });
});

describe("schedule", () => {
    const [meet] = parse([ev()]).events;

    it("computes the event window", () => {
        const w = eventWindow(meet, TZ);
        assert.equal(iso(w.start), "2026-10-10T15:30:00.000Z");
        assert.equal(iso(w.end), "2026-10-10T23:30:00.000Z");
        const [allDay] = parse([
            ev({ startTime: null, endTime: null, endsOn: "2026-10-11" }),
        ]).events;
        const w2 = eventWindow(allDay, TZ);
        assert.equal(iso(w2.start), "2026-10-10T07:00:00.000Z");
        assert.equal(iso(w2.end), "2026-10-12T07:00:00.000Z");
        const [open] = parse([ev({ endTime: null })]).events;
        assert.equal(iso(eventWindow(open, TZ).end), "2026-10-11T07:00:00.000Z");
    });

    it("splits upcoming (soonest first, live included) and past (latest first)", () => {
        const { events } = parse([
            ev({ id: "past1", startsOn: "2026-09-12" }),
            ev({ id: "past2", startsOn: "2026-09-26" }),
            ev({ id: "live", startsOn: "2026-10-04", startTime: "09:00", endTime: "17:00" }),
            ev({ id: "next", startsOn: "2026-10-10" }),
            ev({ id: "later", startsOn: "2026-11-01" }),
        ]);
        const now = Date.parse("2026-10-04T18:00:00Z"); // 11 AM PDT
        const s = splitSchedule(events, now, TZ);
        assert.deepEqual(s.upcoming.map((t) => t.event.id), ["live", "next", "later"]);
        assert.deepEqual(s.past.map((t) => t.event.id), ["past2", "past1"]);
        assert.equal(s.next?.event.id, "live");
        assert.equal(s.next?.phase, "live");
        assert.equal(relativeLabel(s.upcoming[1], todayIn(now, TZ)), "In 6 days");
        assert.equal(relativeLabel(s.past[0], todayIn(now, TZ)), "8 days ago");
    });

    it("labels relative days", () => {
        const at = (startsOn, phase = "upcoming") => ({
            event: { ...meet, startsOn },
            window: { start: 0, end: 0 },
            phase,
        });
        const today = "2026-10-04";
        assert.equal(relativeLabel(at("2026-10-04"), today), "Today");
        assert.equal(relativeLabel(at("2026-10-05"), today), "Tomorrow");
        assert.equal(relativeLabel(at("2026-10-17"), today), "In 13 days");
        assert.equal(relativeLabel(at("2026-10-25"), today), "In 3 weeks");
        assert.equal(relativeLabel(at("2027-01-04"), today), "In 3 months");
        assert.equal(relativeLabel(at("2026-10-04", "live"), today), "Happening now");
        assert.equal(relativeLabel(at("2026-10-03", "past"), today), "Yesterday");
    });

    it("counts the days of a multi-day event", () => {
        const t = {
            event: { ...meet, startsOn: "2026-10-10", endsOn: "2026-10-12" },
            window: { start: 0, end: 0 },
            phase: "live",
        };
        assert.equal(dayOfEvent(t, "2026-10-11"), "Day 2 of 3");
        assert.equal(dayOfEvent({ ...t, phase: "upcoming" }, "2026-10-11"), null);
    });
});

describe("labels", () => {
    it("formats clock times", () => {
        assert.equal(formatClock("00:05"), "12:05 AM");
        assert.equal(formatClock("08:30"), "8:30 AM");
        assert.equal(formatClock("12:00"), "12:00 PM");
        assert.equal(formatClock("13:30"), "1:30 PM");
        assert.equal(formatClock("09:00", true), "9 AM");
    });

    it("formats the time with the zone of that day", () => {
        const [meet] = parse([ev()]).events;
        assert.equal(timeLabel(meet, TZ), "8:30 AM – 4:30 PM PDT");
        const [winter] = parse([ev({ startsOn: "2026-12-05", endTime: null })]).events;
        assert.equal(timeLabel(winter, TZ), "From 8:30 AM PST");
        const [allDay] = parse([ev({ startTime: null })]).events;
        assert.equal(timeLabel(allDay, TZ), "All day");
    });

    it("formats dates from the team's calendar day (no timezone shift)", () => {
        const [meet] = parse([ev()]).events;
        assert.equal(longDateLabel(meet), "Saturday, October 10, 2026");
        const [two] = parse([ev({ startsOn: "2026-12-31", endsOn: "2027-01-02" })]).events;
        assert.equal(longDateLabel(two), "Thu, Dec 31, 2026 – Sat, Jan 2, 2027");
        assert.equal(monthHeading("2026-10"), "October 2026");
    });

    it("splits and reads countdowns", () => {
        const c = countdown(((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000 + 999);
        assert.deepEqual(c, { days: 2, hours: 3, minutes: 4, seconds: 5 });
        assert.deepEqual(countdown(-5000), { days: 0, hours: 0, minutes: 0, seconds: 0 });
        assert.equal(spokenCountdown(c), "2 days, 3 hours and 4 minutes");
        assert.equal(spokenCountdown(countdown(61_000)), "1 minute");
        assert.equal(spokenCountdown(countdown(3_600_000)), "1 hour");
    });
});
