export interface TeamConfig {
  number: string;
  name: string;
  tagline: string;
  season: string;
  seasonGame: string;
  organization: string;
  location: string;
  foundedYear: number;
  contactEmail: string;
  
  // Branding & Colors (Easily reskinned)
  theme: {
    primaryColor: string;      // Hex code, e.g. '#126735'
    primaryColorLight: string; // Lighter variant for highlights
    primaryColorDark: string;  // Darker variant for backgrounds
    accentColor: string;       // Secondary accent (e.g. Gold/Yellow)
    accentColor2: string;      // Tertiary accent (e.g. Cyan/Blue)
    fontFamily: string;
  };

  // Social & External Links
  links: {
    github?: string;
    onshape?: string;
    ftcScout?: string;
    theBlueAlliance?: string;
    youtube?: string;
    instagram?: string;
    portfolioPdf?: string;
    sponsorshipDeckPdf?: string;
    donationUrl?: string;
  };

  // Feature Toggles (Enable or disable whole pages or individual interactive widgets)
  features: {
    robotShowcase: boolean;
    autonomousVisualizer: boolean;
    subsystemInspector: boolean;
    outreachMap: boolean;
    outreachTimeline: boolean;
    ftcScoutLiveWidget: boolean;
    awardsShowcase: boolean;
    teamRoster: boolean;
    alumniSpotlight: boolean;
    sponsorsGrid: boolean;
    sponsorshipTiers: boolean;
    resourcesDownloads: boolean;
    liveThemeCustomizer: boolean; // Interactive demo drawer for quick reskin preview
  };

  // Quick stats showcased on the homepage
  stats: {
    label: string;
    value: string;
    subtext?: string;
  }[];
}

export const siteConfig: TeamConfig = {
  number: "19516",
  name: "The Huskyteers",
  tagline: "Innovate. Inspire. Pollinate.",
  season: "2025-2026",
  seasonGame: "BIOBUZZ",
  organization: "Husky Robotics Foundation / High School",
  location: "Seattle, WA, USA",
  foundedYear: 2021,
  contactEmail: "contact@huskyteers19516.org",

  theme: {
    primaryColor: "#126735",       // Deep Husky Green
    primaryColorLight: "#1ea354",  // Vibrant Green
    primaryColorDark: "#0b4020",   // Dark Forest
    accentColor: "#f59e0b",        // Honey Amber / Pollen Gold
    accentColor2: "#06b6d4",       // Nectar Cyan
    fontFamily: "Inter, sans-serif",
  },

  links: {
    github: "https://github.com/Huskyteers19516",
    onshape: "https://cad.onshape.com",
    ftcScout: "https://ftcscout.org/teams/19516",
    theBlueAlliance: "https://www.thebluealliance.com",
    youtube: "https://youtube.com/@huskyteers19516",
    instagram: "https://instagram.com/huskyteers19516",
    portfolioPdf: "/docs/engineering-portfolio-19516.pdf",
    sponsorshipDeckPdf: "/docs/sponsorship-packet-19516.pdf",
    donationUrl: "https://paypal.me/huskyteers19516",
  },

  features: {
    robotShowcase: true,
    autonomousVisualizer: true,
    subsystemInspector: true,
    outreachMap: true,
    outreachTimeline: true,
    ftcScoutLiveWidget: true,
    awardsShowcase: true,
    teamRoster: true,
    alumniSpotlight: true,
    sponsorsGrid: true,
    sponsorshipTiers: true,
    resourcesDownloads: true,
    liveThemeCustomizer: true,
  },

  stats: [
    { label: "Season Record", value: "18-2-0", subtext: "Regional Finalists" },
    { label: "OPR Rating", value: "88.4", subtext: "Top 5% Worldwide" },
    { label: "Students Reached", value: "650+", subtext: "14 STEM Workshops" },
    { label: "Award Honors", value: "9 Trophies", subtext: "Think & Connect Awards" },
  ],
};

export const navItems = [
  { label: "Home", href: "/" },
  ...(siteConfig.features.robotShowcase ? [{ label: "The Robot", href: "/robot" }] : []),
  ...(siteConfig.features.outreachTimeline || siteConfig.features.outreachMap ? [{ label: "Outreach", href: "/outreach" }] : []),
  ...(siteConfig.features.ftcScoutLiveWidget || siteConfig.features.awardsShowcase ? [{ label: "Matches & Awards", href: "/matches" }] : []),
  ...(siteConfig.features.teamRoster ? [{ label: "Team", href: "/team" }] : []),
  ...(siteConfig.features.sponsorsGrid ? [{ label: "Sponsors", href: "/sponsors" }] : []),
  ...(siteConfig.features.resourcesDownloads ? [{ label: "Resources", href: "/resources" }] : []),
];
