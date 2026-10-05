import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCheck } from "lucide-react";
import { cn } from "../../lib/utils";
import { feedRows, untitledHeadline } from "./feed-rows";
import { formatDateTime, shortAgo } from "./format";
import { subteamMeta } from "./subteam-meta";
import type { ProgressRecent, ProgressSubteam } from "./types";

const MOBILE_LIMIT = 5;

export function RecentFeed({
    recent,
    subteams,
    now,
    labelledBy,
}: {
    recent: ProgressRecent[];
    subteams: ProgressSubteam[];
    now: number;
    /** Id of the feed's heading (names the scrollable list). */
    labelledBy: string;
}) {
    const reduce = useReducedMotion();
    const [expanded, setExpanded] = useState(false);
    const names = new Map(subteams.map((s) => [s.key, s.name]));

    // Stable keys so new arrivals animate in and existing rows stay put;
    // untitled items next to each other are merged.
    const rows = feedRows(recent);

    if (rows.length === 0) {
        return (
            <p className="px-1 py-8 text-center font-mono text-sm text-base-content/70">
                No completed items yet. Check back soon.
            </p>
        );
    }

    return (
        <>
            <ol
                aria-labelledby={labelledBy}
                className="hud-feed relative flex-1 space-y-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1"
            >
                <AnimatePresence initial={false}>
                    {rows.map((r, i) => {
                        const sub = r.subteam
                            ? subteamMeta(r.subteam, names.get(r.subteam))
                            : null;
                        const headline =
                            r.title ??
                            untitledHeadline(r, sub ? sub.label : null);
                        // Untitled rows already name the person (or the
                        // subteam when there's no name) in the headline.
                        const metaSub = r.title !== null || r.who !== null;
                        const metaWho = r.title !== null ? r.who : null;
                        return (
                            <motion.li
                                key={r.key}
                                layout={reduce ? false : "position"}
                                initial={
                                    reduce
                                        ? false
                                        : { opacity: 0, y: -12, scale: 0.98 }
                                }
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={reduce ? undefined : { opacity: 0 }}
                                transition={{
                                    duration: 0.45,
                                    ease: [0.16, 1, 0.3, 1],
                                }}
                                className={cn(
                                    "hud-feed-item relative flex gap-3 rounded-lg py-2 pr-2 pl-1",
                                    i >= MOBILE_LIMIT &&
                                        !expanded &&
                                        "max-lg:hidden",
                                )}
                            >
                                <span
                                    className="hud-feed-node relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full"
                                    aria-hidden="true"
                                >
                                    <CheckCheck
                                        className="size-3.5"
                                        strokeWidth={2.5}
                                    />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm leading-snug font-medium break-words text-base-content">
                                        {headline}
                                    </p>
                                    {((metaSub && sub) || metaWho) && (
                                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-base-content/70">
                                            {metaSub && sub && (
                                                <span className="text-(--hud-ink)">
                                                    {sub.label}
                                                </span>
                                            )}
                                            {metaSub && sub && metaWho && (
                                                <span aria-hidden="true">·</span>
                                            )}
                                            {metaWho && (
                                                <span className="normal-case tracking-normal">
                                                    {metaWho}
                                                </span>
                                            )}
                                        </p>
                                    )}
                                </div>
                                <time
                                    dateTime={r.at}
                                    title={formatDateTime(r.at)}
                                    className="mt-0.5 shrink-0 font-mono text-[0.6875rem] tabular-nums text-base-content/70"
                                >
                                    {shortAgo(r.at, now)}
                                </time>
                            </motion.li>
                        );
                    })}
                </AnimatePresence>
            </ol>
            {rows.length > MOBILE_LIMIT && (
                <button
                    type="button"
                    className="btn btn-ghost btn-sm mt-2 w-full font-mono text-xs uppercase tracking-wider lg:hidden"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((e) => !e)}
                >
                    {expanded ? "Show less" : `Show all ${rows.length}`}
                </button>
            )}
        </>
    );
}
