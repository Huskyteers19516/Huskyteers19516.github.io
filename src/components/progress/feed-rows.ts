import type { ProgressRecent } from "./types";

/** One line of the "Recent completions" feed (possibly several items). */
export interface FeedRow {
    /** Stable while new items arrive at the top (counted from the oldest). */
    key: string;
    title: string | null;
    subteam: string | null;
    who: string | null;
    /** The newest item's time. */
    at: string;
    /** Items in this row: more than 1 only for merged untitled items. */
    count: number;
}

/**
 * The feed's rows, newest first. When the portal hides task titles, items
 * next to each other from the same subteam and person (or both unnamed) are
 * merged into one row ("Build finished 3 items") instead of repeating the
 * same untitled line.
 */
export function feedRows(recent: ProgressRecent[]): FeedRow[] {
    // Keys count duplicates from the oldest end, so rows already on screen
    // keep their keys when newer ones are added above them.
    const seen = new Map<string, number>();
    const keys: string[] = new Array(recent.length);
    for (let i = recent.length - 1; i >= 0; i--) {
        const r = recent[i];
        const base = `${r.at}|${r.title ?? ""}|${r.who ?? ""}|${r.subteam ?? ""}`;
        const k = seen.get(base) ?? 0;
        seen.set(base, k + 1);
        keys[i] = `${base}|${k}`;
    }

    const rows: FeedRow[] = [];
    recent.forEach((r, i) => {
        const prev = rows.at(-1);
        if (
            prev &&
            prev.title === null &&
            r.title === null &&
            prev.subteam === r.subteam &&
            prev.who === r.who
        ) {
            prev.count += 1;
            // Keep the oldest item's key: stable as new items merge in on top.
            prev.key = keys[i];
            return;
        }
        rows.push({ ...r, key: keys[i], count: 1 });
    });
    return rows;
}

/** "an item" / "3 items". */
export function itemCount(n: number): string {
    return n === 1 ? "an item" : `${n} items`;
}

/** The headline of an untitled row: "Build finished 3 items". */
export function untitledHeadline(
    row: Pick<FeedRow, "who" | "count">,
    subteamLabel: string | null,
): string {
    const subject = row.who ?? subteamLabel ?? "The team";
    return `${subject} finished ${itemCount(row.count)}`;
}
