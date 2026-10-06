/**
 * The portal's team photos (./portal-photos.ts) for a React island: the
 * Our Team page (team-live.tsx) and /progress (live-progress.tsx).
 *
 * Fetched once on load and then every 5 minutes while the tab is visible
 * (a photo someone took off the website disappears from an open page too);
 * errors retry with backoff. Until the answer arrives, when it fails, or when
 * the owner turned photos off, the index is empty and every card keeps what
 * it has (the build-time photo or initials) — the portal photo is only ever
 * an addition.
 */
import { useCallback, useMemo } from "react";
import {
    portalJsonFetcher,
    useLiveFeed,
    type JsonFetcher,
} from "../progress/use-live-feed";
import {
    NO_PHOTOS,
    parseTeamPhotos,
    photoIndex,
    TEAM_PHOTOS_PATH,
    teamPhotosFetcher,
    type PhotoIndex,
    type TeamPhotosPayload,
} from "./portal-photos";

const POLL_MS = 5 * 60_000;

/**
 * The live list's fetcher. The portal caches the JSON for 15 s on its CDN;
 * a 1-minute bucket keeps visitors on one shared CDN entry per minute.
 */
export function livePhotosFetcher(portalUrl: string): JsonFetcher {
    return teamPhotosFetcher(
        portalJsonFetcher(portalUrl, TEAM_PHOTOS_PATH, 60_000),
    );
}

/**
 * Photo URL by name key (look people up with `portalPhotoFor`, which hashes
 * their full name like the portal). `fetcher` null:
 * idle (the data source isn't known yet). `resolve` maps each URL (the dev
 * demo's generated pictures).
 */
export function useTeamPhotos(
    fetcher: JsonFetcher | null,
    portalUrl: string,
    resolve?: (src: string) => string,
): PhotoIndex {
    const parse = useCallback(
        (raw: unknown) => parseTeamPhotos(raw, portalUrl),
        [portalUrl],
    );
    const feed = useLiveFeed<TeamPhotosPayload>(fetcher, {
        parse,
        pollMs: POLL_MS,
        // Turned off (or a portal without photos): nothing to poll for.
        final: (p) => !p.enabled,
    });
    const data = feed.data;
    return useMemo(
        () => (data?.enabled ? photoIndex(data.photos, resolve) : NO_PHOTOS),
        [data, resolve],
    );
}
