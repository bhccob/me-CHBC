# The Lock: build brief for Bob Chung's portfolio

You are building the production version of a personal portfolio website for Bob Chung (handle: bhccob). A complete working prototype already exists as one HTML file: `the-lock-prototype.html`, delivered with this brief. Read it fully before writing any code.

## 1. The one rule

**The prototype is the source of truth for design, motion, timing, copy and sound.** Your job is to rebuild it as a clean, maintainable, fast project. It is not to redesign it. Every animation, easing value, colour, camera move and line of text in the prototype was chosen through many rounds of feedback. Port the logic and the constants as they are. If something in this brief conflicts with the prototype, the prototype wins, except for the items listed in section 7 (changes for production).

When you are unsure whether a behaviour is intended, assume it is, and keep it.

## 2. What the site is

A scroll-driven 3D site built on one idea: a Lu Ban lock (鲁班锁), a six-piece Chinese interlocking puzzle. Each piece is one part of Bob. The pieces are loose for the whole site and only lock together on the last page.

The six pieces, in chapter order:

| # | Piece | Chinese | Colour | Role |
|---|---|---|---|---|
| 1 | Me | 我 | gold `#f2cf7a` on bone `#efe8d6` | About me. The most important piece. |
| 2 | Software engineering | 软件 | `#e0b85a` | The foundation (his degree) |
| 3 | Game development | 游戏 | `#a488ff` | Part of software engineering |
| 4 | App development | 应用 | `#5fd6ab` | Part of software engineering |
| 5 | Cybersecurity | 安全 | `#ff6a55` | Internship |
| 6 | Mechatronics | 机电 | `#6cc4ff` | Next study |

## 3. The flow, top to bottom

1. **Loader.** Real progress (engine, fonts, six pieces, first frame). At 100% it offers "Enter with sound" and "Enter without sound". Scrolling, touch or arrow keys also enter (without sound). It exits with a fly-through, not a slide.
2. **First view.** Plain centred text ("Bob Chung") with the six pieces hanging loosely around the camera. The Me piece is nearest. On scroll the other five scatter into the fog.
3. **Six chapters, one continuous camera glide.** The camera travels from piece to piece along a trail. Only one piece is in view at a time. Each piece sits off-centre, at an angle, alternating sides. Each has a live 2D drawing on its face and a text panel at the bottom left.
   - **Me:** the face animates how the handle is built (BOB splits, CHUNG CHUN HO shrinks to C C H, the letters cross and land as H C C inside B…OB = BHCCOB). The piece then opens into six slips: Name, Age, Student, Personality, Hobbies, Fun fact.
   - **The five studies:** heading, one tagline, then two short blocks: "What it is" and "Why I chose it".
4. **The wall.** After the sixth chapter the pieces fly in from the fog on curved, tumbling paths and tile into a flat 2×3 wall. It holds for a short pause, then rides up with the page.
5. **Selected work.** A normal scrolling list (it must scale to 50+ projects). Each row: number and type, big name, one line, study chips, an "Open" button that turns purple on hover. Clicking a row opens a purple pop-up panel (not full screen) with a paragraph, one picture, three short points, "Built from" chips in the pieces' own colours, and an optional Visit link.
6. **End page: LET'S TALK.** Pinned. The pieces fly in one by one and are rammed home, Me last. On the final hit the lock shakes and small blocks burst out of it in every direction, slow down as if weightless, and stay floating around it, some out near the screen edges. No shockwave, no light beams, no flash. The finished lock can be dragged to rotate (mouse only) and pressed to open the message form.
7. **Message form, on the lock.** Pressing the lock opens it into its six 3D pieces, and the form is drawn on their faces: title, name, email, message across two pieces, and a glowing SEND piece. Real inputs are hidden and only capture typing. A piece's Chinese name disappears while it is being written on. On phones the pieces stack in one column and the active piece moves above the keyboard. "← Back to the lock" is a solid button, top left.

A menu in the top right (About, Work, Contact) jumps straight to each part.

## 4. Stack

- **Vite + TypeScript + three.js** (current stable three, installed from npm, not a CDN). No UI framework is needed; the DOM is small. Do not add React unless you have a concrete reason.
- **Fonts self-hosted:** Bricolage Grotesque (display), IBM Plex Mono (labels), Noto Serif SC (Chinese, subset to the characters actually used).
- **Deploy on Vercel** from a GitHub repository.
- **Form backend:** one Vercel serverless function (`/api/contact`) that sends an email through Resend (or equivalent). The API key and destination address live in environment variables, never in the client. Add basic spam protection: a honeypot field and a simple rate limit.

The prototype targets three r128 (global build). Porting to a current three release needs small changes (colour management and output colour space, light intensity units). After porting, **match the prototype's look by eye**: materials were deliberately tuned to be matte (low metalness, high roughness, lowered lights) because they washed out to pale blue before.

## 5. Project structure

Split the single file into modules. Suggested layout:

```
src/
  content.ts        all copy and data (see below)
  main.ts           boot, loader, scroll state, render loop
  timeline.ts       scroll → chapter progress (ORDER, START, DUR, HERO_END, HOLD…)
  scene/
    pieces.ts       geometry, materials, glow on the Me piece
    faces.ts        the 2D canvas drawings on each face (DRAW[0..5])
    environment.ts  floor grid, light shafts, fragments, dust
    wall.ts         fly-in and 2×3 wall
    ending.ts       assembly, splash, drag-to-rotate
    form.ts         the form drawn on the pieces
  ui/
    panels.ts       chapter text panels, slips
    work.ts         project list and pop-up
    nav.ts          menu, sound button
  audio.ts          synthesized sound
  styles.css
api/contact.ts      email function
public/             fonts, project pictures, favicon, share image
```

**`content.ts` is the important part.** Everything Bob will want to edit later must live there and nowhere else: the six pieces (name, Chinese name, colour, tagline, "what it is", "why I chose it"), the six about-me slips, the project list, and the contact links. Adding a project must be one new object in a list, with no other code change. Copy the current text from the prototype exactly.

## 6. Requirements the prototype does not fully meet

- **Performance.** Target 60 fps on a mid-range laptop and a smooth experience on a recent phone. Cap device pixel ratio (2 on desktop, 1.5 on phones). On phones or weak GPUs use a light mode: fewer fragments and dust, simpler glow. Only redraw a face canvas when it is on screen and has changed. Pause rendering when the tab is hidden.
- **Phones.** Test on a real iPhone and a real Android phone. Known sensitive areas: the on-screen keyboard changing the viewport height while the form is open (the prototype locks the scroll state while the form is open; keep that), touch scrolling versus dragging the lock (touch only taps; drag is mouse only), and the end page text (on portrait phones LET'S sits above the lock and TALK below it, unmasked).
- **Resize and orientation change** must not break layout or scroll position.
- **Reduced motion.** Respect `prefers-reduced-motion`: no camera shake, no tumbling, content still fully readable.
- **No WebGL.** Keep the prototype's fallback: all text content readable as a plain page.
- **Accessibility.** Real headings and landmarks, keyboard access to menu, project rows, pop-up (focus trapped, Escape closes, focus returns) and the form (Tab order name → email → message → send; Enter advances). Sound is off until the visitor chooses it.
- **SEO and sharing.** Title, description, Open Graph and Twitter tags, a share image, favicon, `lang="en"`.
- **Sound** stays fully synthesized with WebAudio (no audio files) and only starts after a user gesture.

## 7. Changes for production (the only places you differ from the prototype)

1. **Sound.** Ship one sound set: the prototype's **Sound 2 (stone)** for everything, **except** the final lock-closing moment on the end page, which uses **Sound 1's finale**. The prototype already behaves this way when set 2 is selected. Remove the "Sound 1/2/3" switch button and delete the unused code for sets 1 and 3 (keep what the finale needs).
2. **Form.** Wire SEND to `/api/contact`. States shown on the title piece: sending, sent, and a clear error. Validate name, email and message as the prototype does. Remove the "Not sent: this preview has nowhere to send it yet" message.
3. **Contact links** on the end page: GitHub, Instagram, Email. Addresses come from `content.ts` (placeholders until Bob supplies them).
4. **Project pop-up picture and link.** Each project has one picture slot and an optional URL. Show the dashed placeholder when no picture is set, and hide the Visit button when no URL is set.
5. **Remove** prototype-only scaffolding and dead code (unused sound functions such as `bell`, old CSS for removed features).

## 8. Things Bob has explicitly rejected. Do not reintroduce them.

- The lock shown assembled anywhere before the end page.
- A door that opens, or blocks that slide in, as the transition to Selected work.
- Hover effects on the about-me slips; filters or dim-on-hover on the project list.
- Musical sound: bells, chords, melodic tones. Also hiss or sand-like noise, loud continuous drones, and long delays before a hit.
- A shockwave, floor ripple, light beams or flash when the lock closes.
- Text outlines on LET'S TALK, and letters placed in front of the lock.
- Full-screen project pop-ups; screenshots inside the project rows.
- "BC-2006" or the spelling "bhcccob". The handle is **bhccob**; the short form is **CHBC**.
- A flat, boxed HTML form floating over the lock.

## 9. Content still to come from Bob

Leave clearly marked placeholders in `content.ts` and do not invent values:

- GitHub username, Instagram username, public email address, and the address the form should send to.
- One picture per project (Jontai Energy, Locked, Lumo) and each project's URL.
- Final wording for each project's pop-up and for the "Why I chose it" lines. The current text is a draft he may edit.

## 10. Build order

1. Scaffold the project, self-host fonts, move all copy into `content.ts`.
2. Port the scene, timeline and render loop. Get loader → first view → six chapters matching the prototype.
3. Wall, Selected work list and pop-up.
4. End page: assembly, splash, drag, form on the pieces.
5. Audio, per section 7.
6. Contact function and environment variables.
7. Phone pass, performance pass, reduced motion, no-WebGL fallback, accessibility.
8. Meta tags, share image, deploy to Vercel.

## 11. How to check your work

The prototype was built without anyone being able to look at every screen as it changed, so visual bugs may exist in it. **Open both the prototype and your build side by side and compare every section with screenshots**, on desktop and at phone width:

- loader, first view, each of the six chapters (including the name animation and the open slips), the wall forming and riding up, the work list, a project pop-up, the assembly, the floating blocks, the form open with text typed in each field.

Where the prototype itself looks broken (overlapping text, something off-screen, a piece hidden behind text), fix it in the spirit of the design and list what you changed. Do not silently change anything else.

Done means: the build matches the prototype section by section, the form delivers a real email, it runs smoothly on a phone, Lighthouse accessibility and SEO are 95 or higher, and adding a project takes one edit in `content.ts`.
