---
name: bhccob.com
description: Bob Chung's portfolio as one journey. A machine is built layer by layer over four field sheets, a portal opens into a live flight past his projects, the tunnel dissolves into a void with his questions, and a big bang ends it on "Let's talk".
colors:
  night: "#07060b"
  ink: "#f2efe8"
  muted: "rgba(242, 239, 232, 0.66)"
  line: "rgba(242, 239, 232, 0.18)"
  gold: "#e6b84a"
  on-gold: "#17120a"
  sheet-software-paper: "#0c0e1d"
  sheet-software-word: "#d4dbff"
  sheet-game-paper: "#150b1a"
  sheet-game-word: "#f4cdec"
  sheet-cyber-paper: "#07141a"
  sheet-cyber-word: "#bdf0e2"
  sheet-mech-paper: "#17100a"
  sheet-mech-word: "#f5dcae"
  error: "#ff9d8f"
typography:
  hero:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(58px, 9.4vw, 158px)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.025em"
  rolling-word:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontWeight: 600
    fontStyle: italic
    letterSpacing: "-0.02em"
  sheet-title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(58px, 9.6vw, 164px)"
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: "-0.025em"
  end-word:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(66px, 13vw, 214px)"
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: "-0.03em"
  sheet-line:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(22px, 2.5vw, 40px)"
    fontWeight: 600
    fontStyle: italic
    lineHeight: 1.12
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(15px, 1.25vw, 19px)"
    fontWeight: 500
    lineHeight: 1.42
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1
  han:
    fontFamily: "Ma Shan Zheng, Barlow, sans-serif"
    fontSize: "clamp(46px, 5vw, 76px)"
    fontWeight: 400
    lineHeight: 1
rounded:
  button: "2px"
  seal: "3px"
  screen: "14px"
  picture: "18px"
spacing:
  page-edge: "34px"
  page-edge-phone: "18px"
  facts-gap: "34px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.button}"
    padding: "13px 20px"
  fact:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  title-block:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
  seal:
    textColor: "{colors.gold}"
    rounded: "{rounded.seal}"
    padding: "8px 11px"
---

# Design System: bhccob.com

This describes the site as shipped. The reasons behind it are in `docs/superpowers/specs/2026-11-05-bob-machine-rebuild-design.md`, and what the owner decided is in `PRODUCT.md`.

## Overview

**Creative North Star: "One Machine, One Journey"**

The site is one continuous world on one scroll, not a stack of sections. Nothing cuts: the first view's machine is built over the field sheets, the finished machine opens a portal, the portal becomes a flight, the flight ends in a void, and the void falls into the light that becomes the last page. A visitor never changes subject, only place.

It stays dark, calm and cinematic. Each moment has one thing to look at. Type and pictures belong to the same scene: words stand in the 3D, in front of and behind its objects, and the giant words of the sheets stand behind the machine.

**Key Characteristics:**

- Near-black night, one gold accent, and one quiet colour per field sheet.
- Barlow in heavy capitals for the big words, IBM Plex Mono for labels, and 客家 by brush as the one personal mark.
- All art is code or Blender. There are no AI images and no AI video.
- Sound comes from code and is optional.
- Everything has a plain way to read it: the Lite page, the calm page, and real text behind the 3D words.

## The Journey

| Place | What happens |
| --- | --- |
| Loader | Purple ink: one drop spreads through dark water as the files arrive, and 客家 appears in it. It is silent. When ready, it waits with "Enter with sound" and "Enter without". Enter goes in with sound; scrolling goes in without. The whole loader plays on a new tab and is quick on a reload. |
| First view | "From code to games. / security. / machines.", the last word rolling every 2.4 s in gold italic. A wind-bent Aruban tree whose branches turn into gold circuit traces. The board stands on the right, with 客家 and a tilted seal, "PROGRAMMER". |
| Story | His age and the way from Aruba to Rotterdam. |
| Four sheets | Software Engineering, Game Development, Cybersecurity Intern, Mechatronics Engineering. Each slides over the last with its own art band and facts, and adds a layer that means that field: the brain, the controls, the armour, the body. |
| Stack | The whole machine pulled apart, each layer named, with "One machine." beside it. |
| Portal | The machine opens as an iris and the page goes through it. |
| Flight | A live flight down a tunnel of gold wires, rings and gates with the year in their digits. Projects come oldest first, one at a time. The tunnel quietens at each, and its words and screens arrive in layers. Screens on the walls repeat the same work. |
| Void | Out of the tunnel over a mirror floor. The tunnel, seen from outside, dissolves into stars. His six questions stand along a gold line, each with a gear. |
| Bang | The void falls into one light, which waits with a hint. A click plays the bang; so does scrolling. |
| Let's talk | A 3D universe that answers the pointer: it orbits, the stars bend, and holding and letting go starts a new galaxy. The last words and links rise over it. |

## Colors

The ground is `night`. It covers most of every screen, and even the sheets' papers stay close to it.

- **Gold (`#e6b84a`)** is the only accent: the rolling word, labels, the first words of a sheet's line, links and the primary button. If a screen shows much of it, something is lit that should not be. The tunnel, the gates and the Q&A line use the same gold as light.
- **Ink (`#f2efe8`)** is for reading, and **muted** is for the title blocks.
- **The sheets** each have a paper and a word colour: indigo for software, plum for games, teal for security and amber for mechatronics. These colours appear only on their sheet.
- **Purple** lives in the materials: the machine's board and the loader's ink. It is not a page colour.
- **A project's tint** comes from its own work and colours its year and its piece in the flight.

### Named Rules

**The One Accent Rule.** Nothing on the page but gold is an accent. No new colour joins a button, a link or a label.

## Typography

**Barlow** carries everything that is read; **IBM Plex Mono** carries everything that labels. **Ma Shan Zheng**, cut down to the two characters 客 and 家 and served from `public/fonts/hakka.otf`, is used for that mark alone.

- Big words are 800 weight, uppercase, tight, with line heights of 0.88 to 0.94. "Let's talk." keeps its sentence case, as a thing said.
- Italic 600 is the voice: the rolling word, the sheets' lines and the end page's promise.
- Labels are mono at 12 to 13 px, and are facts, never sentences.
- Words inside the 3D are drawn at runtime from the same dictionaries, so they follow the language. No translated words are baked into an image or a model.

### Named Rules

**The Longer Language Rule.** Dutch runs longer than English. A title or line must fit in both at desktop and phone sizes, which the harness step `dutch-fit` checks. On a phone, the Dutch rolling word takes its own line, and "Laten we praten." wraps to two.

## Layout

Fixed layers over one sticky canvas, driven by one scroll. Text keeps to a 34 px page edge (18 px on a phone). The facts sit top left, the giant word in the middle, and the line and title block bottom left, leaving the right side for the machine.

The chapter rail stands at the right edge above 900 px wide. A thin gold bar along the top shows how far the journey has gone. On tall pages the words go above the machine, and the header turns into a menu.

The other pages (contact, a project's own page, Lite, 404) are ordinary pages in the same dark and type, so they read without the 3D.

## Elevation & Depth

Depth comes from the 3D itself: real distance, reflections on the mirror floor, the machine's moving shadow, bloom on gold light and a depth of field that eases with speed. On the page there are no shadows or stacked cards. The only raised things are the 3D screens, and the project page that grows out of one.

## Shapes

Small and exact: 2 px on buttons, 3 px on the seal, 14 to 18 px on pictures and screens. Rules are 1 px hairlines. The machine is the one complex shape, and its parts are made in Blender (`tools/blender/`, `public/models/`).

## Components

### Primary button

Gold fill, near-black text, 700 weight, 2 px corners, 13 by 20 px padding. It lifts 2 px on hover and presses to 98 %. "See my projects" and each project's "Open project" use it.

### Field sheet

A paper colour, an art band drawn in code on a canvas, a row of facts, the giant word, a line whose first words are gold, and a title block that reads like an engineering drawing: "MBO, now · Sheet 1 of 4 · Systems Builder".

### Project stop

In the 3D: an outlined year behind, the title in heavy capitals, the kind in mono, one line in Barlow, and screens and a piece of its own beside them. Its link is real HTML placed under the words, so it works by keyboard and for a screen reader.

### Project page

Opens in place: it grows out of the 3D screen over the flight, and closes back into it by Back or Esc. A direct visit gets the same sheet as a plain page.

### Cursor: Lock

Gold corner brackets with no trail. They drift behind the pointer, close around whatever can be clicked, and say "OPEN" over a project's screen. Touch screens and reduced motion do not get it.

### End page

The kicker, "Let's talk.", the promise in gold italic, a note, how to play with the stars, four links with a mono label over a bold value, and a bottom line.

## Motion

- **Scroll drives the world.** One loop turns scroll into a frame, and every scene is a pure function of that frame, so scrolling back plays it backward, and a reload or a language change keeps the place.
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` for words and small things, over 0.25 to 0.9 s. Words arrive one by one and are never thrown in.
- **Cost:** only transforms and opacity on the page; a speed ladder (`src/journey/quality.ts`) lowers resolution, then samples, depth of field and shadows, then star and screen counts, when frames run long. A weak GPU starts low on the ladder, so it does not resize mid-journey.
- **Reduced motion:** the calm page: no canvas, no flight and no bang, a normal scroll through stills, with all the words and links.

## Sound

Made in code with Web Audio, and only after the visitor chooses it at the door or on the sound button. It holds a rush alone in the portal, the machine forming, the portal breaking, gears through the Q&A and the arrival at the end. It stops when the tab is hidden.

## Fallbacks

- **No WebGL or a lost context:** the calm page, with stills, the same words and a link to Lite, and a line saying why.
- **No script:** the same words as real text, with a pointer to Lite.
- **Keyboard:** the chapters and links can all be reached, and focus glides the journey to them.
- **Screen readers:** the Q&A and project words also exist as real text behind the 3D.

## Do's and Don'ts

### Do

- Do keep one focal point per scene, and leave most of each screen dark.
- Do draw new art in code or Blender.
- Do put every word in `src/i18n/en.ts` and `nl.ts`, or the project's own copy in `src/data/projects.ts`.
- Do label work as what it is: a school project, a concept or a personal project.

### Don't

- Don't add AI images or video. The owner dropped them.
- Don't add a second accent, a card grid or a bordered box.
- Don't name his internship company, or the classmate on Cookies Clicker.
- Don't add a trail to the cursor, or make the sound mandatory.
- Don't animate layout properties, or load later stages before the visitor is near them.
