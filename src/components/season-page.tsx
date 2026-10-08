import { Bot, Users } from "lucide-react";

const mediaClass =
    "rounded-lg object-cover w-full h-full shadow-[0_0_24px_rgba(34,42,53,0.06),0_1px_1px_rgba(0,0,0,0.05),0_0_0_1px_rgba(34,42,53,0.04),0_0_4px_rgba(34,42,53,0.08),0_16px_68px_rgba(47,48,55,0.05),0_1px_0_rgba(255,255,255,0.1)_inset]";

function Placeholder({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="rounded-lg w-full h-full bg-base-200 border border-dashed border-base-300 flex flex-col items-center justify-center gap-2 p-2 text-center text-muted-foreground text-xs sm:text-sm">
            {icon}
            {label}
        </div>
    );
}

/**
 * The two pictures under a season on the home page. Both are "Website Coding"
 * image slots (season.<yyyy-yyyy>.team-photo / .robot-photo): a photo
 * uploaded in the portal (Admin -> Website Coding) replaces the built-in
 * picture or the "coming soon" placeholder, no rebuild needed.
 */
export default function SeasonPage({
    season,
    href,
    teamImage,
    robotImage,
    robotVideo,
}: {
    /** "2025-2026": names the season's editable photo slots. */
    season: string;
    href: string;
    teamImage?: string;
    robotImage?: string;
    robotVideo?: string;
}) {
    return (
        <a
            href={href}
            className="grid grid-cols-5 grid-rows-1 gap-2 sm:gap-3 h-40 sm:h-56 lg:h-64"
        >
            <div
                className="col-span-3 h-full min-h-0"
                data-edit-image={`season.${season}.team-photo`}
                data-edit-label={`Season ${season}: team photo`}
                data-edit-img-class={mediaClass}
            >
                {teamImage ? (
                    <img
                        src={teamImage}
                        alt="Team photo"
                        className={mediaClass}
                        loading="lazy"
                    />
                ) : (
                    <Placeholder
                        icon={<Users className="size-6" />}
                        label="Team photo coming soon"
                    />
                )}
            </div>
            <div
                className="col-span-2 h-full min-h-0"
                data-edit-image={`season.${season}.robot-photo`}
                data-edit-label={`Season ${season}: robot photo`}
                data-edit-img-class={mediaClass}
            >
                {robotImage ? (
                    <img
                        src={robotImage}
                        alt="Robot photo"
                        className={mediaClass}
                        loading="lazy"
                    />
                ) : robotVideo ? (
                    <video autoPlay muted loop playsInline className={mediaClass}>
                        <source src={robotVideo} type="video/mp4" />
                        Your browser does not support the video tag.
                    </video>
                ) : (
                    <Placeholder
                        icon={<Bot className="size-6" />}
                        label="Robot photo coming soon"
                    />
                )}
            </div>
        </a>
    );
}
