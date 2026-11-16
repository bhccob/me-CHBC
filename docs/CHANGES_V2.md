# The Lock: change request v2

These are redesigns made after the first build. A new prototype, `the-lock-prototype-v2.html`, is delivered with this note and replaces the first prototype as the source of truth. Everything not mentioned here stays exactly as built.

Apply the three changes below. Each section names the functions and constants to read in the v2 prototype. Port their logic and values as they are, as before.

**This note overrides the original brief in two places:**

- Brief section 3, item 5 (the purple pop-up panel) is replaced by change 1.
- Brief section 8 listed "full-screen project pop-ups" as rejected. That is reversed: the project view is now a full-screen page.

---

## 1. Project view: a full-screen project page (replaces the pop-up panel)

Clicking a project row opens a full-screen, scrollable page over the site. In the prototype: `openPop`, `nextPop`, `closePop`, the `WORKS` data, and the CSS from `.pop` to `.pnext`.

**Layout, top to bottom**

1. **Top bar**, sticky, floating over the picture with a dark-to-transparent gradient: "← Back to work" (solid cream button), a counter such as `01 / 03` (hidden on phones), and "Next project →".
2. **Hero picture**, full width, about 64% of the viewport height (44% on phones). It fades into the page background at its edges with a radial mask. With no picture set, show a soft glow in the project's brand colour and the label "Picture".
3. **Main block**, overlapping the bottom of the hero, in two columns (one column on phones):
   - Left: the project name (smaller than a chapter heading).
   - Right, in this order:
     - the one-line summary in large text
     - a 2×2 facts grid: **Type**, **Role**, **Built from** (study chips in each piece's own colour), **Link** (the address as a text link opening in a new tab, or "Coming soon" in dim text when there is no URL)
     - two short headed points (the first two entries of `points`)
4. **Preview video**, centred, max width about 1040px, 16:9. With a video set: muted, looping, `playsinline`, with controls. Without one: a dashed placeholder labelled "Preview video".
5. **Footer**: a "Visit …" button (only when a URL exists) and the next project's name as a large link.

**Behaviour**

- Opens with a fade and a short upward slide. Escape and the Back button close it. Focus moves to the Back button on open and returns to the clicked row on close.
- "Next project" (top bar and footer) swaps the content in place, scrolls the page to the top and wraps from the last project to the first.
- The page behind does not scroll while it is open.
- Colours are the site's own: ink background, bone text, dim mono labels, gold only for hover and focus. No purple inside the page. The "Open" button on the work rows still turns purple on hover.

**Content model.** Each project in `content.ts` needs: `name`, `kind`, `brand`, `uses`, `desc` (one line), `role`, `points` (at least two `[title, text]` pairs), `url`, `link` (the noun used on the button: "the website" or "the app"), `picture`, `video`. Remove the fields the page no longer uses (`about`, `overview`, `problem`, `approach`). Keep the text short; long written sections were rejected.

Jontai Energy's URL is set to `https://jontaienergy.com` in the prototype. Bob still has to confirm it. Locked and Lumo have no URL yet.

---

## 2. About me: slower, bigger, and the text lives on the block

In the prototype: constants `ME_A`, `ME_L`, `UNIT`, `DUR`, the `me` branch of the chapter loop in `frame`, `presScale`, `meCard`, `drawMeCard`, `wrapMe`, and the slat loop.

**Timing.** The six lines used to get a quarter of the chapter, which made them easy to scroll past.

- The Me chapter is now 2.8 units long (was 2.2): `DUR[c]=UNIT*(c===0?2.8:1)`, `UNIT=0.91/7.8`, and the scroll track is `1500vh` (was `1390vh`).
- Within the chapter (t from 0 to 1): piece arrives by 0.12; name animation runs 0.13 to 0.29; text panel shows from about 0.18 to 0.9; the piece opens 0.31 to 0.37 and closes 0.84 to 0.89; the six lines run from `ME_A=0.36` for `ME_L=0.46` of the chapter; the camera leaves from 0.91.
- The menu's About button scrolls to the first line: `START[0]+DUR[0]*(ME_A+ME_L/12)`.

**Size.** While its slips are open, the Me piece grows: scale factor `1.18+0.34*meOpen` on wide screens and `1.18+0.06*meOpen` on narrow ones (the piece already fills a phone's width).

**The card (wide screens only).** The slip being read grows into a taller solid block that carries its own text.

- It is a real block of the piece, not a floating sheet: `BoxGeometry(6, 1.05, 2)`, the same width and depth as the slips, the Me piece's plain side material on five faces, and the same gold edge lines.
- Its front face is a canvas texture (1800×300): the line number in gold mono at the top left, the label in large display type on the left (font size reduced until it fits 470px), a thin gold rule, then the sentence wrapped on the right (font size reduced until it fits the height).
- It sits at the active slip's row, standing out as far as the active slip did (`z = 0.6*meOpen`). Its height animates from the slip's height to full (`scaleY` from 0.32 to 1) as the line becomes active, and back before the next line. The real slip in that row is hidden while the card is visible.
- The slips above move up and the slips below move down by 0.36 units to make room.
- On wide screens the sentence under the "About me" heading is hidden, since the words are on the card. The heading and "Line n of 6" stay.

**Phones.** No card. The sentence stays under the heading as before, and the active slip scales up by 10% as it steps forward.

**Improve if you can:** while the card grows or shrinks, the text on its face is briefly squashed. Keeping the text at its true proportions during that transition (for example by fading it in once the block reaches full height) is welcome.

---

## 3. Background: no light shafts

The scene is a place in space, so nothing shines into it. Remove the seven light shafts from the environment entirely (the prototype only hides them with `visible=false`; delete the code). Keep the grid floor, the floating blocks and the dust. Lighting on the pieces and the Me piece's own glow are unchanged.

---

## Rejected along the way. Do not build these.

- A glass, two-column pop-up for projects, and any small pop-up panel.
- Overview / The problem / The approach text sections on the project page.
- All six about-me lines shown at once in a grid.
- Clickable labels or tabs for the six about-me lines, and a fade-in each time the line changes.
- Light shafts or beams of any kind in the background, coloured or white.

## Check

Compare against `the-lock-prototype-v2.html` with screenshots, desktop and phone width: a project page with and without a URL, the next-project flow, each of the six about-me lines with its card, the card growing and shrinking, and the background in every chapter. List anything you changed beyond this note.
