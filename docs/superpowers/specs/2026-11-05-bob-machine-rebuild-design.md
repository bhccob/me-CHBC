# Portfolio rebuild: one machine, from code to a new universe

Status: written 2026-11-05 from Bob's approved mock-up, for his review. Nothing here is built on the real site yet.

## 1. What this is and why

Bob asked for a full rebuild of bhccob.com. He wants the same thing he admires in serhii.website and kigo.studio: one theme and identity from the first screen to the last, smooth transitions and 3D, and no jumping between subjects. His words: "they all have their theme and identity meaning they dont need to switch subject so much and the transition and 3ds are so smooth".

The product goal stays the one in `PRODUCT.md`: the visitor remembers him. Contact and project details support that goal.

The idea he chose through fifteen rounds of mock-ups:

> A machine gets built as you scroll, one layer for each field Bob learns. It opens an iris. You fall through it and fly down a tunnel past his projects, out into a void, past his answers along a gold line, and into a big bang that ends on "Let's talk."

Every part of the page is the same machine or what came out of it. Nothing is a separate section.

## 2. Goals, non-goals, anti-goals

**Goals**
- One unbroken journey on the home page, in the order and with the words in section 5.
- The portal feels like travelling: moving while you see the work, never stopping, only slowing to read.
- Projects show oldest first and one at a time, with text and screenshot belonging together. More projects can be added without new code.
- The end page is interactive and 3D, and the visitor can always reach Bob.
- It runs smoothly on ordinary laptops and phones, and everything is readable without 3D.
- Dutch and English, as now.

**Non-goals**
- A site-wide visual system beyond this journey and the few pages in section 9.
- A playable game (Bob, 2026-10-13: no game on the site). The hold-and-release bang is a small toy on the end page, not a game.
- AI-generated images or video. He said "keep the code art". Art is drawn in code, and models come from Blender.
- Sound during the loader, music, and bells or melodies before the ending (section 6a).

**Anti-goals: it has failed if any of these are true, even if it works**
- It looks like a template student portfolio.
- The machine or a robot stands on the end page. He rejected that: "the robot there again doesnt make sense".
- The ending is loud. He rejected the real sun as "too strong". The site stays dark, calm and cinematic, with one focal point per scene.
- Project screens fill the page or lose their text. He rejected that: "too big inside the portal and theres no text".
- Projects sit in a flat list or grid. He rejected that in round 2.
- A visitor on a normal laptop gets stutter or freezes.
- The internship company is named. It must never be.

## 3. Source of truth for the look

The look and motion are fixed by the mock-up, which Bob approved for this document:

- Live: https://claude.ai/artifact/MniTZUoTm2QzD64oopchUn (Claude sign-in needed; open `#end-bang` for the end page).
- Files: `C:\Users\bhcco\Downloads\Portfolio-bob\.superpowers\rebuild-mock\`. This folder is git-ignored, so do not delete it until the rebuild is live.

| Mock file | What to take from it |
|---|---|
| `machine.py` | The machine's parts, and in `pose(f)` and `CAM` its whole choreography |
| `gate.py` | Tunnel gate, iris blades, gold years, question gear |
| `tunnel.src.js` | Flight, void, Q&A, collapse, bang and interaction, as working code |
| `machine.html` | Page layers, sheets, code-painted art, all words and styles, the scroll timing |
| `code.mjs`, `assets6.mjs` | The code-screen texture, and how the screenshots are prepared |
| `loader.src.js` | The loader, the sound and the cursor |

**Mock-only, do not build:** the end page version dropdown; the loader picker and the loaders he does not pick; the other end designs (credits, list, sentence, board, footer, flat sun, real sun, machine with gold word); the 3D word, its wires and the plugs; the gold sheet; `.superpowers/rebuild-mock/plug.py`; the `window.__flight` debug hook; `#end-*` links; project links that go straight to GitHub or the live app; the WebP flipbook itself (section 8).

The mock is English, desktop-first and tested only in Edge. Where it is rough, section 13 says what to fix.

## 4. The journey on one scroll

Native page scroll (section 8). "Frame" is the mock's unit of scroll, about 31.5 px, and the code's single timeline value. Keep these proportions. The exact pixels are the builder's to tune.

| Frames | Chapter (rail label) | What happens |
|---|---|---|
| 0 to 12 | Who | First view holds, then the machine starts to move |
| 12 to 44 | Who | Camera down to the chip; age and place roll |
| 44 to 96 | Software | First sheet; code layer lands and types itself |
| 98 to 150 | Games | Second sheet; the controller lands |
| 152 to 204 | Security | Third sheet; walls, lid and shield close round it |
| 206 to 272 | Mechatronics | Fourth sheet; gear ring, servos and legs; it stands up |
| 276 to 326 | Stack | Layers lift apart like stairs, with labels |
| 326 to 366 | Projects | Sheet fades; shield away; iris opens; "Projects"; camera dives in |
| 350 to 566 | Projects | The flight. Projects are read at 399, 448, 493, 537 |
| 566 to 642 | Projects | Out of the far end, swing round, look back at the whole tunnel |
| 630 to 690 | Q&A | The tunnel breaks into sparks that become the stars |
| 660 to 858 | Q&A | "Q&A", then six questions along the gold line, read at 707, 736, 765, 795, 824, 853 |
| 858 to 880 | Contact | Everything collapses into one point of light |
| 880 to 928 | Contact | The big bang |
| 893 to 934 | Contact | "Let's talk." pulls together; the end page settles and is interactive |

## 5. Scene by scene

English words are the source. Each needs Dutch in `nl.ts` (section 7). Bob's own wording is marked **(Bob)**. All other words are my draft, and he has seen them on the mock.

### 5.0 Loader and the way in
**Purple ink (Bob's pick, 2026-11-06)** replaces the live Signal loader. It is drawn in code and is silent. One drop spreads through dark water as the files arrive, and 客家 appears in it, one character at a time, with nothing else on the page. Once entered, the ink dissolves into the page and the characters move to their place on the first view. He turned down words under the characters and a seal beside them.

**The way in (my call, for him to check):** browsers allow sound only after a click. So when loading finishes, the loader waits with two choices: "Enter with sound" and "Enter without". The Enter key goes in with sound. Scrolling goes in without asking and without sound, so nobody is stuck at the door.

It shows real download progress, lands straight on the first view with no cut, plays on every new tab as Signal does now, and is quick on a reload.

### 5.1 First view
Left: `FROM CODE / TO games. | security. | machines.` The last word rolls every 2.4 s in gold italic. Under it: "I'm Bob Chung, {age}. Born and raised in Aruba, now in Rotterdam, studying software and heading for mechatronics." Then a gold button, "See my projects", which goes to the flight.

Art, drawn in code: dark mist, a far hill and sea line, and an Aruban wind-bent tree from the top right whose branches turn into gold 45-degree circuit traces with small lit blossoms. It grows on load. A few sparks drift. A vertical brush 客家 and a tilted seal "PROGRAMMER" (Bob, 2026-11-06) sit near the machine, which rests small on the right. Hakka is true: "Hakka is my mother tongue" (`docs/art-direction.md`).

### 5.2 Story
Camera flies to the chip, which reads SYSTEMS BUILDER, with depth of field. Large digits roll from 18 to {age}, and the place changes from Aruba to Rotterdam. {age} comes from `profile.ageOn()`, so it stays true next year.

### 5.3 The four field sheets
Each field is a coloured sheet that slides up over the last with a slight tilt, Kigo style: a giant word behind the machine, a code-painted art band below, and the machine's new layer in front. Keep the layer order paper, sheet, machine, front words.

| Sheet | Colours (paper, word) | Art band | Facts | Line | Title block |
|---|---|---|---|---|---|
| Software Engineering | `#0c0e1d`, `#d4dbff` | Seigaiha waves with real code | Stack: Full-stack **(Bob)**. Studied: MBO 4, Rotterdam **(Bob's label)**. Built: Web apps, mobile apps and websites | **The brain.** The code that makes it think. | MBO, now · Sheet 1 of 4 · Systems Builder |
| Game Development | `#150b1a`, `#f4cdec` | Pixel clouds, level, plus signs | Engine: Godot, Roblox Studio **(Bob)**. Built: Browser, Roblox and platform games | **The controls.** How a person plays with it. | MBO, now · Sheet 2 of 4 · Systems Builder |
| Cybersecurity Intern | `#07141a`, `#bdf0e2` | Key-fret lattice, lock rings | Now: Intern at a cybersecurity company. Possible direction **(Bob's label)**: DevSecOps, firmware security | **The armour.** What keeps it safe. | Internship, now · Sheet 3 of 4 · Systems Builder |
| Mechatronics Engineering | `#17100a`, `#f5dcae` | Gear drawings with centre marks | Next: HBO. Interested and exploring **(Bob)**: Sensors, motors, circuits. Goal **(Bob)**: Own company or a master's degree | **The body.** Gears, motors and movement. | HBO, next · Sheet 4 of 4 · Systems Builder |

The mock says "of 5" because of a gold fifth sheet he rejected, so there are four now (my call).

Parts must read as their field: a screen typing a `Machine` class (`code.mjs`), a real game controller, armour with a shield and keyhole, gears and legs.

### 5.4 Stack
Left: "One machine." and "Each field I learn is one layer of it. Together they make something that thinks, responds, stays safe and moves." The four layers lift apart like stairs. Labels follow the parts in 3D: Armour / Cybersecurity, Controls / Game Development, Brain / Software Engineering, Body / Mechatronics.

### 5.5 Portal
The shield shrinks and turns away, the nine-blade iris opens, and a big "Projects" shows over it. Through the opening you already see the live tunnel. The camera drops through a glowing sleeve and the world becomes the flight, with no cut.

### 5.6 The flight
One curving path. The camera never stops; it slows to about a fifth of its speed to read. Scroll speed comes from a distance table, as `TABLE` in `tunnel.src.js`.

- **Tunnel:** gold wires on the walls that step at 45 degrees with light racing along them, thin octagon rings, and streaks that stretch with speed. Field of view widens with speed, the camera banks into bends, and a soft glow marks the way ahead.
- **Gates:** the Blender gate, spaced so none stands at a reading stop (`GATES` in `tunnel.src.js`), with gears that turn as you pass. Before the first project of each year stands a year gate: gold 3D year above, and an iris that opens as you reach it.
- **Each project, oldest first:** it swings out from the wall and overshoots. A curved screen about 30% of the page wide on a 16:9 screen (2.45 units at the 4.7 reading distance) fades into the dark on the side toward its words. Beside it, in this order: a large hollow year behind, the title, then year and kind, then one line, then "Open project". "Open project", or a click on the screen, opens the project in place (section 9). While you read, a soft dark falls behind it, far gates fade and wires dim, so it is the one thing you look at. When you pass, it swings back to the wall and goes out.
- **On the walls:** the same screen bent onto the tunnel wall four times, twice before and twice after each stop, so you see the work while you fly. They step back while you read.
- **Colour:** the tunnel takes each project's tint as you near it.

| Project (date order) | Tint | Year, kind | One line | Extra piece |
|---|---|---|---|---|
| Cookies Clicker | 1, .6, .24 | 2025, School project | A browser game built with a classmate around one satisfying loop: click, earn, reinvest. | The cookie floats in front; it is painted out of the screenshot |
| Jontai Energy | 1, .78, .42 | 2026, Concept website | A concept redesign for a store in Aruba, where the home page plays as one Aruban day. | Sun glow behind the screen |
| Steady | .98, .86, .66 | 2026, Android app | A calm, private medication reminder for people working through hard things. | Three phones at three depths |
| Portle | .58, .5, 1 | 2026, Web app, early access | A private archive for your portfolio, your investment theses and the friends you trust with them. | Its ring floats off the screen |

Bob's rule: only Cookies Clicker is 2025, the rest are 2026. Within 2026 the order follows when each repo was created on GitHub: Jontai Energy 2026-01-19, Steady 2026-10-25, Portle 2026-10-28. The classmate on Cookies Clicker is never named.

### 5.7 Out of the portal
You shoot out of the far end into a void: a black mirror floor with a faint gold dot grid, a thin gold horizon and stars. The camera banks round in a wide U-turn and looks back. The whole tunnel hangs over its own reflection as a glowing wire tube. Then it breaks up, wire by wire, into gold sparks that fly off and become the stars. This keeps the dissolve Bob liked from the current site.

### 5.8 Q&A
A big "Q&A" stands in the void as you straighten up. A bus of gold lines on the floor leads on, stepping sideways at each stop. Each question hangs beside the line, alternating sides, and you read it while moving: the question in large caps, the answer under it, a thin leader line down to the floor, and on the other side a slowly turning open-spoked gold gear with its number in hollow type. The words are Bob's own six questions and answers, unchanged, from `end.questions` in `en.ts` and `nl.ts`. "What is this site built with?" stays true because the stack stays (section 8). Check it once more before go-live.

### 5.9 Collapse and big bang
Connected to the portal on purpose. After the last question the stars, floor and gold lines all fall into one point of light at the end of the line. "Click the light to let it go, or keep scrolling" shows beside it. Clicking plays the bang by itself over about 4 s; scrolling scrubs it.

The bang: a short, soft flash (the page's flash peaks at 0.42 opacity), seven octagon shock rings that are the portal's own shape, and the tunnel's streaks flying past. Sparks turn from hot to cool as they spread. Keep it soft. He said the sun was too strong.

### 5.10 End page
It settles into dark space, and "Let's talk." pulls itself together from a blur.

Words, centred: "End of portfolio" / **Let's talk.** / *Every universe starts small. So does every project.* / "If any of this gave you an idea, a project or a question, I would like to hear it." / "Move to pull the stars. Hold anywhere and let go to start your own universe." (gone after the first bang).

Links at the bottom: Email bhccob@gmail.com, GitHub @bhccob, Instagram @bhccob, Send a message (Bob's pick, it opens `/contact/`), each with an arrow. Bar: © {year} Bob Chung · Rotterdam, born in Aruba · Back to the start.

3D, all faint and dark so the words stay the one bright thing:
- Four spiral galaxies at different depths, thin gas clouds, and the portal's Blender gate, huge and dark, with the words inside its inner edge, never crossing its metal, its gears turning.

Interaction:
- **Cursor:** swings the camera round the centre (up to about 26 degrees to each side, 15 up and down) and the words lean a few degrees.
- **Stars:** bend and swirl round the cursor like gravity.
- **Hold and let go:** the stars pull in harder and a light grows at the cursor. Letting go sends an octagon shock wave through the stars and leaves a new galaxy there, at most eight. Links keep working as normal.

## 6. Across the journey

- **Header:** Bob Chung (to the top), Projects (to the flight), Contact (to the end page), and the existing language link, which the mock lacks.
- **Chapter rail** on the right: Who, Software, Games, Security, Mechatronics, Stack, Projects, Q&A, Contact. Current one in gold, clickable. It is hidden on phones and fades out at the collapse (frames 860 to 870).
- **Jumps:** header and rail links glide along the scroll to their chapter, and are instant with reduced motion. `/#projects` and `/#contact` link straight to those chapters (my call).
- **Progress:** a 1 px gold line along the top.

## 6a. Sound on the site
Bob has shaped this over three rounds on 2026-11-06. He was not a fan of a musical version, and liked the rush through the portal and the way into the end page. After hearing a hum and wind across the whole site he asked for four things: the portal to "only have one sound instead of the japanse theme", "a sfx where the machine is forming", sound in the Q&A that makes more sense for this site, and "the portal break need a sfx too". So the site now sounds like the machine, not like music. He said yes to this version on 2026-11-06. All of it is made in code in the browser, so there are no audio files to download.

- **The machine's hum:** one steady electrical note, not a chord. It starts on entering and fills out as the machine gets built.
- **The machine forming:** a sound for each part, at the point in the scroll where it moves. A click and spark as the board wakes. The code layer drops and lands, then keys tap as it types itself. The controller lands, then two button clicks. Four armour walls slam, the lid seats and the lock clicks. The gear ring spins up, the drives click in, the legs slide, and it stands up with a whirr and a heavy thump and hiss. A motor runs only while parts are moving and the visitor is scrolling. Scrolling back plays them softer.
- **The stack:** a pneumatic hiss as the layers lift, four clunks as they close.
- **The portal opening:** the shield slides away, the iris's teeth ratchet with the scroll, a rising sweep, and a deep clunk as it opens.
- **The flight:** one sound only, the rush, which follows the visitor's scroll speed. No bells, chords or hum.
- **The portal breaking:** a crack and low drop at the start, then a snap for each wire as it goes, following the scroll, with sparks crackling in between and a last scatter of small pings as they become stars.
- **The Q&A:** the hum returns as the power in the gold line. Gears tick as the visitor scrolls, and each question arrives with a relay click and a short servo move. No melody.
- **Into Let's talk (unchanged, he liked it):** a falling tone in the collapse, then a soft gong and rush at the bang. The end page keeps a quiet pad with a few high notes. Holding on the page makes a rising tone, and letting go makes a low thump.
- **Control:** "Sound on/off" in the header at all times, and it goes silent at once.

Build it from the mock's `Music` and the sound-effect functions in `loader.src.js`. If code-made effects do not hold up, recorded effects from a properly licensed library are the fallback, kept small and loaded late.

## 6b. Cursor
Bob, 2026-11-06: the cursor "should have an unique effect with delay". After a trail he said: "or dont need trail but a design of a cursor when moving, hover/click etc". Shown Iris, Lock, Drop and a wide trail, **he picked Lock.** There is no trail.

On a mouse only, the normal cursor becomes four gold corners and a small gold dot. The dot sits at the true position with no delay, so clicking stays exact.

- **At rest:** four corners about 26 px apart, round the dot.
- **Moving:** the corners follow on quick springs. Those on the leading side keep up and those on the trailing side come late, so the frame stretches with the motion and settles when it stops.
- **Over a link or button:** the corners close around that link or button, with a faint gold tint inside and the dot smaller so it does not cover the words. If the element is too big to frame (560 px wide or 200 px high and up), the corners only widen a little.
- **Pressed:** the corners pinch in by 4 px and the tint strengthens.
- **Let go:** a second set of corners springs outward and fades in about a third of a second.
- **Over a project:** a dark window about 100 by 64 px with OPEN in it, so it reads on any screenshot. The dot steps aside.

With a touch screen or reduced motion there is no custom cursor. It sits above everything and never takes a click.

## 7. Content and data

- All words live in `src/i18n/en.ts` and `nl.ts`; Bob edits them himself. Words drawn inside 3D, such as project text, must be drawn from those files at runtime, so Dutch works. Do not bake translated text into images or models. BOB CHUNG and his title are the same in both languages, so those two may be part of the machine's textures.
- Dutch is at `/`, English at `/en/`, as now. I draft the new Dutch formally and Bob reviews it. The Q&A already has Dutch.
- `src/data/projects.ts` drives the flight. Add what the flight needs: a start date for the order (the existing `order` field runs roughly newest first), tint, title lines, wide or phone screens, and an optional floating piece. **Adding a project to the data must extend the flight, its gates, year gates and wall screens with no other code.** New years must work, so draw year digits from parts rather than one model per year. The scroll length grows with the number of projects.
- Email, links and birth date come from `src/data/profile.ts`.
- Rewrite `PRODUCT.md` and `DESIGN.md` for the new site. `DESIGN.md` still describes the old purple board. `PRODUCT.md` says "No collaboration wording for now". Bob asked for "LETS TALK" himself, so that rule goes for this page. The line under it is for him to check (section 14).

## 8. How it gets made

Kept from the current repo: React Router static prerender, React 19, Three.js with React Three Fiber, the i18n, SEO, CSP, the deploy workflow on GitHub Actions and Pages, `tools/site_audit.py`, the contact form, analytics, `src/engine/quality.ts`, `src/scene/gpuBench.ts` and the rest of the quality ladder from the performance round.

My calls, which Bob can overrule:
- **One live 3D world, no flipbook.** The mock's first half is a 38 MB pre-rendered flipbook, which looks soft and cannot ship. Export the machine from Blender as a GLB and animate it live, porting `pose(f)` and `CAM` from `machine.py`. This gives sharp pictures at any size and a real view through the iris. **Risk:** live lighting may not match the Cycles renders Bob approved, so section 12 makes this the first review. If it cannot match, fall back to a lighter flipbook for that part only, and that is his decision.
- **Native page scroll,** a tall track with a smoothed timeline value, as in the mock and the references. The current virtual scroll goes.
- **Page layers,** bottom to top: code-painted paper, sheets, one transparent 3D canvas, front words. The canvas turns opaque once you are inside the portal. Until then only the iris opening shows the tunnel, by stencil or clip.
- **Fonts, self-hosted:** Barlow 400 to 800 with italics, IBM Plex Mono 400 and 500, and a Ma Shan Zheng subset for 客家. The CSP allows only `font-src 'self'`. Old fonts go.
- **Colours:** ink `#f2efe8`, gold `#e6b84a`, background `#07060b`, plus the sheet colours above. Gold is the one accent. Other colours come only from the field sheets, a project's tint and the faint clouds on the end page.
- **Models from Blender,** scripts in `tools/blender/`. Art is code. No AI images.

## 9. Other pages

- **Opening a project (Bob, 2026-11-05: opens in place):** the screen grows to fill the view and shows that project's page, with its case text, pictures and its links to GitHub or the live app. Closing it puts you back at the same spot in the flight. This keeps what he asked for in round 10: "i liked it when it was the same when clicked to see inside the project". The address changes to `/projects/<id>/`, and the back button closes it. Build on `src/ui/ProjectView.tsx`.
- **A direct visit to `/projects/<id>/`** shows the same page on its own, dark and readable with no 3D needed. Closing it goes to that project's stop in the flight.
- **`/contact/`** keeps the message form with its mailto fallback, in the new style. The end page's "Send a message" link opens it (section 5.10).
- **`/contact/`, `/lite/`, 404, project pages:** the addresses stay, in both languages. Each gets the new fonts, colours and header, and they carry no new ideas.
- **`/lite/`** stays the plain full-content version, and the fallback when 3D fails. It gets the new field wording.
- **Share images and structured data** update to the new look and wording.
- **No address changes,** so no new redirects are needed.

## 10. Access and fallbacks

- All content is real text in the prerendered HTML: fields, projects, answers, links. Words shown in 3D also exist for screen readers and search, as in the mock's visually hidden elements.
- **No WebGL, or the 3D fails to load:** the existing fallback path to Lite, with no blank page.
- **Reduced motion:** no flight, collapse, bang or orbit. Show the content as calm still pages with the same words and links, my call on the exact form.
- **Keyboard:** every link and the chapter rail reachable, focus visible. The toys are extras and need no keyboard route.
- **Touch:** no cursor, so a gentle slow drift replaces orbit. Horizontal drag moves the view, vertical drag scrolls, and hold and release still works. Stop long-press from selecting text or opening a menu. The mock never tested this.

## 11. Speed and checks

Bob's PC hides problems (RTX 4080 at 180 Hz). Test on his built-in Radeon with Edge's `--force_low_power_gpu` and CDP CPU throttling at 4x, as in the performance round.

Targets, each measured and reported:
- Download for the whole journey at most 15 MB, loaded in stages. The first view does not wait for later scenes. The mock is about 40 MB.
- Median frame under 33 ms on the weak-GPU test at 1080p, using the ladder. The ladder lowers resolution, then stars, galaxies, clouds and wall screens. The look on a strong GPU stays as approved.
- No frame over 100 ms after loading, in the full scroll. Compile shaders during loading. On Bob's strong GPU the mock's worst frame was 27.8 ms in its last run, after a one-second stall was fixed this way. It has never been measured on a weak GPU.
- Existing bars stay: `npm test`, `npm run typecheck`, `npm run audit`, Lighthouse at 100 for accessibility, best practices and SEO, and 0 code-scanning alerts.
- Works in the latest Chrome, Edge, Firefox and Safari, and on a real phone.
- Keep the harness steps `smooth`, `rungs` and `walk-down`, pointed at the new journey. Rewrite the rest of `tools/proof/needle.mjs` for it: a step for each chapter, each project's text and link, the look-back, each question, the collapse, the bang by click and by scroll, cursor and hold on the end page, fallbacks, reduced motion, language, phone and tablet sizes, no console or CSP errors. Replace tests of removed code rather than keep them.

## 12. Build order and reviews

Work on a new branch from `origin/main`. The local `redesign-bench` is 24 commits behind it. Bob reviews each stage on a local review page before the next. Nothing is pushed to `main` until he says go live, because a push deploys. His standing rule: no subagents, the work is done inline.

1. **Live machine against the approved renders.** Side-by-side stills at frames 0, 36, 112, 190, 262, 304, 345, 360. Bob decides here whether live is good enough.
2. Loader, first view, story, sheets, stack, portal.
3. Flight and projects, opening a project in place, with a test project added from data alone.
4. Void, look-back, Q&A.
5. Collapse, bang, end page and its interaction.
6. Dutch, other pages, fallbacks, phone pass, weak-GPU pass, new `PRODUCT.md` and `DESIGN.md`.
7. Go-live check, then deploy on his word. Remove the old scenes in this stage (tower, storm, Q&A ring, old models, old fonts, virtual scroll) so the live site is never half-switched. Afterwards remove the mock-only ignores from `.impeccable/config.json` and its uncommitted `.claude/launch.json` entries.

## 13. Known rough spots to solve

From the mock, not yet right:
- Long words sit behind the machine: "Engineering" is hidden on the Mechatronics sheet.
- The chapter rail runs over the machine's right leg on that sheet.
- On phones the machine crowds the sheet words, and the portal moment shows dark bands above and below the machine.
- The end page's small bottom line and the links wrap on phones.
- Not tested: Safari, Firefox, real phones, a real weak laptop.

## 14. Calls I made for Bob to check

- "Browser, Roblox and platform games": I read "platform game" as platformers. No platformer is in his notes.
- "Studied: MBO 4" next to "MBO, now" on the same sheet, which may contradict.
- DevSecOps and firmware security under "Possible direction" come from his older notes.
- All wording in section 5 not marked as his, including "Born and raised in Aruba" and the big bang line.
- "If any of this gave you an idea, a project or a question, I would like to hear it." It invites contact, and `PRODUCT.md` had a rule against collaboration wording.
- The Mechatronics sheet says "HBO" while your Q&A answer names the school. That is on purpose: the sheets stay short.
- The order of end page words, the galaxies and the portal gate behind the words.
- The technical calls in section 8, reduced motion and touch in section 10, and the speed targets in section 11.
- Four sheets instead of five, and the two `/#` links.
- The two Enter choices at the end of the loader, which are the only way a browser allows sound to start.
- The dot in the cursor, and OPEN over a project (section 6b).
- The chip and the sheets' title blocks still say "Systems Builder". Only the seal beside the Chinese text changed to "Programmer", as he asked.

## 15. Left to the builder

Component and file structure; whether scene code is written in R3F or plain Three.js inside it; GLB compression; how the iris opening is masked; exact scroll lengths, easing and counts within the look of the mock; the order of the quality ladder; how the old and new home live side by side on the branch until stage 7.
