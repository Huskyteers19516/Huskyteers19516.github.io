/**
 * The sponsor cards on /sponsors, under the page's title (in sponsors.astro):
 * the sponsors the Teammate Portal's Business team publishes
 * (GET /api/public/sponsors), as an auto-scrolling, seamlessly looping
 * marquee of cards (logo, name, years).
 *
 * - Fetched once on load (errors retry with backoff). Turned off in the
 *   portal: nothing. Empty or unreachable: a quiet line, never a crash.
 * - The loop is three copies of the list ([clone][list][clone]) moved with a
 *   transform; only the middle copy is focusable or read by screen readers.
 * - Slows to a stop on hover, on keyboard focus (the focused card is scrolled
 *   into view), while dragged, while off-screen, and with the Pause button.
 * - All cards fit: a still, centered row. prefers-reduced-motion: a static
 *   wrapping grid.
 */
import {
    Component,
    memo,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode,
    type RefObject,
} from "react";
import { useReducedMotion } from "motion/react";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { cn } from "../../lib/utils";
import { DemoTag } from "../progress/feed-ui";
import {
    portalJsonFetcher,
    useDemoOrLive,
    useLiveFeed,
    type JsonFetcher,
} from "../progress/use-live-feed";
import {
    formatYears,
    monogram,
    parseSponsors,
    spokenYears,
    type PublicSponsor,
} from "./types";

/** Cruising speed of the marquee, px per second. */
const SPEED = 36;
/** Keep a focused card this far from the faded edges (px). */
const EDGE = 64;

type Source = {
    fetcher: JsonFetcher;
    /** Dev demo only: where a logo URL actually loads from. */
    logoSrc?: (url: string) => string;
};

/* ------------------------------ card ------------------------------ */

const SponsorCard = memo(function SponsorCard({
    sponsor: s,
    logoSrc,
    clone,
}: {
    sponsor: PublicSponsor;
    logoSrc?: (url: string) => string;
    /** A copy for the loop: not focusable. */
    clone?: boolean;
}) {
    const [broken, setBroken] = useState(false);
    const src = s.logo && !broken ? (logoSrc ? logoSrc(s.logo) : s.logo) : null;
    const years = formatYears(s.years);
    const body = (
        <>
            <span
                className={cn(
                    "sponsor-plate",
                    src ? "sponsor-plate-logo" : "sponsor-plate-mono",
                )}
                aria-hidden="true"
            >
                {src ? (
                    <img
                        src={src}
                        alt=""
                        decoding="async"
                        draggable={false}
                        onError={() => setBroken(true)}
                    />
                ) : (
                    <span className="sponsor-mono font-jockey">
                        {monogram(s.name)}
                    </span>
                )}
            </span>
            <span className="mt-3 flex items-start justify-between gap-2">
                <span className="min-w-0">
                    {/* line-clamp sets its own display: no `block` here. */}
                    <span
                        className="line-clamp-2 leading-snug font-semibold text-base-content"
                        title={s.name}
                    >
                        {s.name}
                    </span>
                    {years && (
                        <span className="mt-1 block font-mono text-xs font-medium tabular-nums tracking-wide text-(--hud-ink)">
                            <span className="sr-only">
                                Sponsor in {spokenYears(s.years)}
                            </span>
                            <span aria-hidden="true">{years}</span>
                        </span>
                    )}
                </span>
                {s.url && (
                    <ArrowUpRight
                        className="sponsor-arrow mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                    />
                )}
            </span>
        </>
    );
    return (
        <li className="sponsor-card" data-card>
            {s.url ? (
                <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    draggable={false}
                    tabIndex={clone ? -1 : undefined}
                    className="sponsor-card-inner hud-card"
                >
                    {body}
                    <span className="sr-only"> (opens in a new tab)</span>
                </a>
            ) : (
                <div className="sponsor-card-inner hud-card">{body}</div>
            )}
        </li>
    );
});

/* ----------------------------- marquee ----------------------------- */

interface Controls {
    setUserPaused: (paused: boolean) => void;
}

/** A length like "4rem" or "24px" in px (0 when it can't be read). */
function cssLength(value: string): number {
    const n = Number.parseFloat(value);
    if (!Number.isFinite(n)) return 0;
    if (value.trim().endsWith("rem")) {
        const root = Number.parseFloat(
            getComputedStyle(document.documentElement).fontSize,
        );
        return n * (Number.isFinite(root) ? root : 16);
    }
    return n;
}

function Marquee({
    sponsors,
    logoSrc,
    alignTo,
}: {
    sponsors: PublicSponsor[];
    logoSrc?: (url: string) => string;
    /** The page's text column: the first card starts level with it. */
    alignTo?: RefObject<HTMLElement | null>;
}) {
    const reduce = useReducedMotion() === true;
    const viewportRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const afterRef = useRef<HTMLUListElement>(null);
    const controls = useRef<Controls | null>(null);
    const [overflows, setOverflows] = useState<boolean | null>(null);
    const [paused, setPaused] = useState(false);
    const pausedRef = useRef(paused);
    pausedRef.current = paused;

    // Scroll only when one copy of the list is wider than the band.
    useLayoutEffect(() => {
        if (reduce) return;
        const vp = viewportRef.current;
        const list = listRef.current;
        if (!vp || !list) return;
        const measure = () =>
            setOverflows(list.offsetWidth > vp.clientWidth + 1);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(vp);
        ro.observe(list);
        return () => ro.disconnect();
    }, [reduce, sponsors]);

    const scrolling = !reduce && overflows === true;

    useLayoutEffect(() => {
        if (!scrolling) return;
        const vp = viewportRef.current;
        const track = trackRef.current;
        const list = listRef.current;
        const after = afterRef.current;
        if (!vp || !track || !list || !after) return;

        const st = {
            hover: false,
            focus: false,
            drag: false,
            visible: true,
            user: pausedRef.current,
        };
        // The middle copy starts at `start`; one period of the loop is `loop`.
        let start = list.offsetLeft;
        let loop = after.offsetLeft - start;
        // Begin with the first (newest) card fully visible, level with the
        // title above — past the faded edge — not half under the fade.
        const startInset = () => {
            const fade = cssLength(
                getComputedStyle(vp).getPropertyValue("--fade"),
            );
            let column = 0;
            const el = alignTo?.current;
            if (el) {
                const pad = Number.parseFloat(getComputedStyle(el).paddingLeft);
                column =
                    el.getBoundingClientRect().left +
                    (Number.isFinite(pad) ? pad : 0) -
                    vp.getBoundingClientRect().left;
            }
            return Math.max(
                0,
                Math.min(Math.max(column, fade), vp.clientWidth / 3),
            );
        };
        let offset = start - startInset();
        let speed = 0;
        let seek: number | null = null;
        let raf = 0;
        let last = 0;

        const wrap = (o: number) => {
            const x = (o - start) % loop;
            return start + (x < 0 ? x + loop : x);
        };
        const paint = () => {
            track.style.transform = `translate3d(${-offset}px, 0, 0)`;
        };
        const cruise = () =>
            st.hover || st.focus || st.drag || st.user ? 0 : SPEED;

        const frame = (t: number) => {
            const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
            last = t;
            if (seek !== null) {
                offset += (seek - offset) * Math.min(1, dt * 9);
                if (Math.abs(seek - offset) < 0.5) {
                    offset = seek;
                    seek = null;
                }
                speed = 0;
            } else if (!st.drag) {
                const want = cruise();
                // Ease in and out instead of jumping between speeds.
                speed += (want - speed) * Math.min(1, dt * 3.5);
                if (want === 0 && speed < 0.5) speed = 0;
                offset += speed * dt;
                if (offset >= start + loop) offset -= loop;
            }
            paint();
            const idle = seek === null && speed === 0 && cruise() === 0;
            if (idle || !st.visible) {
                raf = 0;
                last = 0;
                return;
            }
            raf = requestAnimationFrame(frame);
        };
        const kick = () => {
            if (!raf && st.visible) {
                last = 0;
                raf = requestAnimationFrame(frame);
            }
        };

        paint();
        kick();

        controls.current = {
            setUserPaused: (p) => {
                st.user = p;
                kick();
            },
        };

        const onEnter = (e: PointerEvent) => {
            if (e.pointerType !== "mouse") return;
            st.hover = true;
            kick();
        };
        const onLeave = (e: PointerEvent) => {
            if (e.pointerType !== "mouse") return;
            st.hover = false;
            kick();
        };

        // Keyboard: stop, and bring the focused card fully into view. (A
        // mouse click or tap also focuses the link; that doesn't count.)
        const onFocusIn = (e: FocusEvent) => {
            const target = e.target as Element | null;
            let keyboard = true;
            try {
                keyboard = !!target?.matches(":focus-visible");
            } catch {
                /* old browser: treat every focus as keyboard focus */
            }
            if (!keyboard) return;
            st.focus = true;
            const card = target?.closest<HTMLElement>("[data-card]");
            if (card && list.contains(card)) {
                const vw = vp.clientWidth;
                const pad = Math.max(
                    0,
                    Math.min(EDGE, (vw - card.offsetWidth) / 2),
                );
                const left = list.offsetLeft + card.offsetLeft;
                const right = left + card.offsetWidth;
                let target = seek ?? offset;
                if (left - target < pad) target = left - pad;
                else if (right - target > vw - pad) target = right - vw + pad;
                // Shifting by one loop looks the same; take the short way.
                if (offset - target > loop / 2) offset -= loop;
                else if (target - offset > loop / 2) offset += loop;
                seek = target;
                paint();
            }
            kick();
        };
        const onFocusOut = (e: FocusEvent) => {
            if (!vp.contains(e.relatedTarget as Node | null)) {
                st.focus = false;
                kick();
            }
        };

        // Drag / swipe sideways to look around (links still click).
        let drag: { id: number; x: number; o: number; moved: boolean } | null =
            null;
        let swallowClick = false;
        const onDown = (e: PointerEvent) => {
            if (!e.isPrimary || e.button !== 0) return;
            swallowClick = false;
            drag = { id: e.pointerId, x: e.clientX, o: offset, moved: false };
        };
        const onMove = (e: PointerEvent) => {
            if (!drag || e.pointerId !== drag.id) return;
            const dx = e.clientX - drag.x;
            if (!drag.moved) {
                if (Math.abs(dx) < 6) return;
                drag.moved = true;
                st.drag = true;
                seek = null;
                speed = 0;
                try {
                    vp.setPointerCapture(e.pointerId);
                } catch {
                    /* the pointer is already gone */
                }
                vp.dataset.dragging = "";
            }
            offset = wrap(drag.o - dx);
            paint();
        };
        const endDrag = (e: PointerEvent, cancelled: boolean) => {
            if (!drag || e.pointerId !== drag.id) return;
            const moved = drag.moved;
            drag = null;
            if (!moved) return;
            st.drag = false;
            delete vp.dataset.dragging;
            swallowClick = !cancelled;
            kick();
        };
        const onUp = (e: PointerEvent) => endDrag(e, false);
        const onCancel = (e: PointerEvent) => endDrag(e, true);
        const onClick = (e: MouseEvent) => {
            if (!swallowClick) return;
            swallowClick = false;
            e.preventDefault();
            e.stopPropagation();
        };

        vp.addEventListener("pointerenter", onEnter);
        vp.addEventListener("pointerleave", onLeave);
        vp.addEventListener("focusin", onFocusIn);
        vp.addEventListener("focusout", onFocusOut);
        vp.addEventListener("pointerdown", onDown);
        vp.addEventListener("pointermove", onMove);
        vp.addEventListener("pointerup", onUp);
        vp.addEventListener("pointercancel", onCancel);
        vp.addEventListener("click", onClick, true);

        // Off-screen: stop the loop.
        const io = new IntersectionObserver(([entry]) => {
            st.visible = entry.isIntersecting;
            kick();
        });
        io.observe(vp);

        // Card or band size changed: re-measure, keep the position.
        const ro = new ResizeObserver(() => {
            const nextStart = list.offsetLeft;
            const nextLoop = after.offsetLeft - nextStart;
            if (nextLoop <= 0) return;
            const progress = (offset - start) / loop;
            start = nextStart;
            loop = nextLoop;
            offset = wrap(start + progress * loop);
            seek = null;
            paint();
        });
        ro.observe(list);

        return () => {
            cancelAnimationFrame(raf);
            io.disconnect();
            ro.disconnect();
            vp.removeEventListener("pointerenter", onEnter);
            vp.removeEventListener("pointerleave", onLeave);
            vp.removeEventListener("focusin", onFocusIn);
            vp.removeEventListener("focusout", onFocusOut);
            vp.removeEventListener("pointerdown", onDown);
            vp.removeEventListener("pointermove", onMove);
            vp.removeEventListener("pointerup", onUp);
            vp.removeEventListener("pointercancel", onCancel);
            vp.removeEventListener("click", onClick, true);
            delete vp.dataset.dragging;
            track.style.transform = "";
            controls.current = null;
        };
    }, [scrolling, sponsors, alignTo]);

    useEffect(() => {
        controls.current?.setUserPaused(paused);
    }, [paused]);

    const cards = (clone: boolean) =>
        sponsors.map((s) => (
            <SponsorCard
                key={s.key}
                sponsor={s}
                logoSrc={logoSrc}
                clone={clone}
            />
        ));

    if (reduce) {
        return (
            <ul
                aria-label="Our sponsors"
                className="sponsor-grid mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
            >
                {cards(false)}
            </ul>
        );
    }

    return (
        <div>
            <div
                ref={viewportRef}
                className={cn(
                    "sponsor-viewport",
                    scrolling && "sponsor-viewport-scrolling",
                )}
            >
                <div
                    ref={trackRef}
                    className={cn(
                        "sponsor-track",
                        !scrolling && "sponsor-track-still",
                    )}
                >
                    {scrolling && (
                        <ul className="sponsor-list" aria-hidden="true" inert>
                            {cards(true)}
                        </ul>
                    )}
                    <ul
                        ref={listRef}
                        aria-label="Our sponsors"
                        className="sponsor-list"
                    >
                        {cards(false)}
                    </ul>
                    {scrolling && (
                        <ul
                            ref={afterRef}
                            className="sponsor-list"
                            aria-hidden="true"
                            inert
                        >
                            {cards(true)}
                        </ul>
                    )}
                </div>
            </div>
            {scrolling && (
                <div className="mx-auto mt-2 flex max-w-7xl justify-end px-4 sm:px-6 lg:px-8">
                    <button
                        type="button"
                        className="sponsor-pause btn btn-ghost btn-xs font-mono uppercase tracking-wider"
                        onClick={() => setPaused((p) => !p)}
                    >
                        {paused ? (
                            <Play className="size-3.5" aria-hidden="true" />
                        ) : (
                            <Pause className="size-3.5" aria-hidden="true" />
                        )}
                        {paused ? "Play" : "Pause"}
                        <span className="sr-only"> the sponsor scroll</span>
                    </button>
                </div>
            )}
        </div>
    );
}

function MarqueeSkeleton() {
    return (
        <div className="sponsor-viewport sponsor-viewport-scrolling" aria-hidden="true">
            <div className="sponsor-track sponsor-track-still">
                <div className="sponsor-list">
                    {Array.from({ length: 6 }, (_, i) => (
                        <div
                            key={i}
                            className="sponsor-card hud-panel hud-skeleton h-[9.5rem] rounded-2xl"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function Quiet({ children }: { children: ReactNode }) {
    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="sponsor-quiet rounded-xl px-4 py-5 text-center text-sm text-base-content/70">
                {children}
            </p>
        </div>
    );
}

/* ------------------------------ band ------------------------------ */

function Band({ portalUrl }: { portalUrl: string }) {
    const source = useDemoOrLive<Source>(
        // Sponsors change rarely: one shared CDN entry per 5 minutes.
        () => ({
            fetcher: portalJsonFetcher(
                portalUrl,
                "/api/public/sponsors",
                5 * 60_000,
            ),
        }),
        import.meta.env.DEV
            ? (mode) =>
                  import("./demo-data").then(({ createDemoSponsorsSource }) =>
                      createDemoSponsorsSource(mode),
                  )
            : null,
        portalUrl,
    );
    const parse = useCallback(
        (raw: unknown) => parseSponsors(raw, portalUrl),
        [portalUrl],
    );
    const feed = useLiveFeed(source?.fetcher ?? null, { parse, pollMs: 0 });
    const data = feed.data;

    // The text column the marquee's first card lines up with.
    const columnRef = useRef<HTMLDivElement>(null);

    // The owner turned the sponsor list off: nothing under the title.
    if (data && !data.enabled) return null;

    const sponsors = data?.enabled ? data.sponsors : null;
    const firstYear = sponsors
        ?.flatMap((s) => s.years.slice(0, 1))
        .reduce((a, b) => Math.min(a, b), Infinity);

    let body: ReactNode;
    if (sponsors && sponsors.length > 0) {
        body = (
            <Marquee
                sponsors={sponsors}
                logoSrc={source?.logoSrc}
                alignTo={columnRef}
            />
        );
    } else if (sponsors) {
        body = (
            <Quiet>
                Our sponsor wall is getting ready for the new season. Want your
                company here? See how to sponsor us below.
            </Quiet>
        );
    } else if (feed.status === "error") {
        body = (
            <Quiet>
                Our sponsor list couldn&rsquo;t load just now. Thank you to
                every company and family who supports the Huskyteers!
            </Quiet>
        );
    } else {
        body = <MarqueeSkeleton />;
    }

    return (
        <div className="mt-6">
            <div
                ref={columnRef}
                className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
            >
                {sponsors && sponsors.length > 0 && (
                    <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-base-content/70">
                        <span className="font-semibold text-base-content">
                            {sponsors.length}
                        </span>{" "}
                        {sponsors.length === 1 ? "sponsor" : "sponsors"}
                        {firstYear && Number.isFinite(firstYear) ? (
                            <> · since {firstYear}</>
                        ) : null}
                    </p>
                )}
                <DemoTag mode={source?.demo} />
            </div>
            <div className="mt-4">{body}</div>
        </div>
    );
}

/** A broken band must never take the page down: render nothing instead. */
class QuietBoundary extends Component<
    { children: ReactNode },
    { failed: boolean }
> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    render() {
        return this.state.failed ? null : this.props.children;
    }
}

export default function SponsorBand({ portalUrl }: { portalUrl: string }) {
    return (
        <QuietBoundary>
            <Band portalUrl={portalUrl} />
        </QuietBoundary>
    );
}
