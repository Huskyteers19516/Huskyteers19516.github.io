import { useCallback, useEffect, useState } from "react";
import {
    parseWorkshop,
    portalResolver,
    type AssetResolver,
    type WorkshopData,
} from "./types";

/** Fetches one raw (unvalidated) payload. */
export type WorkshopFetcher = (signal: AbortSignal) => Promise<unknown>;

export interface WorkshopSource {
    fetcher: WorkshopFetcher;
    resolve: AssetResolver;
    /** Set when serving dev-only demo data (the ?demo= value). */
    demo?: string;
}

/** The portal may be cold-starting; give it a while before giving up. */
const REQUEST_TIMEOUT_MS = 20_000;

export function portalFetcher(portalUrl: string): WorkshopFetcher {
    const endpoint = `${portalUrl.replace(/\/+$/, "")}/api/public/workshop`;
    return async (signal) => {
        const res = await fetch(endpoint, {
            signal,
            mode: "cors",
            credentials: "omit",
            headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    };
}

/** Resolve the data source on the client (dev-only ?demo= mock, else the portal). */
export function useWorkshopSource(portalUrl: string): WorkshopSource | null {
    const [source, setSource] = useState<WorkshopSource | null>(null);
    useEffect(() => {
        let cancelled = false;
        // Same convention as the Progress page: ?demo=<mode>, dev server only.
        // A bare ?demo means ?demo=1.
        const params = new URLSearchParams(window.location.search);
        const demo =
            import.meta.env.DEV && params.has("demo")
                ? params.get("demo") || "1"
                : null;
        if (import.meta.env.DEV && demo) {
            import("./demo-data").then(({ createDemoFetcher }) => {
                if (!cancelled) {
                    setSource({
                        fetcher: createDemoFetcher(demo),
                        resolve: (path) =>
                            path.startsWith("data:") || path === "#"
                                ? path
                                : null,
                        demo,
                    });
                }
            });
        } else {
            setSource({
                fetcher: portalFetcher(portalUrl),
                resolve: portalResolver(portalUrl),
            });
        }
        return () => {
            cancelled = true;
        };
    }, [portalUrl]);
    return source;
}

export type WorkshopState =
    | { status: "loading"; data: null }
    | { status: "ready"; data: WorkshopData }
    | { status: "error"; data: null };

/** Fetches the workshop once (and again on `retry`); aborts on unmount. */
export function useWorkshop(source: WorkshopSource | null) {
    const [state, setState] = useState<WorkshopState>({
        status: "loading",
        data: null,
    });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!source) return;
        const ctrl = new AbortController();
        let active = true;
        const timeout = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
        source
            .fetcher(ctrl.signal)
            .then((raw) => {
                const data = parseWorkshop(raw, source.resolve);
                if (!data) throw new Error("Unexpected response");
                if (active) setState({ status: "ready", data });
            })
            .catch(() => {
                if (active) setState({ status: "error", data: null });
            })
            .finally(() => clearTimeout(timeout));
        return () => {
            active = false;
            clearTimeout(timeout);
            ctrl.abort();
        };
    }, [source, attempt]);

    const retry = useCallback(() => {
        setState({ status: "loading", data: null });
        setAttempt((n) => n + 1);
    }, []);

    return { ...state, retry };
}

/* ------------------------------------------------------------------ */

function readHash(): string {
    const raw = window.location.hash.slice(1);
    if (!raw) return "";
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

/**
 * Tags the history entries `open` pushes. The tag survives Forward and
 * reloads, and the entry before a tagged one is always this page (still the
 * same document after a reload: Back fires popstate, not a page load).
 */
const HISTORY_KEY = "workshopProject";

/**
 * The URL hash as the source of truth for which project dialog is open.
 * `open` pushes a history entry (so Back closes the dialog); `clear` pops it
 * again (also when it was reached with Forward or reloaded), or just strips
 * the hash for a deep link.
 */
export function useHashRoute() {
    const [hash, setHash] = useState("");

    useEffect(() => {
        const sync = () => setHash(readHash());
        sync();
        window.addEventListener("hashchange", sync);
        window.addEventListener("popstate", sync);
        return () => {
            window.removeEventListener("hashchange", sync);
            window.removeEventListener("popstate", sync);
        };
    }, []);

    const open = useCallback((id: string) => {
        if (readHash() === id) {
            setHash(id);
            return;
        }
        const { pathname, search } = window.location;
        window.history.pushState(
            { [HISTORY_KEY]: id },
            "",
            `${pathname}${search}#${encodeURIComponent(id)}`,
        );
        setHash(id);
    }, []);

    const clear = useCallback((id: string) => {
        if (readHash() !== id) return; // Already gone (e.g. Back was pressed).
        const state = window.history.state as Record<string, unknown> | null;
        setHash("");
        if (state?.[HISTORY_KEY] === id) {
            window.history.back();
        } else {
            const { pathname, search } = window.location;
            window.history.replaceState(null, "", `${pathname}${search}`);
        }
    }, []);

    return { hash, open, clear };
}
