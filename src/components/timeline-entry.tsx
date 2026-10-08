/*
 * Every text and the logo here are "Website Coding" slots, keyed by the
 * season: season.<yyyy-yyyy>.title / .label / .status / .award-<n> / .logo.
 * Admins change them in the Teammate Portal (Admin -> Website Coding); the
 * props below are the defaults.
 */

function SeasonLogo({
    logo,
    title,
    season,
}: {
    logo: string;
    title: string;
    season: string;
}) {
    return (
        <div className="h-20 w-28 shrink-0 rounded-lg bg-white p-2 flex items-center justify-center shadow-sm">
            <img
                src={logo}
                alt={`${title} logo`}
                className="max-h-full max-w-full object-contain"
                data-edit-image={`season.${season}.logo`}
                data-edit-label={`Season ${season}: game logo`}
                loading="lazy"
            />
        </div>
    );
}

function AwardChips({
    season,
    awards,
    status,
}: {
    season: string;
    awards?: string[];
    status?: string;
}) {
    if (!status && !awards?.length) return null;
    return (
        <ul className="flex flex-wrap gap-1.5">
            {status && (
                <li
                    className="badge badge-sm badge-primary badge-soft"
                    data-edit-text={`season.${season}.status`}
                    data-edit-label={`Season ${season}: status`}
                >
                    {status}
                </li>
            )}
            {awards?.map((award, i) => (
                <li
                    key={award}
                    className="badge badge-sm badge-ghost h-auto py-0.5 text-muted-foreground"
                    data-edit-text={`season.${season}.award-${i + 1}`}
                    data-edit-label={`Season ${season}: award ${i + 1}`}
                >
                    {award}
                </li>
            ))}
        </ul>
    );
}

export default function TimelineEntry({
    season,
    title,
    logo,
    awards,
    status,
    children,
}: {
    season: string;
    title: string;
    logo?: string;
    awards?: string[];
    status?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex justify-start pt-10 md:pt-32 md:gap-10">
            <div className="sticky flex flex-col md:flex-row z-40 items-center top-40 self-start max-w-xs lg:max-w-sm md:w-full">
                <div className="h-10 absolute left-3 md:left-3 w-10 rounded-full bg-background flex items-center justify-center">
                    <div className="h-4 w-4 rounded-full bg-muted border border-muted-foreground p-2" />
                </div>
                <div className="hidden md:flex flex-col gap-2 md:pl-20">
                    {logo && (
                        <SeasonLogo logo={logo} title={title} season={season} />
                    )}
                    <h3
                        className="text-lg md:text-2xl font-bold text-primary mt-1"
                        data-edit-text={`season.${season}.label`}
                        data-edit-label={`Season ${season}: season name`}
                    >
                        {season}
                    </h3>
                    <h3
                        className="text-xl md:text-4xl font-bold text-muted-foreground"
                        data-edit-text={`season.${season}.title`}
                        data-edit-label={`Season ${season}: game title`}
                    >
                        {title}
                    </h3>
                    <AwardChips season={season} awards={awards} status={status} />
                </div>
            </div>

            <div className="relative pl-20 pr-4 md:pl-4 w-full">
                <div className="md:hidden flex flex-col gap-2 mb-4">
                    {logo && (
                        <SeasonLogo logo={logo} title={title} season={season} />
                    )}
                    <h3
                        className="text-xl text-left font-bold text-primary"
                        data-edit-text={`season.${season}.label`}
                        data-edit-label={`Season ${season}: season name`}
                    >
                        {season}
                    </h3>
                    <h3
                        className="text-2xl text-left font-bold text-muted-foreground"
                        data-edit-text={`season.${season}.title`}
                        data-edit-label={`Season ${season}: game title`}
                    >
                        {title}
                    </h3>
                    <AwardChips season={season} awards={awards} status={status} />
                </div>
                {children}
            </div>
        </div>
    );
}
