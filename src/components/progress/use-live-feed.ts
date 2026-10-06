import { useCallback, useEffect, useRef, useState } from "react";
import { PortalHttpError } from "../../lib/portal-json";
import { readJson } from "./types";

/** Fetches one raw (unvalidated) payload. */
export type JsonFetcher = (signal: AbortSignal) => Promise<unknown>;

/** Every public portal answer has `enabled` (false = the owner turned it off). */
export type PortalPayload = { enabled: boolean };

export interface LiveFeedState<T extends PortalPayload> {
    /** loading: nothing yet; live: last attempt succeeded; error: last attempt failed. */
    status: "loading" | "live" | "error";
    data: T | null;
    /** Client clock time of the last successful fetch. */
    fetchedAt: number | null;
    /** How old the server's snapshot was when it arrived (skew-guarded). */
    ageAtFetch: number;
    failures: number;
    /** Client clock time of the next scheduled attempt while in error. */
    retryAt: number | null;
}

export interface LiveFeedOptions<T extends PortalPayload> {
    /** Validates the raw JSON; null = unusable (counts as an error). */
    parse: (raw: unknown) => T | null;
    /** Poll interval while the tab is visible. 0 = fetch once (errors still retry). */
    pollMs: number;
    /** A focus / visibility wake this soon after the last attempt doesn't refetch. */
    wakeDebounceMs?: number;
    /** The server's snapshot time (ISO), for "updated … ago". */
    updatedAt?: (payload: T) => string | null;
    /**
     * An answer after which there's nothing to poll for (e.g. the per-person
     * endpoint saying that person isn't public): polling stops until the
     * fetcher changes.
     */
    final?: (payload: T) => boolean;
}

const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 12_000;
/** focus + visibilitychange often fire together; don't double-fetch. */
const WAKE_DEBOUNCE_MS = 4_000;

/**
 * GET `${portalUrl}${path}` as JSON (CORS, no cookies). A `bucketMs` time
 * bucket in the URL keeps every visitor on one shared CDN entry per window
 * while making sure the browser never hands back an older answer from its
 * own cache. No request cache headers are sent, so the CDN is never bypassed.
 * A non-2xx answer throws a PortalHttpError carrying the status.
 */
export function portalJsonFetcher(
    portalUrl: string,
    path: string,
    bucketMs: number,
): JsonFetcher {
    const endpoint = `${portalUrl.replace(/\/+$/, "")}${path}`;
    return async (signal) => {
        const bucket = Math.floor(Date.now() / bucketMs);
        const res = await fetch(`${endpoint}?t=${bucket}`, {
            signal,
            mode: "cors",
            credentials: "omit",
            headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new PortalHttpError(res.status);
        return readJson(res);
    };
}

const initialState: LiveFeedState<never> = {
    status: "loading",
    data: null,
    fetchedAt: null,
    ageAtFetch: 0,
    failures: 0,
    retryAt: null,
};

/** Structural equality ignoring the volatile updatedAt stamp. */
function sameContent(a: PortalPayload | null, b: PortalPayload): boolean {
    if (!a || a.enabled !== b.enabled) return false;
    if (!a.enabled || !b.enabled) return true;
    return (
        JSON.stringify({ ...a, updatedAt: "" }) ===
        JSON.stringify({ ...b, updatedAt: "" })
    );
}

/**
 * Polls a public portal endpoint: every `pollMs` while the tab is visible,
 * paused while hidden, refreshed on focus, exponential backoff on errors.
 * Pass `fetcher = null` to stay idle (e.g. until the data source is known).
 * An unchanged answer keeps the previous `data` object, so memoized views
 * don't re-render. The state belongs to one fetcher: when the fetcher
 * changes (or becomes null), the old answer is dropped at once — never shown
 * for another source.
 */
export function useLiveFeed<T extends PortalPayload>(
    fetcher: JsonFetcher | null,
    options: LiveFeedOptions<T>,
) {
    const [owned, setOwned] = useState<{
        fetcher: JsonFetcher | null;
        state: LiveFeedState<T>;
    }>({ fetcher, state: initialState });
    const state = owned.fetcher === fetcher ? owned.state : initialState;
    const runRef = useRef<() => void>(() => {});
    // parse / updatedAt are read through a ref: callers may pass new
    // closures each render without restarting the loop.
    const optsRef = useRef(options);
    optsRef.current = options;
    const { pollMs } = options;
    const wakeDebounceMs = options.wakeDebounceMs ?? WAKE_DEBOUNCE_MS;

    useEffect(() => {
        if (!fetcher) return;
        let disposed = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let inflight: AbortController | null = null;
        let failures = 0;
        let lastAttempt = 0;
        let succeeded = false;
        let stopped = false;
        /** Updates this fetcher's state (starting from scratch for a new one). */
        const setState = (
            next: (prev: LiveFeedState<T>) => LiveFeedState<T>,
        ) =>
            setOwned((o) => ({
                fetcher,
                state: next(o.fetcher === fetcher ? o.state : initialState),
            }));

        const hidden = () => document.visibilityState === "hidden";

        const schedule = (ms: number) => {
            clearTimeout(timer);
            timer = setTimeout(run, ms);
            return Date.now() + ms;
        };

        async function run() {
            if (disposed || inflight) return;
            clearTimeout(timer);
            timer = undefined;
            // Paused while hidden; the visibility listener resumes us.
            if (hidden()) return;

            lastAttempt = Date.now();
            const ctrl = new AbortController();
            inflight = ctrl;
            const timeout = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
            try {
                const raw = await fetcher!(ctrl.signal);
                const { parse, updatedAt, final } = optsRef.current;
                const parsed = parse(raw);
                if (!parsed) throw new Error("Unexpected response");
                if (disposed) return;
                failures = 0;
                succeeded = true;
                stopped = final?.(parsed) === true;
                const now = Date.now();
                const stamp = parsed.enabled ? updatedAt?.(parsed) : null;
                let age = stamp ? now - Date.parse(stamp) : 0;
                // Negative or huge ages mean client/server clock skew.
                if (!Number.isFinite(age) || age < 0 || age > 5 * 60_000)
                    age = 0;
                setState((prev) => ({
                    status: "live",
                    data: sameContent(prev.data, parsed) ? prev.data : parsed,
                    fetchedAt: now,
                    ageAtFetch: age,
                    failures: 0,
                    retryAt: null,
                }));
                if (pollMs > 0 && !stopped) schedule(pollMs);
            } catch {
                if (disposed) return;
                failures += 1;
                const backoff = Math.min(
                    BACKOFF_MAX_MS,
                    BACKOFF_BASE_MS * 2 ** (failures - 1),
                );
                const delay = Math.round(
                    backoff * (0.85 + Math.random() * 0.3),
                );
                const retryAt = hidden() ? null : schedule(delay);
                setState((prev) => ({
                    ...prev,
                    status: "error",
                    failures,
                    retryAt,
                }));
            } finally {
                clearTimeout(timeout);
                if (inflight === ctrl) inflight = null;
            }
        }

        /** Whether a wake should fetch at all (fetch-once feeds stop after a success, any feed after a `final` answer). */
        const polling = () =>
            !stopped && (pollMs > 0 || !succeeded || failures > 0);

        const wake = () => {
            if (disposed || hidden() || !polling()) return;
            if (Date.now() - lastAttempt < wakeDebounceMs) {
                // Recently fetched: just make sure the loop is alive.
                if (!timer && !inflight)
                    schedule(failures > 0 ? BACKOFF_BASE_MS : pollMs);
                return;
            }
            run();
        };

        const onVisibility = () => {
            if (hidden()) {
                clearTimeout(timer);
                timer = undefined;
            } else {
                wake();
            }
        };

        runRef.current = () => {
            lastAttempt = 0;
            run();
        };

        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("focus", wake);
        window.addEventListener("online", wake);
        run();

        return () => {
            disposed = true;
            clearTimeout(timer);
            inflight?.abort();
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("focus", wake);
            window.removeEventListener("online", wake);
            runRef.current = () => {};
        };
    }, [fetcher, pollMs, wakeDebounceMs]);

    const retryNow = useCallback(() => runRef.current(), []);

    return { ...state, retryNow };
}

/** Re-renders the caller every `ms` while mounted. */
export function useNow(ms = 1000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), ms);
        return () => clearInterval(id);
    }, [ms]);
    return now;
}

/**
 * Resolve a page's data source on the client: the dev-only `?demo=` mock,
 * else the real one. Null until known. Pass the mock loader as
 * `import.meta.env.DEV ? (mode) => import("./demo-data").then(…) : null` so
 * a production build drops the dynamic import and never ships the mock.
 */
export function useDemoOrLive<S extends object>(
    live: () => S,
    demo: ((mode: string) => Promise<S>) | null,
    key: string,
): (S & { demo?: string }) | null {
    const [source, setSource] = useState<(S & { demo?: string }) | null>(
        null,
    );
    const loaders = useRef({ live, demo });
    loaders.current = { live, demo };
    useEffect(() => {
        let cancelled = false;
        const { live, demo } = loaders.current;
        const mode = demo
            ? new URLSearchParams(window.location.search).get("demo")
            : null;
        if (demo && mode) {
            demo(mode).then((s) => {
                if (!cancelled) setSource({ ...s, demo: mode });
            });
        } else {
            setSource(live() as S & { demo?: string });
        }
        return () => {
            cancelled = true;
        };
    }, [key]);
    return source;
}
