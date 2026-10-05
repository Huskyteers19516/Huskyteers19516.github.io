import { CalendarDays, Flag, HeartHandshake, Medal, Swords, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import type { PublicEventKind } from "./types";

const ICONS: Record<PublicEventKind, LucideIcon> = {
    MEET: Flag,
    ILT: Trophy,
    SCRIMMAGE: Swords,
    COMPETITION: Medal,
    OUTREACH: HeartHandshake,
};

export const kindIcon = (kind: PublicEventKind): LucideIcon =>
    ICONS[kind] ?? CalendarDays;

/**
 * The kind's icon in a tinted square. Colors come from `[data-kind]` in
 * src/styles/events.css (green meets, amber ILT, blue scrimmages, violet
 * competitions, rose outreach).
 */
export function KindBadge({
    kind,
    className,
    iconClassName,
}: {
    kind: PublicEventKind;
    className?: string;
    iconClassName?: string;
}) {
    const Icon = kindIcon(kind);
    return (
        <span
            data-kind={kind}
            className={cn(
                "ev-kind-icon grid size-8 shrink-0 place-items-center rounded-lg",
                className,
            )}
            aria-hidden="true"
        >
            <Icon className={cn("size-4", iconClassName)} />
        </span>
    );
}

/** Small "League meet" pill with the kind's dot. */
export function KindTag({
    kind,
    label,
    className,
}: {
    kind: PublicEventKind;
    label: string;
    className?: string;
}) {
    return (
        <span
            data-kind={kind}
            className={cn(
                "ev-kind-tag inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[0.6875rem] font-medium uppercase tracking-wider",
                className,
            )}
        >
            <span
                className="ev-kind-dot size-1.5 shrink-0 rounded-full"
                aria-hidden="true"
            />
            {label}
        </span>
    );
}
