/**
 * Outreach events on the Outreach Events page (src/pages/events.astro),
 * in the order they're shown.
 *
 * Photos are picked up at build time: drop them in
 * src/assets/images/outreach/<slug>/ (png, jpg, jpeg or webp) and they show
 * in the card's carousel in file-name order ("01.jpg", "02.jpg", ...).
 * An event with no photos yet shows a "Photos coming soon" placeholder.
 */
import type { ImageMetadata } from "astro";

export interface OutreachEvent {
    /** Folder name in src/assets/images/outreach/, also the card's id. */
    slug: string;
    title: string;
    /** Shown as written, e.g. "March 14, 2026" or "Summer 2026". Hidden when empty. */
    date: string;
    location?: string;
    description: string;
}

// TODO: fill in the real dates, and check each description, before publishing.
export const OUTREACH_EVENTS: OutreachEvent[] = [
    {
        slug: "gigis-playhouse",
        title: "Volunteering at GiGi's Playhouse",
        date: "",
        location: "GiGi's Playhouse",
        description:
            "Our team volunteered at GiGi's Playhouse, a Down syndrome achievement center, helping run activities for the kids and families in their programs.",
    },
    {
        slug: "anaheim-public-library",
        title: "Intro to 3D CAD and 3D printing",
        date: "Summer 2026",
        location: "Anaheim Public Library Makerspace",
        description:
            "Our team taught elementary school students how to design in 3D CAD and how to use a 3D printer. We used simple parts from our own robot as examples, so kids could see how real designs go from a screen to something they can hold. It was a hands-on way to share FIRST Robotics with the community and spark an interest in engineering.",
    },
    {
        slug: "husky-preview-day",
        title: "Husky Preview Day",
        date: "",
        location: "Fairmont Preparatory Academy",
        description:
            "We showed our robot to prospective students and their families at Husky Preview Day and talked about what it's like to be on a FIRST Tech Challenge team.",
    },
    {
        slug: "dogbot-1",
        title: "DogBot Event #1",
        date: "",
        description: "Details coming soon.",
    },
    {
        slug: "dogbot-2",
        title: "DogBot Event #2",
        date: "",
        description: "Details coming soon.",
    },
    {
        slug: "dogbot-3",
        title: "DogBot Event #3",
        date: "",
        description: "Details coming soon.",
    },
];

const FILES = import.meta.glob<{ default: ImageMetadata }>(
    "/src/assets/images/outreach/*/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}",
    { eager: true },
);

/** The photos in src/assets/images/outreach/<slug>/, in file-name order. */
export function photosFor(slug: string): ImageMetadata[] {
    const prefix = `/src/assets/images/outreach/${slug}/`;
    return Object.keys(FILES)
        .filter((path) => path.startsWith(prefix))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((path) => FILES[path].default);
}
