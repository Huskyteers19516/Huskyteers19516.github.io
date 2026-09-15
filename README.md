# 🤖 FTC Robotics Team Static Website Template
> Powered by **Astro**, **Tailwind CSS**, and **TypeScript**.  
> Demonstration: **FTC Team 19516 — The Huskyteers** (Season: **BIOBUZZ**, Color: `#126735`).

A modern, ultra-fast, static website template crafted specifically for **FIRST Tech Challenge (FTC)** teams. Designed with **complete separation of content and code**, allowing non-technical team members (Outreach, Business, Media) to update content effortlessly while giving the software team a clean, modular, and extensible codebase.

---

## 🌟 Key Features

1. **⚡ Instant Static Performance**: Built on Astro's static site generation (SSG) with zero runtime bloat. Pages load in under 1 second even on congested tournament venue Wi-Fi.
2. **🎨 1-Click White-Label Re-Skinning**: Dynamically configured via CSS variables and central configuration. Change your team number, name, colors, and season in **one file** (`src/config/site.config.ts`) to re-theme the entire website.
3. **🧩 Modular Feature Toggles**: Enable or disable any page (The Robot, Match Hub, Sponsors, Outreach, Resources) or interactive component by toggling a boolean flag.
4. **🤖 Standout Interactive Components**:
   - **Autonomous Trajectory Visualizer**: 2D interactive competition field with step-by-step waypoint inspection, trajectory playback simulation, and cycle time metrics.
   - **Subsystem & CAD Explorer**: Interactive tabbed subsystem breakdown with mechanical specs, CAD links, and V1 $\rightarrow$ V3 engineering iteration logs.
   - **Match Hub & Live FTC Scout Widget**: Displays season record, OPR efficiency ratings, tournament results, and judged award honors.
   - **Interactive Outreach Filter**: Filter workshops by Bootcamps, FLL Mentorship, and Diversity initiatives with quantified impact metrics.
   - **Live Branding Customizer**: Built-in floating palette drawer for testing colors in real-time.
5. **📁 100% Content Separation**: All text, stats, members, sponsors, and robot specs live in clean JSON files inside `src/data/`. No HTML/CSS knowledge required to update content.

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18+ recommended)
- `npm` or `pnpm`

### Installation & Local Development

```bash
# 1. Clone the repository
git clone https://github.com/YourTeam/ftc-team-website.git
cd ftc-team-website

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Open your browser and visit [http://localhost:4321](http://localhost:4321) to see the live site with hot module reloading.

### Building for Production

```bash
npm run build
```
The compiled, production-ready static HTML/CSS/JS files will be generated in the `dist/` directory.

---

## 🎨 How to Customize for Any Team in 5 Minutes

All global settings, team branding, and feature flags live in **`src/config/site.config.ts`**:

```typescript
// src/config/site.config.ts
export const siteConfig: TeamConfig = {
  number: "19516",
  name: "The Huskyteers",
  tagline: "Innovate. Inspire. Pollinate.",
  season: "2025-2026",
  seasonGame: "BIOBUZZ",
  organization: "Husky Robotics Foundation",
  location: "Seattle, WA, USA",
  contactEmail: "contact@huskyteers19516.org",

  // 🎨 Colors (Theme automatically re-skins everywhere!)
  theme: {
    primaryColor: "#126735",       // Your primary team hex color
    primaryColorLight: "#1ea354",  // Lighter accent
    primaryColorDark: "#0b4020",   // Dark background shade
    accentColor: "#f59e0b",        // Secondary accent (e.g. Gold)
    accentColor2: "#06b6d4",       // Tertiary accent (e.g. Cyan)
    fontFamily: "Inter, sans-serif",
  },

  // 🧩 Feature Flags (Enable/Disable any section)
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
  
  // 🔗 Social Media & External Links
  links: {
    github: "https://github.com/Huskyteers19516",
    onshape: "https://cad.onshape.com",
    ftcScout: "https://ftcscout.org/teams/19516",
    portfolioPdf: "/docs/engineering-portfolio-19516.pdf",
    sponsorshipDeckPdf: "/docs/sponsorship-packet-19516.pdf",
    donationUrl: "https://paypal.me/huskyteers19516",
  },
};
```

---

## 📝 Content Management (For Non-Technical Team Members)

All content is separated into straightforward JSON files in the `src/data/` folder:

| File | What it controls | Who updates it |
| :--- | :--- | :--- |
| **`src/data/team.json`** | Member list, roles, grades, quotes, mentors, and alumni | Business / Leadership |
| **`src/data/robot.json`** | Robot name, specs (weight, speed), subsystem breakdown, CAD links, iteration changelog | Mechanical & CAD Lead |
| **`src/data/autonomous.json`**| Auto routes, waypoints, coordinates ($x, y$), actions, and point values | Software Lead |
| **`src/data/matches.json`** | Match record (W-L-T), OPR score, tournament history, and awards won | Scouting & Strategy |
| **`src/data/outreach.json`** | Total community hours, students reached, workshop history | Outreach Lead |
| **`src/data/sponsors.json`** | Sponsorship tiers, benefits, sponsor logo list, tax exemption info | Business / Finance |
| **`src/data/resources.json`**| Open-source CAD files, GitHub repos, and engineering whitepapers | Documentation Lead |

### Example: Adding a New Team Member (`src/data/team.json`)
```json
{
  "name": "Alex Johnson",
  "role": "Autonomous Software Engineer",
  "subteam": "Software",
  "grade": "11th Grade",
  "quote": "Bézier curves make autonomous flawless.",
  "favoriteMechanism": "Pinpoint Odometry"
}
```

### Example: Adding a Tournament Result (`src/data/matches.json`)
```json
{
  "name": "Cascade Championship",
  "date": "February 21, 2026",
  "venue": "ShoWare Center, Kent, WA",
  "rank": "Rank 1 (Captain)",
  "record": "7-1-0",
  "awards": ["Inspire Award 1st Place", "Winning Alliance Captain"],
  "status": "Completed"
}
```

---

## 📂 Source Code Map

```
src/
├── config/
│   └── site.config.ts            # Central team profile, colors, links & feature flags
├── data/                          # Content data files (JSON)
│   ├── autonomous.json           # Auto routines & waypoints
│   ├── matches.json              # Matches, OPR & awards
│   ├── outreach.json             # Workshops & impact metrics
│   ├── resources.json            # Open-source CAD & papers
│   ├── robot.json                # Robot specs & subsystems
│   ├── sponsors.json             # Tiers & donor logos
│   └── team.json                 # Roster, mentors & alumni
├── components/
│   ├── common/
│   │   ├── Header.astro          # Responsive navigation & mobile menu
│   │   ├── Footer.astro          # Site footer & FIRST disclaimers
│   │   ├── Hero.astro            # High-impact hero with quick stats
│   │   ├── Icon.astro            # Lightweight SVG icon system
│   │   └── ThemeConfigurator.astro # Live color preview drawer
│   ├── robot/
│   │   ├── AutonomousVisualizer.astro # Interactive 2D field trajectory simulator
│   │   └── SubsystemViewer.astro      # Subsystem inspector & CAD card
│   ├── matches/
│   │   └── FtcScoutWidget.astro  # OPR, win rate meter & event cards
│   ├── outreach/
│   │   └── ImpactMap.astro       # Impact stats & workshop filter
│   ├── team/
│   │   └── MemberCard.astro      # Roster card with subteam tags
│   └── sponsors/
│       └── SponsorTierCard.astro # Tier breakdown & benefits
├── layouts/
│   └── Layout.astro              # Base HTML wrapper with dynamic CSS theme variables
└── pages/
    ├── index.astro               # Landing page
    ├── robot.astro               # Robot & Auto page
    ├── outreach.astro            # Community impact page
    ├── matches.astro             # Match results & awards page
    ├── team.astro                # Team roster page
    ├── sponsors.astro            # Sponsorship deck page
    └── resources.astro           # Open-source downloads page
```

---

## 🚢 Free 1-Click Deployment Options

### Option 1: GitHub Pages (Recommended for FTC Teams)
1. Push your code to a GitHub repository.
2. In GitHub repository settings, go to **Settings $\rightarrow$ Pages**.
3. Under **Build and deployment $\rightarrow$ Source**, select **GitHub Actions**.
4. Astro automatically provides a standard GitHub Actions workflow for zero-config deployment.

### Option 2: Vercel / Cloudflare Pages
1. Connect your GitHub repository to [Vercel](https://vercel.com) or [Cloudflare Pages](https://pages.cloudflare.com).
2. Framework Preset: `Astro`.
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. Click **Deploy**.

---

## 📄 License & Attribution
Distributed under the MIT License. FIRST®, FIRST® Tech Challenge, and FIRST® Robotics are trademarks of For Inspiration and Recognition of Science and Technology (FIRST®).
