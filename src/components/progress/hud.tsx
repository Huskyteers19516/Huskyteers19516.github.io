import { useEffect, useId, type HTMLAttributes, type ReactNode } from "react";
import {
    animate,
    motion,
    useMotionValue,
    useReducedMotion,
    useTransform,
} from "motion/react";
import { cn } from "../../lib/utils";
import { formatNumber } from "./format";

const EASE = [0.16, 1, 0.3, 1] as const;

/** A HUD panel: translucent surface, thin glowing border, corner brackets. */
export function Panel({
    as: Tag = "section",
    className,
    children,
    ...rest
}: {
    as?: "section" | "div" | "article" | "aside";
    className?: string;
    children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">) {
    return (
        <Tag className={cn("hud-panel", className)} {...rest}>
            {children}
        </Tag>
    );
}

/** Small mono uppercase label used as a panel heading. */
export function Kicker({
    className,
    children,
    as: Tag = "p",
    id,
}: {
    className?: string;
    children: ReactNode;
    as?: "p" | "h2" | "h3" | "span";
    id?: string;
}) {
    return (
        <Tag
            id={id}
            className={cn(
                "font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-base-content/65",
                className,
            )}
        >
            {children}
        </Tag>
    );
}

/** A number that counts from its previous value (0 on first mount). */
export function AnimatedNumber({
    value,
    format = formatNumber,
    className,
}: {
    value: number;
    format?: (n: number) => string;
    className?: string;
}) {
    const reduce = useReducedMotion();
    const mv = useMotionValue(reduce ? value : 0);
    const text = useTransform(mv, (v) => format(v));

    useEffect(() => {
        if (reduce) {
            mv.set(value);
            return;
        }
        const controls = animate(mv, value, { duration: 1.1, ease: EASE });
        return () => controls.stop();
    }, [value, reduce, mv]);

    return <motion.span className={className}>{text}</motion.span>;
}

/**
 * Circular progress ring with optional HUD tick marks. `value` is the solid
 * (done) arc; `secondary` is a fainter arc right after it (waiting for
 * review), both in percent of the whole.
 */
export function Ring({
    value,
    secondary = 0,
    size = 120,
    stroke = 8,
    ticks = 0,
    className,
    children,
    label,
}: {
    value: number;
    secondary?: number;
    size?: number;
    stroke?: number;
    ticks?: number;
    className?: string;
    children?: ReactNode;
    label: string;
}) {
    const reduce = useReducedMotion();
    const gid = useId().replace(/:/g, "");
    const pad = ticks ? 10 : 0;
    const r = size / 2 - stroke / 2 - pad;
    const c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(100, value));
    const offset = c * (1 - v / 100);
    const both = Math.max(v, Math.min(100, v + Math.max(0, secondary)));
    const bothOffset = c * (1 - both / 100);
    const center = size / 2;
    const draw = reduce
        ? { duration: 0 }
        : { duration: 1.4, ease: EASE };

    return (
        <div
            className={cn("relative grid place-items-center", className)}
            style={{ width: size, height: size }}
            role="img"
            aria-label={label}
        >
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="absolute inset-0 -rotate-90 overflow-visible"
                aria-hidden="true"
            >
                <defs>
                    <linearGradient
                        id={`ring-${gid}`}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                    >
                        <stop offset="0%" stopColor="var(--hud-line)" />
                        <stop offset="100%" stopColor="var(--color-accent)" />
                    </linearGradient>
                </defs>
                {ticks > 0 &&
                    Array.from({ length: ticks }, (_, i) => {
                        const a = (i / ticks) * Math.PI * 2;
                        const r1 = size / 2 - 2;
                        const r2 = size / 2 - (i % 5 === 0 ? 8 : 5);
                        const on = (i / ticks) * 100 < v;
                        return (
                            <line
                                key={i}
                                x1={center + r1 * Math.cos(a)}
                                y1={center + r1 * Math.sin(a)}
                                x2={center + r2 * Math.cos(a)}
                                y2={center + r2 * Math.sin(a)}
                                className={
                                    on ? "hud-tick hud-tick-on" : "hud-tick"
                                }
                                strokeWidth={i % 5 === 0 ? 1.5 : 1}
                            />
                        );
                    })}
                <circle
                    cx={center}
                    cy={center}
                    r={r}
                    fill="none"
                    className="hud-ring-track"
                    strokeWidth={stroke}
                />
                {/* Waiting for review: drawn to done + waiting, under the done arc. */}
                <motion.circle
                    cx={center}
                    cy={center}
                    r={r}
                    fill="none"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={c}
                    className="hud-ring-pending"
                    initial={{ strokeDashoffset: reduce ? bothOffset : c }}
                    animate={{ strokeDashoffset: both === 0 ? c : bothOffset }}
                    transition={draw}
                />
                <motion.circle
                    cx={center}
                    cy={center}
                    r={r}
                    fill="none"
                    stroke={`url(#ring-${gid})`}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={c}
                    className="hud-ring-value"
                    initial={{ strokeDashoffset: reduce ? offset : c }}
                    animate={{ strokeDashoffset: v === 0 ? c : offset }}
                    transition={draw}
                />
            </svg>
            <div className="relative text-center">{children}</div>
        </div>
    );
}

/** Horizontal progress meter: done (solid), then waiting for review (faint). */
export function Meter({
    value,
    secondary = 0,
    className,
    size = "md",
}: {
    value: number;
    secondary?: number;
    className?: string;
    size?: "xs" | "sm" | "md";
}) {
    const reduce = useReducedMotion();
    const v = Math.max(0, Math.min(100, value)) / 100;
    const both = Math.max(v, Math.min(1, v + Math.max(0, secondary) / 100));
    const transition = reduce
        ? { duration: 0 }
        : { duration: 1.1, ease: EASE };
    return (
        <div
            className={cn(
                "hud-meter relative w-full overflow-hidden rounded-full",
                size === "xs" ? "h-1" : size === "sm" ? "h-1.5" : "h-2",
                className,
            )}
            aria-hidden="true"
        >
            {both > v && (
                <motion.div
                    className="hud-meter-pending absolute inset-y-0 left-0 w-full origin-left rounded-full"
                    initial={{ scaleX: reduce ? both : 0 }}
                    animate={{ scaleX: both }}
                    transition={transition}
                />
            )}
            <motion.div
                className="hud-meter-fill absolute inset-y-0 left-0 w-full origin-left rounded-full"
                initial={{ scaleX: reduce ? v : 0 }}
                animate={{ scaleX: v }}
                transition={transition}
            />
        </div>
    );
}

/** A legend swatch matching the ring / meter segments. */
export function Swatch({
    tone,
    className,
}: {
    tone: "done" | "pending" | "todo";
    className?: string;
}) {
    return (
        <span
            className={cn(
                "inline-block size-2.5 shrink-0 rounded-full",
                tone === "done" && "hud-swatch-done",
                tone === "pending" && "hud-swatch-pending",
                tone === "todo" && "hud-swatch-todo",
                className,
            )}
            aria-hidden="true"
        />
    );
}

/** Pulsing live indicator dot. */
export function LiveDot({
    tone = "live",
    className,
}: {
    tone?: "live" | "warn" | "idle";
    className?: string;
}) {
    return (
        <span
            className={cn("relative inline-flex size-2.5 shrink-0", className)}
            aria-hidden="true"
        >
            {tone !== "idle" && (
                <span
                    className={cn(
                        "hud-ping absolute inline-flex size-full rounded-full opacity-70",
                        tone === "live" ? "bg-primary" : "bg-warning",
                    )}
                />
            )}
            <span
                className={cn(
                    "relative inline-flex size-2.5 rounded-full",
                    tone === "live" &&
                        "bg-primary shadow-[0_0_10px_var(--color-primary)]",
                    tone === "warn" && "bg-warning",
                    tone === "idle" && "bg-base-content/40",
                )}
            />
        </span>
    );
}
