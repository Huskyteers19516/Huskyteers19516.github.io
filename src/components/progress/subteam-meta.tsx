import { BriefcaseBusiness, CodeXml, Layers, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const META: Record<string, { label: string; icon: LucideIcon; blurb: string }> =
    {
        BUILD: {
            label: "Build",
            icon: Wrench,
            blurb: "CAD, machining & assembly",
        },
        SOFTWARE: {
            label: "Software",
            icon: CodeXml,
            blurb: "Autonomous, TeleOp & vision",
        },
        BUSINESS: {
            label: "Business",
            icon: BriefcaseBusiness,
            blurb: "Outreach, sponsors & portfolio",
        },
    };

export function subteamMeta(key: string | null, name?: string) {
    const m = key ? META[key] : undefined;
    return {
        label:
            name ||
            m?.label ||
            (key ? key.charAt(0) + key.slice(1).toLowerCase() : "Team"),
        icon: m?.icon ?? Layers,
        blurb: m?.blurb ?? "",
    };
}
