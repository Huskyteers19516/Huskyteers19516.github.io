# The Huskyteers website (FTC 19516)

## How to change website text and photos (no coding needed)

Almost every text, link and picture on this website can be changed from the
**Teammate Portal → Admin → Website Coding**. You don't need to know
TypeScript, edit this repository or wait for a rebuild:

1. Open the portal, go to **Admin → Website Coding**. The website opens in a
   preview inside the portal.
2. Move the mouse over the site: everything you can change gets a green
   dashed outline and a small label. **Click it** to select it. (To follow a
   link that is itself editable, hold **Alt/Option** while clicking. Ordinary
   links keep working and stay in the editor.)
3. Type the new text, paste the new link, or upload a photo (PNG, JPG or WebP,
   up to 4 MB; location data is removed automatically). The preview updates as
   you type.
4. Save. Visitors see the change within about a minute.
5. **Reset** puts back the original text or picture that's built into the site.

Empty photo spots ("Team photo coming soon", "Photos coming soon", mentor
photos) show **"Click to add a photo"** in the editor: click one and upload.
A date or location left empty on an outreach event stays hidden until you
fill it in. Line breaks you type in paragraphs are kept.

Not editable here: the people on the Our Team page (names/positions are in
`src/pages/about/team.astro`; photos come from each teammate's portal
photo, see below) and the live parts that already come from the portal
(progress, workshop, event schedule, sponsor logos — those are managed in
their own portal pages).

If the portal is down, the site simply shows its built-in text and pictures.

### For developers: making something editable

Give the element a slot key and a human label; what's in the markup is the
default value:

```astro
<h2 data-edit-text="sponsors.ask.title" data-edit-label="Sponsors: Sponsor Us heading">Sponsor Us</h2>
<p data-edit-text="home.hero.tagline" data-edit-label="Home: tagline" data-edit-multiline>…</p>
<a href="https://…" data-edit-link="footer.socials.github" data-edit-label="Footer: GitHub link">…</a>
<img src={x.src} alt="…" data-edit-image="contact.team-photo" data-edit-label="Contact: team photo" />
<div data-edit-image="season.2026-2027.team-photo" data-edit-img-class="w-full h-full object-cover">placeholder…</div>
```

- Keys: lowercase letters/digits joined by `.` or `-`, max 120 characters,
  `<page>.<section>.<item>` (`^[a-z0-9]+(?:[.-][a-z0-9]+)*$`). Keep keys
  stable: renaming one loses what admins saved for it.
- `data-edit-text` must be on an element that holds **only text** (wrap the
  words in a `<span>` if there's an icon next to them). Text is applied with
  `textContent`, never as HTML. Add `data-edit-multiline` to paragraphs so
  typed line breaks show.
- `data-edit-link` goes on the `<a>` and changes its `href` (only `https://`,
  `http://`, `mailto:` or a `/path` on this site are accepted).
- `data-edit-image` on an `<img>` replaces its picture; on any other element
  (a "coming soon" box) it replaces the element's contents with an `<img>`
  using the classes in `data-edit-img-class`
  (default `w-full h-full object-cover rounded-lg`).
- `data-edit-optional` + `hidden` on a wrapper hides it until a slot inside
  it gets a value (used for empty event dates/locations and mentor photos).
- In React components pass the key through props (see `season-page.tsx`,
  `timeline-entry.tsx`); the same key may appear several times on a page
  (desktop and phone menus), but always with the same kind.

How it works: `src/components/site-content/SiteContent.astro` (included once
by `src/layouts/Layout.astro`) fetches
`GET <PUBLIC_PORTAL_URL>/api/public/site-content`, applies it and keeps it
applied while React islands re-render; with `?hk-edit=1` inside the portal's
iframe it runs the editor (outlines, click to select, live preview over
`postMessage`, origin-checked both ways). The validation is in
`src/lib/site-content.ts` (tests: `tests/site-content.test.mjs`).

List every slot of the built site (and check keys/kinds):
`npm run build && npm run slots` (`npm run slots -- --markdown` for a table).

<details>
<summary>All slot keys (generated with <code>npm run slots -- --markdown</code>)</summary>

| Key | Kind | Label | Pages |
| --- | --- | --- | --- |
| `404.button` | text | Page not found: button | /404 |
| `404.message` | text | Page not found: message | /404 |
| `contact.discord.cta` | text | Contact: Join our Discord (button text) | /contact |
| `contact.discord.link` | link | Contact: Join our Discord (link) | /contact |
| `contact.discord.text` | text | Contact: Join our Discord (text) | /contact |
| `contact.discord.title` | text | Contact: Join our Discord (title) | /contact |
| `contact.email.cta` | text | Contact: Email Us (button text) | /contact |
| `contact.email.link` | link | Contact: Email Us (link) | /contact |
| `contact.email.text` | text | Contact: Email Us (text) | /contact |
| `contact.email.title` | text | Contact: Email Us (title) | /contact |
| `contact.instagram.cta` | text | Contact: Follow us on Instagram (button text) | /contact |
| `contact.instagram.link` | link | Contact: Follow us on Instagram (link) | /contact |
| `contact.instagram.text` | text | Contact: Follow us on Instagram (text) | /contact |
| `contact.instagram.title` | text | Contact: Follow us on Instagram (title) | /contact |
| `contact.team-photo` | image | Contact: team photo | /contact |
| `contact.title` | text | Contact: page title | /contact |
| `events.anaheim-public-library.date` | text | Outreach: Intro to 3D CAD and 3D printing (date) | /events |
| `events.anaheim-public-library.description` | text | Outreach: Intro to 3D CAD and 3D printing (description) | /events |
| `events.anaheim-public-library.location` | text | Outreach: Intro to 3D CAD and 3D printing (location) | /events |
| `events.anaheim-public-library.photo` | image | Outreach: Intro to 3D CAD and 3D printing (photo) | /events |
| `events.anaheim-public-library.title` | text | Outreach: Intro to 3D CAD and 3D printing (title) | /events |
| `events.dogbot-1.date` | text | Outreach: DogBot Event #1 (date) | /events |
| `events.dogbot-1.description` | text | Outreach: DogBot Event #1 (description) | /events |
| `events.dogbot-1.location` | text | Outreach: DogBot Event #1 (location) | /events |
| `events.dogbot-1.photo` | image | Outreach: DogBot Event #1 (photo) | /events |
| `events.dogbot-1.title` | text | Outreach: DogBot Event #1 (title) | /events |
| `events.dogbot-2.date` | text | Outreach: DogBot Event #2 (date) | /events |
| `events.dogbot-2.description` | text | Outreach: DogBot Event #2 (description) | /events |
| `events.dogbot-2.location` | text | Outreach: DogBot Event #2 (location) | /events |
| `events.dogbot-2.photo` | image | Outreach: DogBot Event #2 (photo) | /events |
| `events.dogbot-2.title` | text | Outreach: DogBot Event #2 (title) | /events |
| `events.dogbot-3.date` | text | Outreach: DogBot Event #3 (date) | /events |
| `events.dogbot-3.description` | text | Outreach: DogBot Event #3 (description) | /events |
| `events.dogbot-3.location` | text | Outreach: DogBot Event #3 (location) | /events |
| `events.dogbot-3.photo` | image | Outreach: DogBot Event #3 (photo) | /events |
| `events.dogbot-3.title` | text | Outreach: DogBot Event #3 (title) | /events |
| `events.gigis-playhouse.date` | text | Outreach: Volunteering at GiGi's Playhouse (date) | /events |
| `events.gigis-playhouse.description` | text | Outreach: Volunteering at GiGi's Playhouse (description) | /events |
| `events.gigis-playhouse.location` | text | Outreach: Volunteering at GiGi's Playhouse (location) | /events |
| `events.gigis-playhouse.photo` | image | Outreach: Volunteering at GiGi's Playhouse (photo) | /events |
| `events.gigis-playhouse.title` | text | Outreach: Volunteering at GiGi's Playhouse (title) | /events |
| `events.header.intro` | text | Outreach: intro text | /events |
| `events.header.kicker` | text | Outreach: small line above the title | /events |
| `events.header.title-accent` | text | Outreach: title (green part) | /events |
| `events.header.title-start` | text | Outreach: title (white part) | /events |
| `events.husky-preview-day.date` | text | Outreach: Husky Preview Day (date) | /events |
| `events.husky-preview-day.description` | text | Outreach: Husky Preview Day (description) | /events |
| `events.husky-preview-day.location` | text | Outreach: Husky Preview Day (location) | /events |
| `events.husky-preview-day.photo` | image | Outreach: Husky Preview Day (photo) | /events |
| `events.husky-preview-day.title` | text | Outreach: Husky Preview Day (title) | /events |
| `footer.address.line-1` | text | Footer: address line 1 | every page |
| `footer.address.line-2` | text | Footer: address line 2 | every page |
| `footer.address.link` | link | Footer: address map link | every page |
| `footer.contact.title` | text | Footer: contact heading | every page |
| `footer.copyright` | text | Footer: copyright line (after the year) | every page |
| `footer.email.link` | link | Footer: email link (mailto:…) | every page |
| `footer.email.text` | text | Footer: email address shown | every page |
| `footer.links.about` | text | Footer link: About | every page |
| `footer.links.events` | text | Footer link: Outreach Events | every page |
| `footer.links.home` | text | Footer link: Home | every page |
| `footer.links.progress` | text | Footer link: Live Progress | every page |
| `footer.links.sponsors` | text | Footer link: Sponsors | every page |
| `footer.links.title` | text | Footer: quick links heading | every page |
| `footer.links.workshop` | text | Footer link: Workshop | every page |
| `footer.socials.discord` | link | Footer: Discord link | every page |
| `footer.socials.github` | link | Footer: GitHub link | every page |
| `footer.socials.instagram` | link | Footer: Instagram link | every page |
| `footer.socials.title` | text | Footer: socials heading | every page |
| `footer.socials.youtube` | link | Footer: YouTube link | every page |
| `ftc.basics.text` | text | What is FTC: basics text | /about/ftc |
| `ftc.basics.title` | text | What is FTC: basics heading | /about/ftc |
| `ftc.game.autonomous.text` | text | What is FTC: Autonomous (30 s) (text) | /about/ftc |
| `ftc.game.autonomous.title` | text | What is FTC: Autonomous (30 s) (heading) | /about/ftc |
| `ftc.game.driver.text` | text | What is FTC: Driver-Control (2 min) (text) | /about/ftc |
| `ftc.game.driver.title` | text | What is FTC: Driver-Control (2 min) (heading) | /about/ftc |
| `ftc.game.scoring.text` | text | What is FTC: Scoring (text) | /about/ftc |
| `ftc.game.scoring.title` | text | What is FTC: Scoring (heading) | /about/ftc |
| `ftc.game.strategy.text` | text | What is FTC: Strategic Themes (text) | /about/ftc |
| `ftc.game.strategy.title` | text | What is FTC: Strategic Themes (heading) | /about/ftc |
| `ftc.game.title` | text | What is FTC: game heading | /about/ftc |
| `ftc.participants.first.what` | text | What is FTC: FIRST Organization & Regional Partners (description) | /about/ftc |
| `ftc.participants.first.who` | text | What is FTC: FIRST Organization & Regional Partners (name) | /about/ftc |
| `ftc.participants.mentors.what` | text | What is FTC: Mentors and Coaches (description) | /about/ftc |
| `ftc.participants.mentors.who` | text | What is FTC: Mentors and Coaches (name) | /about/ftc |
| `ftc.participants.students.what` | text | What is FTC: Students (grades 7-12) (description) | /about/ftc |
| `ftc.participants.students.who` | text | What is FTC: Students (grades 7-12) (name) | /about/ftc |
| `ftc.participants.title` | text | What is FTC: who participates heading | /about/ftc |
| `ftc.participants.volunteers.what` | text | What is FTC: Volunteers and Event Staff (description) | /about/ftc |
| `ftc.participants.volunteers.who` | text | What is FTC: Volunteers and Event Staff (name) | /about/ftc |
| `ftc.title` | text | What is FTC: page title | /about/ftc |
| `header.name` | text | Header: team name | every page |
| `header.number` | text | Header: team number | every page |
| `home.about.button` | text | Home: About Us button | / |
| `home.about.photo` | image | Home: About Us team photo | / |
| `home.about.text` | text | Home: About Us text | / |
| `home.about.title` | text | Home: About Us heading | / |
| `home.hero.number` | text | Home: big number | / |
| `home.hero.tagline` | text | Home: tagline under the big number | / |
| `mentors.fawcett.about` | text | Mentors: Mr. Fawcett (text) | /about/mentors |
| `mentors.fawcett.name` | text | Mentors: Mr. Fawcett (name) | /about/mentors |
| `mentors.fawcett.photo` | image | Mentors: photo of Mr. Fawcett | /about/mentors |
| `mentors.lengsfeld.about` | text | Mentors: Mr. Lengsfeld (text) | /about/mentors |
| `mentors.lengsfeld.name` | text | Mentors: Mr. Lengsfeld (name) | /about/mentors |
| `mentors.lengsfeld.photo` | image | Mentors: photo of Mr. Lengsfeld | /about/mentors |
| `mentors.ramirez.about` | text | Mentors: Ms. Ramirez (text) | /about/mentors |
| `mentors.ramirez.name` | text | Mentors: Ms. Ramirez (name) | /about/mentors |
| `mentors.ramirez.photo` | image | Mentors: photo of Ms. Ramirez | /about/mentors |
| `mentors.title` | text | Mentors: page title | /about/mentors |
| `nav.about` | text | Menu: About | every page |
| `nav.contact` | text | Menu: Contact | every page |
| `nav.events` | text | Menu: Outreach Events | every page |
| `nav.ftc` | text | Menu: What is FTC? | every page |
| `nav.home` | text | Menu: Home | every page |
| `nav.mentors` | text | Menu: Mentors | every page |
| `nav.more` | text | Phone menu: More | every page |
| `nav.portal` | text | Menu: Teammate Portal | every page |
| `nav.progress` | text | Menu: Progress | every page |
| `nav.sponsors` | text | Menu: Sponsors Info/Donations | every page |
| `nav.team` | text | Menu: Our Team | every page |
| `nav.workshop` | text | Menu: Workshop | every page |
| `season.2021-2022.award-1` | text | Season 2021-2022: award 1 | / |
| `season.2021-2022.award-2` | text | Season 2021-2022: award 2 | / |
| `season.2021-2022.coming-soon` | text | Season 2021-2022 page: coming soon message | /seasons/2021-2022 |
| `season.2021-2022.label` | text | Season 2021-2022: season name | / |
| `season.2021-2022.logo` | image | Season 2021-2022: game logo | / |
| `season.2021-2022.robot-photo` | image | Season 2021-2022: robot photo | / |
| `season.2021-2022.team-photo` | image | Season 2021-2022: team photo | / |
| `season.2021-2022.title` | text | Season 2021-2022: game title | / |
| `season.2022-2023.award-1` | text | Season 2022-2023: award 1 | / |
| `season.2022-2023.award-2` | text | Season 2022-2023: award 2 | / |
| `season.2022-2023.coming-soon` | text | Season 2022-2023 page: coming soon message | /seasons/2022-2023 |
| `season.2022-2023.label` | text | Season 2022-2023: season name | / |
| `season.2022-2023.logo` | image | Season 2022-2023: game logo | / |
| `season.2022-2023.robot-photo` | image | Season 2022-2023: robot photo | / |
| `season.2022-2023.team-photo` | image | Season 2022-2023: team photo | / |
| `season.2022-2023.title` | text | Season 2022-2023: game title | / |
| `season.2023-2024.award-1` | text | Season 2023-2024: award 1 | / |
| `season.2023-2024.award-2` | text | Season 2023-2024: award 2 | / |
| `season.2023-2024.award-3` | text | Season 2023-2024: award 3 | / |
| `season.2023-2024.award-4` | text | Season 2023-2024: award 4 | / |
| `season.2023-2024.coming-soon` | text | Season 2023-2024 page: coming soon message | /seasons/2023-2024 |
| `season.2023-2024.label` | text | Season 2023-2024: season name | / |
| `season.2023-2024.logo` | image | Season 2023-2024: game logo | / |
| `season.2023-2024.robot-photo` | image | Season 2023-2024: robot photo | / |
| `season.2023-2024.team-photo` | image | Season 2023-2024: team photo | / |
| `season.2023-2024.title` | text | Season 2023-2024: game title | / |
| `season.2024-2025.award-1` | text | Season 2024-2025: award 1 | / |
| `season.2024-2025.award-2` | text | Season 2024-2025: award 2 | / |
| `season.2024-2025.coming-soon` | text | Season 2024-2025 page: coming soon message | /seasons/2024-2025 |
| `season.2024-2025.label` | text | Season 2024-2025: season name | / |
| `season.2024-2025.logo` | image | Season 2024-2025: game logo | / |
| `season.2024-2025.robot-photo` | image | Season 2024-2025: robot photo | / |
| `season.2024-2025.team-photo` | image | Season 2024-2025: team photo | / |
| `season.2024-2025.title` | text | Season 2024-2025: game title | / |
| `season.2025-2026.award-1` | text | Season 2025-2026: award 1 | / |
| `season.2025-2026.award-2` | text | Season 2025-2026: award 2 | / |
| `season.2025-2026.coming-soon` | text | Season 2025-2026 page: coming soon message | /seasons/2025-2026 |
| `season.2025-2026.label` | text | Season 2025-2026: season name | / |
| `season.2025-2026.logo` | image | Season 2025-2026: game logo | / |
| `season.2025-2026.robot-photo` | image | Season 2025-2026: robot photo | / |
| `season.2025-2026.team-photo` | image | Season 2025-2026: team photo | / |
| `season.2025-2026.title` | text | Season 2025-2026: game title | / |
| `season.2026-2027.coming-soon` | text | Season 2026-2027 page: coming soon message | /seasons/2026-2027 |
| `season.2026-2027.label` | text | Season 2026-2027: season name | / |
| `season.2026-2027.logo` | image | Season 2026-2027: game logo | / |
| `season.2026-2027.robot-photo` | image | Season 2026-2027: robot photo | / |
| `season.2026-2027.status` | text | Season 2026-2027: status | / |
| `season.2026-2027.team-photo` | image | Season 2026-2027: team photo | / |
| `season.2026-2027.title` | text | Season 2026-2027: game title | / |
| `sponsors.ask.cta-text` | text | Sponsors: text above the button | /sponsors |
| `sponsors.ask.text` | text | Sponsors: why sponsor us text | /sponsors |
| `sponsors.ask.title` | text | Sponsors: Sponsor Us heading | /sponsors |
| `sponsors.form.button` | text | Sponsors: button text | /sponsors |
| `sponsors.form.link` | link | Sponsors: sponsorship form link (Google Form) | /sponsors |
| `sponsors.header.intro` | text | Sponsors: thank-you text | /sponsors |
| `sponsors.header.kicker` | text | Sponsors: small line above the title | /sponsors |
| `sponsors.header.title-accent` | text | Sponsors: title (green part) | /sponsors |
| `sponsors.header.title-start` | text | Sponsors: title (white part) | /sponsors |
| `sponsors.robot-image` | image | Sponsors: robot picture | /sponsors |
| `team.header.intro` | text | Our Team: intro text | /about/team |
| `team.header.kicker` | text | Our Team: small line above the title | /about/team |
| `team.header.mission` | text | Our Team: mission text | /about/team |
| `team.header.title-accent` | text | Our Team: title (green part) | /about/team |
| `team.header.title-start` | text | Our Team: title (white part) | /about/team |
| `team.section-hint` | text | Our Team: hint next to the head count | /about/team |
| `team.section.leadership.title` | text | Our Team: "Leadership" heading | /about/team |
| `team.section.members.title` | text | Our Team: "Members" heading | /about/team |

</details>

## Our Team page: people, photos and live progress

The page is `src/pages/about/team.astro`. People are the hand-edited
`sections` list at the top of that file (`{ name, roles, image?, badges? }`),
one card each (`src/components/Person.astro`): name, photo, position and
their badges. Add or change people there as always.

**Badges** are the short titles under a person's position, each with an
icon and one line on what they do or did:

```ts
badges: [
    { icon: "crown", tone: "gold", title: "Mission Commander",
      description: "Team lead and competition robot" },
],
```

Base them on real work (tasks finished in the Teammate Portal, what the
person owns on the team); the business team keeps them current. The icons
are listed in `src/components/team/badges.ts`; tones are `gold`, `green`,
`teal` and `violet` (default: gold for captains and leads, else the
person's subteam color). They show on the card and in the profile dialog.

**Photos come from the portal automatically.** Each teammate uploads their
own photo in the Teammate Portal (Settings → My photo); the site reads
`GET /api/public/team-photos` and shows it on their card, in their profile
and next to their name on `/progress` — no rebuild, nothing to edit here. It's
matched by full name like the live numbers (case, spaces and accents
ignored; a name two portal people share gets no photo). The portal never
sends names: each photo comes with a key, a hash of the person's normalized
full name (`src/components/team/name-key.ts`, the same rule and test vectors
as the portal), and the site hashes the names it shows to find theirs — so
the JSON isn't a list of who's on the team. It's listed while the teammate
leaves "Show my photo on the team website" on, nobody who manages their
account in the portal holds it off (renaming yourself in the portal holds it
until a leader checks the new name), and the owner leaves "Show members'
photos on the team website" on (Admin → Team website); turning either off,
or removing the photo, takes it off the site within a few minutes. The photo
fades in over what the card already shows (same size, nothing moves); if the
portal can't be reached, cards keep the photos below. The folder photo and an
explicit `image` still work: `image` overrides the portal photo, the folder
photo is the fallback.

Which photo a card and profile show:

1. the entry's explicit `image` in `team.astro` — always, even over a portal
   photo (use it to override one);
2. the person's portal photo;
3. a photo in `src/assets/images/people/` named after them — the fallback
   for anyone without a portal photo;
4. their initials.

`/progress` doesn't know `team.astro`, so its rows show the portal photo or
initials (a photo only while the portal's name style is "full", since it's
matched by name).

**Photos in the repo (override / fallback).** Drop the photo into
`src/assets/images/people/` and name it after the person: lowercase, spaces
become hyphens, accents and apostrophes removed, ending in `.png`, `.jpg`,
`.jpeg` or `.webp`.

| Name on the page   | Photo file                 |
| :----------------- | :------------------------- |
| Tommy Ho           | `tommy-ho.jpg`             |
| Wolfgang Lengsfeld | `wolfgang-lengsfeld.png`   |
| José O'Neil        | `jose-oneil.webp`          |

It's found automatically at build time and cropped to a square from the top
(keep the face in the upper part of the photo), then resized; no code change.
To use a file with another name, set `image` on that person's entry:
`image: "ethan.png"` (a file in that folder), `image: "/images/x.jpg"` (from
`public/`) or a full `https://` link. Only exact names match, so `ethan.png`
is nobody's photo until an entry points at it. Without a photo the card shows
the person's initials.

Before adding a photo: **ask the teammate** (the repo and the site are
public), and **remove location data** — phones store the GPS position in the
file. Export it without location, or run
`exiftool -all= -overwrite_original src/assets/images/people/<file>`; the
build (and `npm test`) warns about a photo that still has EXIF or GPS data.
Every file in that folder is public in the GitHub repo. A file that matches
nobody (for example someone who left the team) isn't shown, and the build
leaves it out of the site with a `[team] … matches nobody` warning — delete it
from the repo too.

**Live progress.** The "Team progress — live" band, the "12 done" meter on
each card and the profile that opens when you click a card (position, live
stats, the last 8 weeks and the tasks they finished) come from the Teammate
Portal's public progress (`GET /api/public/progress` and
`GET /api/public/progress/people/{id}`). A card gets live numbers when its
name matches the person's name in the portal (case, spaces and accents
ignored), which needs the portal's name style to be "full" (Admin → Team
website); otherwise the cards simply show no live numbers, and `/progress`
doesn't link people here. A profile lists what someone finished only while
the portal's "Show each person's profile on the Our Team page" is on (Admin →
Team website, off until turned on); otherwise it shows their numbers. Link to
a profile with `/about/team?person=tommy-ho`; the people on `/progress` link
there. While developing, `npm run dev` and open `/about/team?demo=1` (or
`/progress?demo=1`) for mock data with generated stand-in photos (also
`?demo=nodetail` for profiles turned off, `?demo=detailerror` for the
per-person endpoint failing, `?demo=nophotos` for members' photos turned off,
`?demo=photoerror` for the photo list failing).

---

# Astro Starter Kit: Basics

```sh
npm create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
