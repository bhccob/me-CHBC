# Where the site differs from the prototype

The prototype (`the-lock-prototype.html`, in this folder) is the source of truth. It is now **version 2**: change request v2 (`CHANGES_V2.md`, 2026-11-16) replaced the first prototype. The first prototype is in this file's git history (commit `4ede19a`).

This file lists every place the built site is different from the prototype, and why. Anything not listed here is meant to be the same.

## 1. The five changes the first brief asked for (section 7)

1. **Sound.** One sound set, "stone" (the prototype's Sound 2). The moment the lock closes uses Sound 1's finale. The "Sound 1/2/3" button and the code for sets 1 and 3 are gone.
2. **Form.** SEND posts to `/api/contact`. The title piece shows "sending", "sent" (green) and errors (red). The "this preview has nowhere to send it" line is gone.
3. **Contact links.** GitHub and Instagram come from `src/content.ts`. A link with no address is not shown. There is no Email link (Bob, 2026-11-16): the message form already reaches his inbox, so his address is not displayed.
4. **Project picture, video and link.** They come from `src/content.ts`. No picture: a soft glow in the project's colour. No video: no video block at all. No address: "Coming soon" and no Visit button.
5. **Dead code removed.** `bell`, the note scale, the switched-off shockwave, floor ripple, flash and light beams, the light shafts (v2 only hides them), CSS for the old door rows and outlined letters, the wall diagram, and project text the page does not show (`overview`, `problem`, `approach`, and any point after the second).

## 2. Bugs in the prototype that were fixed

- **Enter buttons showed too early.** They were visible while the loader was still counting. Now they appear at 100%.
- **Chapter text over the wrong page.** After a menu jump, or on a slow screen, a chapter's text could sit on top of the wall, the work list or LET'S TALK. The camera's easing now runs at the same speed on any screen, and chapter text fades out as the wall forms.
- **About me: the line being read could be off screen (v2).** The open piece is big. In the prototype the first line's card rises under the menu and off the top of the screen, on a squarer window a card runs off the side or behind the heading, and on a phone the slip being read is wider than the screen. Now the card is checked against the free area every frame: under the menu, above the heading, inside the page margins. The piece moves by just as much as is needed, and shrinks only when it is too wide to fit.
- **Form on a phone: title piece under the Back button.** The column of six pieces now fits between the button and the bottom of the screen. The same check keeps the pieces clear of the button on short laptop screens.
- **Floating blocks across the form.** While the form is open the blocks float behind the pieces, never across the writing.
- **Plain page (no WebGL).** The chapters now read in the order you meet them (Me first), and all six about-me lines are shown. The prototype shows only the first.

## 3. Beyond change request v2

- **The card's text is never squashed.** The note asked for this if possible. While the card grows or shrinks, its writing is uncovered like a shutter opening, at its true proportions. Nothing fades.
- **The browser's Back button closes a project page.** Opening a project adds one step to the browser's history, so Back (or a phone's back swipe) returns to the work list instead of leaving the site. Forward opens the project again.
- **Next project and focus.** After "Next project" in the footer, keyboard focus moves to "Next project" in the top bar, because the footer button has just been replaced. With only one project there is no Next button.
- **Video.** Only its first frame is fetched until someone presses play. Closing the page stops it.
- **Link text.** The address is shown without `https://` and without a trailing slash.

## 3b. Asked for by Bob after seeing the build (2026-11-16)

- **Project picture fades out at the bottom.** A screenshot was "too long": its own words sat behind the project's name and text. The picture now fades away before they begin.
- **No "Preview video" box.** There are no videos yet, so the block is left out. Put a file name in a project's `video` and its video appears.
- **The loader cannot be scrolled.** Scrolling, swiping and arrow keys no longer open the page. The two buttons are the only ways in.
- **Jontai Energy's link** is `jontai-energy.vercel.app`, his redesign, not the company's own site.
- **A "sent" screen.** After a message is sent, the title piece says "sent" for a moment, then the six pieces close back into the lock with a knock and the big words behind it read THANK YOU instead of LET'S TALK. They go back when the visitor leaves the page or opens the form again.
- **The sound switch on phones (2026-11-16).** In the prototype it sits in the top bar beside the name. On a phone it wrapped to right under the name, and since the name now leads back to the top, a thumb aiming for the switch could send the visitor to the start. On phones it now has its own corner at the bottom left, with a larger touch area. It is hidden while the message form is open, and it fades out over the work list so it never covers the text.
- **Leaner blocks (2026-11-16).** Bob found the blocks cluttered. The line under each block's title and the "What it is" text are gone. Software engineering, Development, Mechatronics and Internship now have one text, "Why I chose it", rewritten to say more and to take a position; Directions keeps its two. A single text gets the full width.
- **The about-me card on phones (2026-11-16).** The v2 note gave the card to wide screens only: on a phone the active slip stepped forward and the sentence was page text under the heading. Bob asked for the same view as on a computer. A phone (narrower than 700 px) now has its own card: as wide as the piece and taller, with the label on top and the sentence under it, because the wide card's sentence would be about 9 px high on a phone. It takes only the height its line needs, opens like a shutter as the wide one does, and the slips above and below move apart for it. A tablet held upright or a square window is wide enough for the computer's card and gets that one. The sentence under the heading is no longer shown on any screen.
- **No two points on a project page (2026-11-16).** The prototype's project page had two short text blocks under the facts (for Jontai Energy: "One clear range" and "Premium look"). Bob did not want them, on any project. The page is now the picture, the name, the one line, the four facts and the link.
- **A small tools line (2026-11-16).** Bob's ask: under the two text blocks, Software engineering says "Stack: full-stack, multiple programming languages" and Development says "Games: Godot, Roblox Studio" and "Apps: Expo, React Native, TypeScript" (what Locked and Lumo are built with). One small line, so it takes little room. The prototype had no such line. It is the `tools` list of a piece in `src/content.ts`.
- **The six blocks changed (2026-11-16).** Bob's order: Me, Software engineering, Development (games and apps merged), Mechatronics, Internship (cybersecurity, with room for a second), Directions (where it can lead, and the long-term goal). The prototype had Game and App as two blocks and no Directions block. Development has a new drawing (the game and one phone), Directions has a new drawing (branching paths).
- **A reason for writing.** The fifth form piece is a dropdown (a project, a job or internship, working together, a question, just saying hello) instead of a second message piece. On a wide screen its face opens into the list; on a phone each tap moves to the next reason. The message is now four lines on one piece. The reason is optional and arrives in the email and its subject.
- **A plain "Send a message" button** under the lock's line on the last page, and the finished lock lights up under the pointer.
- **The email Bob receives is designed.** It arrives in the site's own look (ink, bone and gold): the sender's name large, their address as a link, the message, a Reply button and the time. Mail apps that show no HTML get the plain text.
- **First view text.** The line under the name is about Bob himself (born and raised in Aruba, now in Rotterdam, Chinese by heritage) instead of the prototype's line about the six pieces.
- **Personality (2026-11-16).** Bob is INTP-T, not ISTP as in the prototype. The sentence beside it was rewritten to match: curious and analytical instead of practical and observant.
- **The name is a way home.** "bhccob" at the top left is a link back to the top of the page.
- **Snappier scrolling.** The camera catches up with the scroll about twice as fast as in the prototype (0.22 per frame instead of 0.085). The wind is scaled so it sounds the same for the same scroll speed.
- **The journey moves in steps.** In the prototype the page scrolled freely, so one strong scroll could fly past a block. Now the first view, the name, each about-me line, each block and the wall are stops. One turn of the wheel, one swipe or one arrow key carries the page to the next stop and no further (a little under half a second between two lines, about three quarters of a second between two blocks). On a phone the page follows the finger as far as the next stop, and letting go carries it the rest of the way. Wherever the page is left between two stops, it goes on to one. Below the wall, the work list and the last page scroll freely as before. A second push that comes while the page is already more than half way to a stop is not dropped: it starts the moment the page lands. Only one is remembered, so a spin of the wheel still moves one stop. The code is `src/ui/steps.ts`; the menu's jumps use the same glide.
- **The arrival sound waits for the arrival.** In the prototype the knock played when a piece was half way in. Now it plays the moment the piece fills the view (about half a second into a step). It does not wait for the camera to drift to rest behind it: that was tried and sounded about a third of a second late. A block that is only flown past (a menu jump) makes no knock.
- **A press on the lock takes it apart.** In the prototype a press on the finished lock opened the form. Now the six pieces slide out and hang there, each with its name readable; the next press rams them home one after the other, Me last, with the knocks. The form is opened by the "Send a message" button only. The line under the lock says so ("Press it to take it apart").
- **Sound on phones.** A phone's speaker cannot play the low thumps the sound is made of. On phones and tablets every hit also gets one short knock higher up, the wind sits a little higher, and the mix is louder. Computers keep the sound exactly as it was.

## 4. Added for the first brief's requirements (section 6)

**Keyboard and screen readers**
- An "Open the message form" button on the last page. It is out of sight until it has keyboard focus.
- Inside the form, Tab goes name → email → message → send → back, and stays inside the form. The SEND piece shows a dark frame when it has focus.
- Inside a project page, Tab stays inside it. Escape closes it and focus returns to the row.
- Chapter text stays readable by screen readers at all times (it is faded, not removed). The six about-me lines are always available to them as a list.
- Form answers ("sent", errors) are also announced to screen readers.
- One `h1` (Bob Chung). "Selected work", "Let's talk" and a project's name on its page are `h2`. On the project page the facts are a description list. A project's name in the list is not a heading, because it sits inside a button.

**Speed**
- Sharpness is capped (2× on desktop, 1.5× on phones) and drops a step by itself if frames are slow.
- Light mode on phones and weak machines: 28 floating blocks instead of 48, 300 dust points instead of 700, no extra lamp in the Me piece's glow, and a face is redrawn every second frame.
- Nothing is drawn while the tab is hidden. The sound pauses too, and comes back with the tab.
- The 3D code is fetched behind the loader, so the loader shows at once.

**Reduced motion** (on top of what the prototype already did)
- The finished lock does not spin up, the blocks are simply there instead of bursting out, the SEND piece does not pulse, and menu jumps are instant.

**Other**
- Resizing the window or turning the phone keeps you at the same place in the story.
- Dragging the lock no longer selects the text behind it. A press that starts on a link or button does not turn the lock.
- Pressing the SEND piece puts the phone keyboard away, so the title piece with the answer is in view.
- The form is guarded on the server: requests only from the site's own pages, a signed ticket the page fetched at least two seconds earlier, a hidden field that only spam robots fill in, and a limit of 4 messages per visitor per 10 minutes.
- Security headers are stricter than a default site's: a content security policy that starts from "nothing allowed", HTTPS only on the domain and its subdomains, and no cross-site use of the site's files. They are in `vercel.json`. How to report a problem is in `public/.well-known/security.txt`; `.github/SECURITY.md` is only the logo linked to it (Bob: no text).

## 5. Under the hood

- **three.js r128 → 0.187.** Two settings in `src/scene/rig.ts` keep the prototype's exact look: colours are used as written, and point lights fade in a straight line as they did in r128. If a three.js update changes the look, start there.
- **Text is real HTML.** The build writes the text from `src/content.ts` into the page, so it is there with no JavaScript.
- **Fonts are self-hosted.** The Chinese font holds only the 17 characters the site uses (4 KB).
