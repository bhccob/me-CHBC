# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A mixed audience with no single priority visitor; the owner confirmed it should work for everyone equally. That includes internship providers and future employers looking at a student developer, MBO 4 teachers and assessors, peers, and anyone arriving from Bob's GitHub (`bhccob`) or Instagram (`@bhccob`). Visitors use both desktop and phone.

## Product Purpose

The personal portfolio of Bob Chung at bhccob.com. It introduces who he is, the fields he studies and is heading for, the projects he has built and what he wants to do next, and it lets visitors reach him directly from the site.

**Success means the visitor remembers him.** The confirmed primary goal is a distinct, memorable personal impression, unlike a template student portfolio. Contact and project pages are supporting capabilities, not the success measure.

## Positioning

A student who builds, from software and games toward security and machines, and whose portfolio is itself the proof:

- The site is one immersive 3D journey that also works without 3D, in two languages, with its art made in code and Blender.
- It pairs that with a story no neighbouring portfolio can copy: born and raised in Aruba, Hakka Chinese by heritage, and living in Rotterdam since 18.

## Operating Context

- **Languages:** Dutch at `/` (the default, at the owner's request) and English at `/en/`, as separate crawlable pages.
- **Contact:** the end page of the journey and a `/contact` page. Messages go through Web3Forms when its key is configured. GitHub, Instagram and email (bhccob@gmail.com) are the visible channels.
- **Hosting:** a static site on GitHub Pages under the custom domain bhccob.com (behind Cloudflare), built and deployed by GitHub Actions from `main`.
- **Maintainer:** Bob edits content himself. Copy lives in `src/i18n/en.ts` and `src/i18n/nl.ts`, and projects and profile data live in `src/data/`.

## Capabilities and Constraints

- **The journey (the home page):** a loader, a first view, his story, four field sheets that build a machine, the machine pulled apart, a portal into a flight past the projects, a void with his Q&A, and a big bang that becomes the "Let's talk" page. `DESIGN.md` describes each.
- **Other pages:** a page per project (it opens in place over the flight; a direct visit gets a plain page), a contact page, a Lite page with everything as plain text, and a 404 page.
- **Owner constraints:**
  - Dark, calm and cinematic, with one focal point per scene; never too bright or too busy (owner, 2026-10-20).
  - One world and one subject throughout, with smooth transitions. Introduce him through big field pages, and show the projects as a 3D experience rather than as a list (owner, 2026-11-05).
  - Keep the information about him minimal (owner, 2026-11-05).
  - Projects come oldest first, one at a time, with their dates; many more can be added (owner, 2026-11-05).
  - The site should feel slightly techy (owner, 2026-11-05).
  - No AI images and no AI video: the art stays code and Blender (owner, 2026-11-05). The portrait video was dropped earlier for the same reason (owner, 2026-10-13).
  - No playable game on the site itself (owner, 2026-10-13).
  - Sound is optional, chosen at the door. It belongs to the machine forming, the portal, its break, the Q&A and the end page (owner, 2026-11-05).
  - The cursor is the "Lock" design, without a trail (owner, 2026-11-06).
  - The end page says "Let's talk", as the owner asked. The earlier rule against collaboration wording does not apply to this page.
  - The site must feel smooth on ordinary laptops.
- **Terminology:**
  - The order of the fields, as he set it: Software Engineering and Game Development at MBO, Cybersecurity as an intern, Mechatronics Engineering at HBO.
  - His wording on the sheets: "Stack: Full-stack", "Studied", "Built" in broad terms and without naming projects; "Engine: Godot, Roblox Studio"; "Possible direction" for security; "Interested and exploring" and "Goal: own company or a master's degree" for mechatronics.
  - "Programmer" on the first view's seal and "Systems Builder" in the title blocks are his own calls. Do not add other titles.
  - Possible future roles are interests, never plans.
- **Technical:** static output only, so there is no server-side code. Security headers are impossible on GitHub Pages, so the Content-Security-Policy ships as a meta tag. Visitor statistics are cookie-free (Cloudflare Web Analytics) and only load when a token is configured.
- **Open decisions:**
  - The school's name is not stated (only "MBO 4, Rotterdam").
  - The exact HBO route may change; his own answer in the Q&A names Mechatronica at Fontys Hogeschool.
  - Future projects are not yet chosen.

## Brand Commitments

- **Identity:** the name Bob Chung, the handle `bhccob` and the domain bhccob.com. 客家 (Hakka) and the circuit tree from Aruba are the personal marks.
- **Colours:** near-black ground and one gold accent, with purple in the machine and the loader's ink. Dark purple and yellow have been his colours from the start.
- **Voice:** first person, professional and formal, but personal. The owner asked for polished wording over casual phrasing. Dutch uses "u" towards the visitor; his Q&A keeps his own "je", as those are questions put to him.
- **Owner's own lines:**
  - "I build with curiosity and test with honesty."
  - "Home isn't one place for me. It's a blend of cultures and the questions I keep chasing."
  - "Overthinking is fear pretending to be logic."

## Evidence on Hand

- **Cookies Clicker (2025):** a browser game built as a **school project** with a classmate, who is never named. Repo: https://github.com/bhccob/Cookies-Clicker.
- **Jontai Energy (2026):** a **concept** website for a store in Aruba, built as a personal project. It is **not client work** and must never be described as such. Repo: https://github.com/bhccob/JE.
- **Steady (2026):** an Android app, a calm and private medication reminder.
- **Portle (2026):** a web app in early access, a private archive for a portfolio, investment theses and trusted friends. Its pictures use example data.
- **Personal facts:**
  - Born 27-04-2006 (the site calculates his age).
  - Born and raised in Aruba, moved to the Netherlands at 18, lives in Rotterdam.
  - MBO 4 student, and an intern at a cybersecurity company, which is never named.
- **His Q&A:** six questions and answers in his own words, in both languages, in `src/i18n/`. They are not to be reworded.
- **Absent, so never fabricate:** testimonials, clients, employers other than the unnamed internship, awards, certificates, grades, usage statistics, the school's name and sports records.

## Product Principles

1. **Memorable over generic.** Every moment should leave an impression of Bob as a specific person, not a template student.
2. **Show, don't claim.** The working site is the proof of skill; experience is never inflated.
3. **Label work honestly.** School, concept and personal projects are called exactly that, and no proof is invented.
4. **Person first, career second.** The fields introduce him; they are not a CV.
5. **Clear at a glance, rewarding up close.** The first view must say who Bob is without prior context, and the rest rewards those who keep scrolling.
