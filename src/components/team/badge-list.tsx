/**
 * A teammate's badges in their profile dialog: the same list (and the same
 * `.team-badge*` styles) as BadgeList.astro draws on their card.
 */
import {
    Bot,
    Camera,
    CodeXml,
    Cog,
    Cpu,
    Crown,
    DraftingCompass,
    Gamepad2,
    Globe,
    Handshake,
    Megaphone,
    NotebookPen,
    Package,
    Palette,
    Presentation,
    Route,
    Sparkles,
    Trophy,
    Users,
    Wrench,
    type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { BadgeIcon, ShownBadge } from "./badges";

const ICONS: Record<BadgeIcon, LucideIcon> = {
    crown: Crown,
    cpu: Cpu,
    wrench: Wrench,
    cog: Cog,
    compass: DraftingCompass,
    package: Package,
    code: CodeXml,
    bot: Bot,
    route: Route,
    gamepad: Gamepad2,
    globe: Globe,
    notebook: NotebookPen,
    presentation: Presentation,
    megaphone: Megaphone,
    handshake: Handshake,
    palette: Palette,
    camera: Camera,
    trophy: Trophy,
    users: Users,
    sparkles: Sparkles,
};

export function BadgeList({
    badges,
    className,
}: {
    badges: readonly ShownBadge[];
    className?: string;
}) {
    if (badges.length === 0) return null;
    return (
        <ul className={cn("team-badges", className)} aria-label="Badges">
            {badges.map(({ title, description, icon, tone }) => {
                const Icon = ICONS[icon];
                return (
                    <li key={title} className="team-badge" data-tone={tone}>
                        <span className="team-badge-icon" aria-hidden="true">
                            <Icon size={18} />
                        </span>
                        <span className="team-badge-text">
                            <span className="team-badge-title">{title}</span>
                            {description && (
                                <span className="team-badge-desc">{description}</span>
                            )}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
