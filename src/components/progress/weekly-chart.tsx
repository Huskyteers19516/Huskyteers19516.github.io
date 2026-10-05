import { useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "../../lib/utils";
import { formatDay, formatNumber, parseDay, teamToday } from "./format";
import type { ProgressWeek } from "./types";

interface Pt {
    x: number;
    y: number;
}

/** Monotone cubic segments (no overshoot below zero), one path per segment. */
function monotoneSegments(pts: Pt[]): string[] {
    const n = pts.length;
    if (n < 2) return [];
    const dx: number[] = [];
    const m: number[] = [];
    for (let i = 0; i < n - 1; i++) {
        dx.push(pts[i + 1].x - pts[i].x);
        m.push((pts[i + 1].y - pts[i].y) / dx[i]);
    }
    const t: number[] = [m[0]];
    for (let i = 1; i < n - 1; i++) {
        t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
    }
    t.push(m[n - 2]);
    for (let i = 0; i < n - 1; i++) {
        if (m[i] === 0) {
            t[i] = 0;
            t[i + 1] = 0;
            continue;
        }
        const a = t[i] / m[i];
        const b = t[i + 1] / m[i];
        const h = a * a + b * b;
        if (h > 9) {
            const s = 3 / Math.sqrt(h);
            t[i] = s * a * m[i];
            t[i + 1] = s * b * m[i];
        }
    }
    const segs: string[] = [];
    for (let i = 0; i < n - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const h = dx[i] / 3;
        segs.push(
            `C ${p0.x + h} ${p0.y + t[i] * h} ${p1.x - h} ${p1.y - t[i + 1] * h} ${p1.x} ${p1.y}`,
        );
    }
    return segs;
}

function niceMax(v: number): number {
    if (v <= 4) return 4;
    const pow = 10 ** Math.floor(Math.log10(v));
    for (const step of [1, 2, 2.5, 5, 10]) {
        const c = step * pow;
        if (c >= v) return c;
    }
    return 10 * pow;
}

/** Is the week starting `weekStart` still in progress (team timezone)? */
export function isCurrentWeek(weekStart: string, now: number): boolean {
    const start = parseDay(weekStart);
    const today = parseDay(teamToday(now));
    if (!start || !today) return false;
    const days = Math.round((today.getTime() - start.getTime()) / 86_400_000);
    return days >= 0 && days < 7;
}

export function WeeklyChart({
    weekly,
    now,
}: {
    weekly: ProgressWeek[];
    now: number;
}) {
    const reduce = useReducedMotion();
    const gid = useId().replace(/:/g, "");
    const [active, setActive] = useState<number | null>(null);
    const n = weekly.length;

    if (n === 0) {
        return (
            <p className="py-10 text-center font-mono text-sm text-base-content/70">
                No weekly data yet.
            </p>
        );
    }

    const values = weekly.map((w) => w.itemsDone);
    const top = niceMax(Math.max(...values));
    const pts: Pt[] = weekly.map((w, i) => ({
        x: ((i + 0.5) / n) * 100,
        y: 100 - (w.itemsDone / top) * 100,
    }));
    const segs = monotoneSegments(pts);
    const partial = isCurrentWeek(weekly[n - 1].weekStart, now);
    const solid = `M ${pts[0].x} ${pts[0].y} ${segs.slice(0, partial ? -1 : undefined).join(" ")}`;
    const dashed =
        partial && n > 1
            ? `M ${pts[n - 2].x} ${pts[n - 2].y} ${segs[n - 2]}`
            : null;
    const area = `M ${pts[0].x} 100 L ${pts[0].x} ${pts[0].y} ${segs.join(" ")} L ${pts[n - 1].x} 100 Z`;
    const maxIdx = values.indexOf(Math.max(...values));
    const last = n - 1;
    const weekLabel = (i: number) =>
        i === last && partial
            ? "This wk"
            : formatDay(weekly[i].weekStart, false);
    const describe = (i: number) =>
        `${i === last && partial ? "This week (in progress)" : `Week of ${formatDay(weekly[i].weekStart)}`}: ${formatNumber(values[i])} items done`;

    return (
        <div>
            <div className="relative h-44 sm:h-48">
                {/* Gridlines + y labels */}
                {[1, 0.5].map((f) => (
                    <div
                        key={f}
                        className="pointer-events-none absolute inset-x-0 border-t border-dashed border-base-content/10"
                        style={{ top: `${(1 - f) * 100}%` }}
                        aria-hidden="true"
                    >
                        <span className="absolute -top-4 left-0 font-mono text-[0.625rem] tabular-nums text-base-content/70">
                            {formatNumber(top * f)}
                        </span>
                    </div>
                ))}
                <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-base-content/20"
                    aria-hidden="true"
                />

                {/* Revealed left-to-right with a clip (pathLength-based
                    drawing breaks with non-scaling strokes). */}
                <motion.svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="absolute inset-0 size-full overflow-visible"
                    aria-hidden="true"
                    initial={{
                        clipPath: reduce
                            ? "inset(-20% -5% -5% -5%)"
                            : "inset(-20% 100% -5% -5%)",
                    }}
                    animate={{ clipPath: "inset(-20% -5% -5% -5%)" }}
                    transition={{
                        duration: reduce ? 0 : 1.3,
                        ease: [0.16, 1, 0.3, 1],
                    }}
                >
                    <defs>
                        <linearGradient
                            id={`area-${gid}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor="var(--color-primary)"
                                stopOpacity="0.32"
                            />
                            <stop
                                offset="100%"
                                stopColor="var(--color-primary)"
                                stopOpacity="0"
                            />
                        </linearGradient>
                    </defs>
                    <path d={area} fill={`url(#area-${gid})`} />
                    <path
                        d={solid}
                        fill="none"
                        className="hud-chart-line"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                    />
                    {dashed && (
                        <path
                            d={dashed}
                            fill="none"
                            className="hud-chart-line"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                            opacity={0.8}
                        />
                    )}
                </motion.svg>

                {/* Dots + selective direct labels (latest + peak) */}
                {pts.map((p, i) => {
                    const isLast = i === last;
                    const showLabel =
                        isLast ||
                        (i === maxIdx && values[i] > 0) ||
                        active === i;
                    return (
                        <div
                            key={weekly[i].weekStart}
                            className="pointer-events-none absolute"
                            style={{ left: `${p.x}%`, top: `${p.y}%` }}
                            aria-hidden="true"
                        >
                            <span
                                className={cn(
                                    "hud-chart-dot absolute block -translate-x-1/2 -translate-y-1/2 rounded-full",
                                    isLast
                                        ? "size-3 hud-chart-dot-live"
                                        : "size-2",
                                    active === i && "size-3",
                                )}
                            />
                            {showLabel && (
                                <span
                                    className={cn(
                                        "absolute -translate-x-1/2 whitespace-nowrap font-mono text-xs font-semibold tabular-nums",
                                        p.y < 18 ? "top-2.5" : "-top-6",
                                        isLast
                                            ? "text-(--hud-ink)"
                                            : "text-base-content/80",
                                    )}
                                >
                                    {formatNumber(values[i])}
                                </span>
                            )}
                        </div>
                    );
                })}

                {/* Hover / focus targets, one column per week */}
                <div className="absolute inset-0 flex">
                    {weekly.map((w, i) => (
                        <div
                            key={w.weekStart}
                            tabIndex={0}
                            role="img"
                            aria-label={describe(i)}
                            className={cn(
                                "h-full flex-1 cursor-crosshair rounded-sm outline-none transition-colors",
                                "focus-visible:bg-primary/10 focus-visible:ring-1 focus-visible:ring-primary/60",
                                active === i && "bg-primary/[0.06]",
                            )}
                            onMouseEnter={() => setActive(i)}
                            onMouseLeave={() => setActive(null)}
                            onFocus={() => setActive(i)}
                            onBlur={() => setActive(null)}
                        />
                    ))}
                </div>

                {active !== null && (
                    <div
                        className="hud-tooltip pointer-events-none absolute z-10 whitespace-nowrap rounded-md px-2.5 py-1.5 font-mono text-[0.6875rem]"
                        style={{
                            left: `${Math.min(88, Math.max(12, pts[active].x))}%`,
                            top: `${Math.max(0, pts[active].y - 30)}%`,
                            transform: "translate(-50%, -100%)",
                        }}
                        aria-hidden="true"
                    >
                        <span className="text-base-content/70">
                            {active === last && partial
                                ? "This week"
                                : `Wk of ${formatDay(weekly[active].weekStart, false)}`}
                        </span>{" "}
                        <span className="font-semibold text-base-content">
                            {formatNumber(values[active])} done
                        </span>
                    </div>
                )}
            </div>

            {/* X axis */}
            <div className="mt-2 flex" aria-hidden="true">
                {weekly.map((w, i) => (
                    <span
                        key={w.weekStart}
                        className={cn(
                            "flex-1 whitespace-nowrap text-center font-mono text-[0.625rem] uppercase text-base-content/70 sm:tracking-wider",
                            (last - i) % 2 === 1 && "max-sm:invisible",
                            i === last && "text-(--hud-ink)",
                        )}
                    >
                        {weekLabel(i)}
                    </span>
                ))}
            </div>

            <table className="sr-only">
                <caption>Checklist items completed per week</caption>
                <thead>
                    <tr>
                        <th scope="col">Week starting</th>
                        <th scope="col">Items done</th>
                    </tr>
                </thead>
                <tbody>
                    {weekly.map((w, i) => (
                        <tr key={w.weekStart}>
                            <td>
                                {formatDay(w.weekStart)}
                                {i === last && partial ? " (in progress)" : ""}
                            </td>
                            <td>{w.itemsDone}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
