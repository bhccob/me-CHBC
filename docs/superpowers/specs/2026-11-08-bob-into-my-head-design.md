# Into my head: the Q&A as an X-ray of Bob's head, ending in a scan report

Status: written 2026-11-08 from mock-up 20, which Bob chose, for his review. Nothing here is built on the real site yet.

This changes the rebuild design of 2026-11-05 (`2026-11-05-bob-machine-rebuild-design.md`). It replaces sections 5.7 to 5.10 of that design (out of the portal, the Q&A on the gold line, the collapse and big bang, the end page), the Q&A and ending parts of its sound (6a), and its colours (8). Everything before the end of the projects flight stays as that design says.

## 1. What this is and why

Bob wanted the Q&A and the "Let's talk" ending to be one memorable journey instead of a list of answers and a separate contact page. Over twenty rounds of mock-ups he shaped it into this:

> You come out of the portal into a shaft above Bob's head. An advanced X-ray scanner scans him from the side, and the top of his skull lifts like a lid. Everything you saw on the way pours in and sorts itself into six parts of his brain, and the scanner labels them: what's on his mind. You dive in and read his six answers, one thought at a time. Then you travel down to his mouth with the words, the pressure builds, and he spits them out. You ride the spit out of his mouth. It lands, a soft big bang opens behind it, and the scanner prints its report on him, ending on "Let's talk."

Why it works for him:
- It is clearly his brain. **(Bob)** "make it clear that its my brain like advanced xray scanner".
- The mouth does something that makes sense: it spits out what he thinks. **(Bob)** "maybe not it talking but spitting it".
- One continuous motion from the portal to the last link. **(Bob)** "i want SEAMLESS MOTION". This is the most important quality.

The product goal stays the one in `PRODUCT.md`: the visitor remembers him.

## 2. Goals, non-goals, anti-goals

**Goals**
- One unbroken camera move from the end of the projects flight to the scan report. No cuts, no page changes, no fades to black.
- The scan reads as an advanced X-ray scanner at work: a side view, a scan band, a live read-out, labels, a side map.
- The six answers are easy to read. While you read, the brain goes quiet and steps back.
- The scan and the trip are slow enough to take in. **(Bob)** "make scrolling slightly slower when diving into the brain (scanning) since user need to see the infos" and "i want the travel time to the mouth a bit longer".
- The ending is the dark scan report with a soft big bang behind it, and its sound stays in sync with its picture.
- The visitor can always reach him: GitHub, Instagram and Send a message.
- Dark purple across the whole site, where it makes sense (section 8).
- Dutch and English, a phone layout, and smooth running on an ordinary laptop.

**Non-goals**
- Hovering or clicking the labelled overview to open an answer. Bob tried it and asked to remove it.
- A talking mouth. He chose spitting.
- A front view of the head during the scan. **(Bob)** "side view was indeed much better".
- The skull bones. The mock hides them, and the skin is the X-ray.
- The Universe ending's toy (hold and let go to make a galaxy). The scan report has no toy.
- "Startups" anywhere for now. **(Bob)** "i dont want it to be added now". Projects stay "Projects".
- AI-made images or video. **(Bob)** "keep the code art".

**Anti-goals: it has failed if any of these are true, even if it works**
- Any jump, jolt or cut in the motion.
- Two streams of particles out of the mouth. **(Bob)** "the mouth spits 2 particles in 2 ways which also doesnt make sense". There is one spit.
- The ending's sound runs out of step with its picture. **(Bob)** "it makes the sound not synced and just bad UX".
- The ending shows a lot of head. **(Bob)** "i dont want it to show so much head".
- The answers are hard to read because the brain competes with them.
- The big bang is loud. **(Bob)** "big bang in the background but not too strong".
- The internship company is named. It must never be.
- His photos are used or uploaded. They only gave the head's proportions. The head is code.

## 3. Source of truth for the look

Mock-up 20 fixes the look, the motion and the words:

- File: `.superpowers/brainstorm/828-1794127460/content/brain-dive-v20.html`. The folder is excluded from git (`.git/info/exclude`), so keep it until this is live.
- Run it through the brainstorm companion server, which serves three.js and the fonts from `/files/`: `bash ~/.claude/plugins/cache/superpowers-dev/superpowers/7.0.0/skills/brainstorming/scripts/start-server.sh --project-dir <repo>`, then open the address it prints. The newest mock opens on the chosen ending, "Scan report". `window.__mock.jump(t)` jumps to any point.
- Mock-ups 6 to 19 sit next to it. They are history, not a source.

| In the mock | What to take from it |
|---|---|
| `headSdf`, `brainSdf`, `surfaceMesh` | Bob's head and brain shapes, as signed distance fields turned into meshes |
| `xrayMaterial` | The X-ray look: rim light, rings of equal depth, scan band, lid, eyes, regions lighting up |
| `buildTrack`, `timedCurve`, `scrollToT` | The whole camera path and the scroll pace |
| `THOUGHTS`, `QUESTIONS`, `OBJECTS`, `PHRASES` | The six thoughts, their regions and objects of light, and the words that pour in |
| `streamPos`, the labels and the read-out code | What goes in, the labels, the scanner's lines |
| `finaleLen`, `finaleAt`, the effective `t` | The ending's own clock |
| `placeOwn`, the ending 12 parts, `#report` styles | The scan report, its scan line and its layout |
| `sfx` | Every sound, made in code |

**Mock-only, do not build:** the top bar with the chapter list and the buttons for how the head opens, the skull, the ending and the sound; every other ending (Full stop, Conversation, Universe, Constellation, Synapse, Your turn, Rally, Chat, Blueprint, Wavelength, Splat, Lights on, Scan report on paper, Card, Lights + report); the "Mock-up 20" tag; `window.__mock`; the "Turn the sound on, then scroll" hint, since the site has its own sound control.

## 4. The journey on one scroll

The mock runs this part on a 28,500 px track. A smoothed scroll value is remapped to the journey `t` from 0 to 1, slower where Bob asked: keys (scroll, t) = (0, 0), (0.082, 0.09), (0.4, 0.335), (0.95, 0.885), (0.979, 0.932), (1, 1), joined smoothly. At the site's 30.6 px per frame that is about 930 frames, where the old void, Q&A, collapse and end page took about 370. The home page gets longer; Bob asked for this pace. Keep the proportions; the exact length is the builder's to tune.

| t | Share of the scroll (about) | What happens | Rail |
|---|---|---|---|
| 0 to 0.06 | 0 to 6 % | Down the shaft, looking down at the top of his head | Q&A |
| 0.06 to 0.17 | 6 to 19 % | Round to his left side; the scan band sweeps down him | Q&A |
| 0.115 | 11 % | The lid lifts | Q&A |
| 0.12 to 0.2 | 12 to 23 % | What you saw pours in and sorts into six regions | Q&A |
| 0.205 to 0.25 | 23 to 28 % | The six labels arrive; "What's on my mind" | Q&A |
| 0.26 to 0.32 | 30 to 38 % | Up, over and down into the open skull | Q&A |
| 0.335 to 0.77 | 40 to 84 % | Six thoughts, one answer each, read at t 0.371, 0.444, 0.516, 0.589, 0.661, 0.734 | Q&A |
| 0.795 | 86 % | Broca's area: putting it into words | Q&A |
| 0.82 to 0.88 | 89 to 94 % | Down the brainstem and the jaw nerve to the mouth | Q&A |
| 0.885 to 0.93 | 95 to 98 % | Held in behind the lips; the pressure builds | Q&A |
| 0.932 | 98 % | The spit. From here the ending runs on its own clock | Contact |

**The ending's own clock.** Once the scroll reaches the spit, t runs from 0.932 to 1 over 4.8 s by time, not by scroll, and the sound fires from that same clock. Scrolling back above the spit rewinds it. Bob asked for this when a slow, scroll-driven ending put the sound out of sync.

| Seconds after the spit | t | What happens |
|---|---|---|
| 0 to 1.4 | 0.932 to 0.952 | The spark flies out; the camera rides it out of the mouth |
| 1.3 to 1.8 | 0.95 to 0.958 | The spark stops at the top of the report and burns hotter |
| 1.8 | 0.958 | The soft big bang; the spark opens into the scan line |
| 2.1 to 3.8 | 0.962 to 0.986 | The scan line sweeps down and prints the report |
| 1.8 to 4.4 | 0.958 to 0.99 | The galaxies and the cloud grow behind it |
| 4.4 to 4.8 | 0.99 to 1 | The footer bar fades in; everything is still |

## 5. Scene by scene

English words are the source. Each needs Dutch (section 7). Bob's own wording is marked **(Bob)**. The rest is from the mock, which he has seen.

### 5.1 Out of the portal, down the shaft
The flight's tunnel turns downward into a vertical shaft, and you look down it at the top of Bob's head, far below. The shaft fades as you near him. The mock starts at the shaft; the join with the flight was never mocked (section 14).

### 5.2 The scan
The camera comes round to his left side and stays on the side view. He is drawn as an X-ray in gold: a bright rim, rings of equal depth that follow your view, the brain inside. A scan band sweeps down from the crown and reveals him. His eyes show through the skin: they look at you, blink every few seconds, and glow while he takes things in, with light running down the optic nerves.

The scanner's frame is on screen from here to the mouth: four corner marks, a read-out at the top left, a depth ruler ("Slice 256"), and a small side map at the bottom right ("Side view · you are here") with a dot for you and a dot for each thought. On phones the ruler and the map's caption are hidden.

### 5.3 The lid
The top of his skull lifts like a lid and opens. **(Bob)** "i like lid the best". Do not build the other ways of opening it.

### 5.4 What goes in
One wide stream pours down the shaft into the opening: glyphs, code and the words of what the visitor has seen, then sorts into six clusters inside the brain. The read-out counts it in ("Taking in 9,400"). In the mock the words are Mechatronics, `const bob = new Engineer()`, Cookies Clicker, `SELECT * FROM ideas;`, Godot, Jontai Energy, `firmware.flash()`, Rotterdam ← Aruba, TypeScript, `git commit -m "next"`, Security, React · Three.js, `while (learning) build();` and Blender. On the site, take the names from the data the visitor has just passed (the four fields, the projects, the places), so new projects show up without new code. Code lines are the same in both languages.

### 5.5 What's on my mind
Six labels arrive one by one, each on a thin leader line from its region, and a heading stands on the left: "Q&A · six questions" / **What's on my mind** / "Everything you have seen so far goes in. Watch what lights up." No hover, no click.

### 5.6 The dive
Up and over the open skull, and down into the brain, onto the first thought.

### 5.7 The six thoughts
Each answer is one stop. The camera slows almost to a stop, the thought's region lights, and one object of light hangs beside it, drawn in gold lines. The questions and answers are Bob's own, from `end.questions` in `en.ts` and `nl.ts`, with the two changes in section 7.

| # | Topic | Region · what it does | Object of light |
|---|---|---|---|
| 01 | Plans | Prefrontal cortex · Planning | A graduation cap |
| 02 | Career | Frontal lobe · Deciding | A rocket, for the company he wants to start |
| 03 | Hobbies | Motor cortex · Moving | A barbell |
| 04 | Places | Parietal lobe · Sense of place | A globe, Aruba to Rotterdam |
| 05 | Skills | Cerebellum · Practice | A building block, and code |
| 06 | This site | Wernicke's area · Language | A browser window |

**The answer:** on the left on a desktop, lower down on a phone. An outlined number ("01"), a gold mono line ("Plans · Prefrontal cortex"), the question in heavy capitals, the answer under it.

**The quiet side while you read** (Bob: "do the right side design more minimal so the Q&A is easier to read"):
- A soft shade sits behind the words, darkest at the left edge and gone by the middle, with no box. On phones it runs top to bottom.
- The brain, the network, the signals and the fibres fall back while you read and return as you travel on.
- The neuron is a faint glow behind its object. Nothing circles the thought: the answer says it.
- The read-out and the side map step aside.

Between thoughts, bundles of fibres carry signals toward the next one, and the camera follows them.

### 5.8 Down to the mouth
After the sixth answer you go to Broca's area, "Putting it into words". The words gather and travel down with you as a swarm: down the brainstem, along the jaw nerve, to the mouth. This leg is long on purpose (Bob).

### 5.9 Holding it in
Behind his lips, the words pack tight, a little escapes at the seam of the lips, and the pressure builds. The view shakes harder as it builds, with a low rumble. The lip rings frame the lips from inside.

### 5.10 The spit and the ride
One spit, in one direction. The words fly out packed into one spark, with a short trail. The camera rides the spark out of his mouth and slows as the spark slows, so the head is behind you and out of sight from here on. The spark stops at the top of the report and burns hotter for a moment.

### 5.11 The scan report
**The soft big bang.** The spark bursts quietly, the same bang as the Universe ending at under half its strength: a faint flash (peak opacity 0.22), three octagon rings, a soft violet cloud, a few puffs, and dim galaxies that grow at the edges of the screen. Nothing moves the camera: no orbit, no drift, no shake. **(Bob)** "big bang in the background but not too strong", and he chose this one over an ink version on paper.

**The scan line.** The spark opens sideways into a gold scan line across the top of the report, with a soft glow trailing above it. It sweeps down, and each line of the report prints as the line passes it, left to right. Then it fades.

**The report** sits in the middle on a dark purple panel, with gold corner marks and a hairline frame. It is mono type in capitals, labels on the left, values on the right:

```
● SCAN COMPLETE                          08 NOV 2026 · 20:04
SUBJECT          Bob Chung
BASED IN         Rotterdam
BORN IN          Aruba
HERITAGE         Chinese
THOUGHTS READ    6 / 6                          [scan of his head]
STILL MISSING    1 · yours                       SCAN 01 · SIDE
NEXT STEP        Let's talk.
[ GITHUB ↗ ]  [ INSTAGRAM ↗ ]  [ SEND A MESSAGE → ]
```

- The date and time are the visitor's own, now, in their language's format. The dot before "Scan complete" blinks.
- "Born in" and "Heritage" are Bob's addition. **(Bob)** "scan complete include my ethnicity". "Heritage: Chinese" is the wording the site already uses ("Chinese by heritage").
- The small drawing is his head's side outline with the brain in gold, from the same shape as the 3D head.
- "Let's talk." is large and heavy, in the site's title type, not mono.
- Links: GitHub, Instagram and Send a message (it opens `/contact/`). No Email. **(Bob)** "email doesnt need to show since send a message is the same".
- Below, the site's footer bar: "© {year} Bob Chung · Rotterdam, born in Aruba · Back to the start".
- On a phone the panel fills the width less a 16 px gutter, the links wrap to two rows, and "Next step" sits above the title.
- The rebuild's end-page words go: "End of portfolio", "Every universe starts small. So does every project.", the invitation line and the toy's hint. The report says it all.

### 5.12 Leaving and coming back
Scrolling back above the spit rewinds the ending's clock. Leaving the ending and coming back plays it fresh. Jumping to Contact from the header or the rail lands on the finished report.

## 6. Across the journey

- **The scanner's read-out** at the top left: "Neural scan · live", then Subject: Bob Chung, Status, Region, Doing and a meter. It says what is happening:

| When | Status | Region | Doing |
|---|---|---|---|
| The scan | Scanning 0 to 100 % | | |
| What goes in | Taking in 0 to 9,400 | Whole brain | Listening |
| The labels | 1 to 6 thoughts found | Whole brain | Sorting |
| The dive | Going in | Prefrontal cortex | Planning |
| Each thought | Thought 01 / 06 to 06 / 06 | That thought's region | Its doing |
| Broca's area | Putting it into words | Broca's area | Speaking |
| The brainstem | Sending it down | Brainstem | Relaying |
| The jaw nerve | Down to the jaw | Jaw nerve | Moving the jaw |
| Behind the lips | Holding it in | Mouth | Building pressure |
| The spit | Spitting it out | Mouth | Spitting |

- **The chapter rail** keeps the rebuild's labels: Q&A from the shaft to the spit, Contact from the spit. The mock's finer chapter names are mock-only.
- **Header, cursor and progress line** stay as the rebuild design says.

## 6a. Sound

All made in code, as the rebuild's sound is. Silent until the visitor turns sound on with the header control. Every ending sound fires from the ending's clock, so it stays in sync.

- The scan: a rising sweep with a few short ticks as the band reveals him.
- The lid: a crack.
- What goes in: soft ticks while it pours.
- The labels: a short ping as each one arrives.
- The dive and the trips between thoughts: a whoosh.
- Each thought: a soft tone as you arrive.
- Down to the mouth: a whoosh at each turn.
- Holding it in: a low rumble that grows with the pressure.
- The spit: a spit.
- The spark gathering: a short rising tone.
- The soft big bang: a low, soft boom, with the scan's sweep as the scan line opens.
- The report: a tick for each line it prints, and a ping for "Let's talk."

This replaces the rebuild's Q&A sounds (the hum in the gold line, gear ticks, relay clicks) and its collapse, gong and end-page pad. The six label pings rise in pitch. If that sounds like a melody against Bob's "no melody" wish for the site, make them one pitch. Bob has not listened to the new sounds yet.

## 7. Content and data

- All words live in `src/i18n/en.ts` and `nl.ts`, including the scanner's lines, the labels, the regions, the report and the heading. Words drawn inside 3D come from those files at runtime. The builder drafts the Dutch formally and Bob reviews it.
- **Two changes to the answers, in both languages (Bob):**
  - "What do you work with at the moment?": add Roblox Studio. The mock reads "game development in Godot and Roblox Studio".
  - "What are your hobbies?": "retired" instead of "earlier". The mock reads "I competed at a high level in powerlifting and table tennis, and have since retired from both."
- The mock shortens "What is this site built with?" and drops its last sentence about the Python auditor. Keep the full answer from `en.ts`.
- Links and the name come from `src/data/profile.ts`; the words that pour in come from the fields, the projects and the places in the data.
- The report has no Status line. The mock's "Open for new work" was a placeholder, and Bob said **(Bob)** "Leave it out".

## 8. Colour: dark purple across the site

**(Bob)** "make the portfolio more on dark purple color", then "yes whole site but dont force too much only do if it make sense".

- The ground moves from near-black `#07060b` to the dark purple `#130724` that Bob saw in mock-up 19 and 20, with a soft violet glow in the middle of the screen and deeper purple at the edges. Panels, shades and text shadows use the same purple, darker.
- It sits inside the site's own purple family in `src/styles/tokens.css` (`--nebula-deep #0c0515`, `--lacquer #120418`, `--pcb #190624`, `--nebula #331846`); use those for the darker and lighter steps. Quiet text goes lilac with the existing `--dim #9789bb` and `--lilac #b8aad8`. Gold stays the one accent, at most about 6 % of a screen.
- "Don't force it": each scene gets purple only where it reads well. Where a scene needs deep contrast for its 3D or its light (inside the portal, for example), it may stay near-black. List each such choice for Bob at the first review.
- Recheck every contrast ratio noted in `tokens.css` against the new ground, and keep Lighthouse accessibility at 100.
- Update `tokens.css` and its ratio rule (now "about 60 % near-black, 30 % purple"), the scene's palette module, `docs/art-direction.md` section 1 and `docs/art-direction/palette.json` together. The rebuild design's "background `#07060b`" in section 8 no longer holds.

## 9. How it gets made

Kept from the rebuild: React Router static prerender, Three.js with React Three Fiber, the one transparent 3D canvas, native page scroll with the frame timeline, the quality ladder, the sound engine, the cursor and the header.

Replaced: `src/journey/world/void/` (the void, the dissolve, the gold line and its questions), `src/journey/world/end/` (collapse, bang, universe) and their parts of `timeline.ts`, `stages.ts`, `end.ts`, `bang.ts` and the sound score. Remove them in the same change that brings this in, so the site is never half-switched.

My calls, which Bob can overrule:
- **Bake the head.** The mock builds the head and brain meshes in the browser from signed distance fields with marching cubes. Turn them into a mesh once, at build time or in Blender, and load it. Keep the shapes exactly. How long the mock's build takes on a weak laptop was never measured.
- **Port the X-ray shader** from `xrayMaterial` with its uniforms (lid, eyes, scan band, region lights, the quiet-while-reading dimming).
- **The ending's clock** goes in the timeline as a pure function of scroll and time, with tests: it starts at the spit, runs 4.8 s, rewinds above the spit, and lands finished on a jump to Contact.
- **One timeline.** This part's t maps onto the site's frames after the flight, and moves along when more projects make the flight longer.

## 10. Access and fallbacks

- All words are real text in the prerendered HTML: the heading, the six questions and answers, the report and its links. The 3D, the read-out, the labels and the objects are decoration for screen readers.
- **No WebGL, or 3D fails to load:** the existing fallback to Lite.
- **Reduced motion:** no scan, dive, shake, spit or bang. Show the six questions and answers as calm still pages, each with its region and its object, and then the finished report. My call on the exact form.
- **Keyboard:** the three links, the header and the rail are reachable with visible focus.
- **Touch:** nothing in this part needs a pointer.

## 11. Speed and checks

The rebuild's targets hold: median frame under 33 ms on the weak-GPU test at 1080p, no frame over 100 ms after loading, shaders compiled while loading, and the download budget. The mock ran at about 4 to 7 ms a frame on Bob's strong PC and was never measured on a weak one.

Add browser checks for: each of the six answers, the lid, the labels, the spit, the ending's clock (sound and picture together, the rewind, the jump to Contact), the report's text in both languages, phone and tablet sizes, reduced motion, and no console or CSP errors. The existing bars stay: `npm test`, `npm run typecheck`, `npm run audit`, and Lighthouse.

## 12. Build order and reviews

This takes the place of stages 4 and 5 of the rebuild's build order. Bob reviews each step on a local review page before the next. Nothing is pushed to `main` until he says go live.

1. **The colour pass** (section 8) across the site, with the list of places left near-black.
2. **The head and the scan:** the shaft, the join with the flight, the side view, the scan band, the lid, what goes in, the labels. Bob judges the join here.
3. **The dive and the six thoughts,** with the quiet side while reading.
4. **Down to the mouth, the hold and the spit.**
5. **The scan report** with the soft big bang and the ending's clock.
6. Dutch, reduced motion, phone pass, weak-GPU pass.

## 13. Known rough spots

- The join from the flight's tunnel into the shaft was never mocked.
- The ending was tested on phones at 375 by 812 only. The six answers were tested on phone sizes in earlier rounds.
- Not tested: Safari, Firefox, real phones, a real weak laptop.
- No one has listened to the newest sounds (the soft boom, the report's ticks).
- On a phone the "Scan 01 · side" caption under the small drawing is tight.

## 14. Calls I made for Bob to check

- The join: the flight's tunnel turns downward into the shaft. The old void, the look-back and the dissolve go.
- What pours in comes from the site's data, not a fixed list.
- The rail keeps "Q&A" and "Contact" instead of the mock's six chapter names.
- Email goes from the ending only. `/contact/` keeps its mailto fallback, and other pages are untouched.
- The full answer to "What is this site built with?" stays.
- The places that stay near-black instead of purple (section 8).
- Reduced motion as still pages (section 10).
- Baking the head instead of building it in the browser.
- The label pings at one pitch if they sound like a melody.

## 15. Left to the builder

Component and file structure; R3F or plain Three.js inside it; how the head is baked and compressed; exact scroll lengths, easing and counts within the look of the mock; how the shade and the quiet side are layered; the quality ladder's order for this part; test names.

## 16. Answered by Bob

- The report's Status line: **(Bob)** "Leave it out" (2026-11-08). Mock-up 20 no longer shows it.
