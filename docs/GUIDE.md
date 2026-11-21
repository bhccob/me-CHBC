# Guide to this repo

Bob Chung's portfolio, [bhccob.com](https://bhccob.com). A scroll-driven 3D site built on one idea: a Lu Ban lock (鲁班锁), a six-piece Chinese interlocking puzzle. Each piece is one part of Bob. The pieces are loose for the whole site and only lock together on the last page.

Vite, TypeScript and three.js. No UI framework.

## Editing the site

Everything you can edit lives in **`src/content.ts`**: the six pieces (title, status and one short line each), the four sides of the About me piece (`ME_SIDES`), the project list and the contact links.

- **Add a project:** add one object to `PROJECTS`. Put its wide picture and its short preview video in `public/work/` and name the files in `picture` and `video`. Leave `picture` as `""` for a soft glow, `video` as `""` for no video, and `url` as `""` for "Coming soon" with no Visit button.
- **Contact links:** fill in `CONTACT`.
- **New Chinese character anywhere:** run `npm run fonts` once, so the character is added to the font file.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | The site on http://localhost:5173, with the message form's function running too |
| `npm run build` | Type-check and build into `dist/` |
| `npm run preview` | Serve the built site on http://localhost:4173, with the live site's security headers |
| `npm run fonts` | Remake the self-hosted font files in `public/fonts/` |
| `npm run icons` | Remake the icons from the logo (`public/favicon.svg`, `public/icon.svg`) and the share image (needs `npm run dev` running) |

## The message form

`api/contact.ts` is one Vercel function that sends an email through [Resend](https://resend.com). Its settings are environment variables, listed in `.env.example`. They are set on Vercel, never in the code.

For local testing, a `.env` file with `CONTACT_DRY_RUN=1` makes the form answer "sent" without sending anything.

## Where things are

```
src/content.ts        all copy and data
src/main.ts           boot
src/loader.ts         the loader
src/timeline.ts       scroll → chapter progress
src/markup.ts         content → HTML (used by the build and by the project page)
src/scene/            the 3D: pieces, faces, environment, wall, ending, form, and the render loop (stage.ts)
src/ui/               chapter text, project list and project page, menu, and the scroll steps (steps.ts)
src/audio.ts          synthesised sound
api/contact.ts        the email function
docs/                 the build brief, change request v2 and the prototype this site was rebuilt from
```

`docs/the-lock-prototype.html` (version 2) is the source of truth for design, motion, timing, copy and sound. `docs/CHANGES_V2.md` is the change request that came with it, and overrides the brief where they disagree. `docs/CHANGES.md` lists every place the site differs from the prototype.
