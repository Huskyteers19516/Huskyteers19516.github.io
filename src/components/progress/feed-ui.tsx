/**
 * Status pieces shared by the live pages that read the Teammate Portal
 * (/progress, /events): the live/reconnecting chip, the "data unavailable"
 * banner, and the centered notice panel.
 */
import type { ReactNode } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { LiveDot, Panel } from "./hud";
import { longAgo } from "./format";
import { useNow, type LiveFeedState, type PortalPayload } from "./use-live-feed";

export function StatusBadge({
    feed,
    offDetail,
}: {
    feed: LiveFeedState<PortalPayload>;
    /** Shown after "Private ·" when the owner turned the feed off. */
    offDetail: string;
}) {
    const now = useNow(1000);
    let tone: "live" | "warn" | "idle" = "idle";
    let label = "Connecting";
    let detail = "to the team portal…";

    if (feed.status === "live" && feed.data?.enabled === false) {
        tone = "idle";
        label = "Private";
        detail = offDetail;
    } else if (feed.status === "live" && feed.fetchedAt) {
        tone = "live";
        label = "Live";
        detail = `updated ${longAgo(now - feed.fetchedAt + feed.ageAtFetch)}`;
    } else if (feed.status === "error") {
        tone = "warn";
        label = "Reconnecting";
        detail = feed.retryAt
            ? `retry in ${Math.max(1, Math.ceil((feed.retryAt - now) / 1000))} s`
            : "paused";
    }

    return (
        <div
            className={cn(
                "hud-status inline-flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-2 font-mono text-xs whitespace-nowrap uppercase tracking-[0.16em]",
                tone === "warn" && "hud-status-warn",
            )}
        >
            <LiveDot tone={tone} />
            <span className="font-semibold text-base-content">{label}</span>
            <span className="text-base-content/40" aria-hidden="true">
                ·
            </span>
            <span className="normal-case tracking-normal text-base-content/70">
                {detail}
            </span>
        </div>
    );
}

export function Notice({
    icon: Icon,
    title,
    children,
    tone = "info",
}: {
    icon: LucideIcon;
    title: string;
    children?: ReactNode;
    tone?: "info" | "warn";
}) {
    return (
        <Panel
            as="div"
            className="mx-auto mt-12 flex max-w-xl flex-col items-center px-6 py-12 text-center"
        >
            <span
                className={cn(
                    "hud-icon grid size-14 place-items-center rounded-2xl",
                    tone === "warn" && "hud-icon-warn",
                )}
            >
                <Icon className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-jockey text-4xl uppercase text-base-content">
                {title}
            </h2>
            <div className="mt-2 text-base-content/70">{children}</div>
        </Panel>
    );
}

/** The first load failed: a notice with a retry button. */
export function UnavailableNotice({ onRetry }: { onRetry: () => void }) {
    return (
        <Notice icon={WifiOff} title="Live data unavailable" tone="warn">
            <p>Retrying… The team portal didn&rsquo;t answer just now.</p>
            <button
                type="button"
                className="btn btn-primary btn-sm mt-5"
                onClick={onRetry}
            >
                <RefreshCw className="size-4" aria-hidden="true" /> Retry now
            </button>
        </Notice>
    );
}

export function StaleBanner({
    feed,
    onRetry,
}: {
    feed: LiveFeedState<PortalPayload>;
    onRetry: () => void;
}) {
    const now = useNow(1000);
    // One failed poll only flips the status chip; a banner (which shifts the
    // layout) appears once the outage persists.
    if (feed.status !== "error" || !feed.fetchedAt || feed.failures < 2)
        return null;
    return (
        <div className="hud-banner mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-4 py-3 text-sm">
            <WifiOff
                className="size-4 shrink-0 text-warning"
                aria-hidden="true"
            />
            <p className="flex-1 text-base-content/80">
                <span className="font-semibold text-base-content">
                    Live data unavailable, retrying…
                </span>{" "}
                Showing the last update from{" "}
                {longAgo(now - feed.fetchedAt + feed.ageAtFetch)}.
            </p>
            <button
                type="button"
                className="btn btn-ghost btn-xs font-mono uppercase"
                onClick={onRetry}
            >
                <RefreshCw className="size-3.5" aria-hidden="true" /> Retry now
            </button>
        </div>
    );
}

/** Dev-only marker that the page shows mock data. */
export function DemoTag({ mode }: { mode: string | undefined }) {
    if (!mode) return null;
    return (
        <p className="mt-4 inline-block rounded-md border border-dashed border-warning/60 px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-wider text-base-content/70">
            Dev demo data · ?demo={mode}
        </p>
    );
}
