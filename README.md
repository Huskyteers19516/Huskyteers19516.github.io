# The Huskyteers website (FTC 19516)

## Our Team page: people, photos and live progress

The page is `src/pages/about/team.astro`. People are the hand-edited
`sections` list at the top of that file (`{ name, roles, image? }`), one card
each (`src/components/Person.astro`). Add or change people there as always.

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
