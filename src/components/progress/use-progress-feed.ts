import { parseProgress, type ProgressPayload } from "./types";
import {
    portalJsonFetcher,
    useLiveFeed,
    type JsonFetcher,
    type LiveFeedState,
} from "./use-live-feed";

export { useNow } from "./use-live-feed";

/** Fetches one raw (unvalidated) payload. */
export type ProgressFetcher = JsonFetcher;

export type FeedState = LiveFeedState<ProgressPayload>;

const POLL_MS = 30_000;

export function portalFetcher(portalUrl: string): ProgressFetcher {
    // The portal answers with `s-maxage=15, stale-while-revalidate=45`: one
    // shared CDN entry per 15 s window.
    return portalJsonFetcher(portalUrl, "/api/public/progress", 15_000);
}

const progressStamp = (p: ProgressPayload) =>
    p.enabled ? p.updatedAt : null;

/**
 * Polls the public progress endpoint: every 30 s while the tab is visible,
 * paused while hidden, refreshed on focus, exponential backoff on errors.
 * Pass `fetcher = null` to stay idle (e.g. until the data source is known).
 */
export function useProgressFeed(
    fetcher: ProgressFetcher | null,
    pollMs: number = POLL_MS,
) {
    return useLiveFeed(fetcher, {
        parse: parseProgress,
        pollMs,
        updatedAt: progressStamp,
    });
}
