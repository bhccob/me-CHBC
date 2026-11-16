// LAB ONLY (throwaway). Round 66: writes r66-overlap.html, r66-fold.html and r66-weight.html from one template, so the
// three ideas carry the same words, nav and markers and differ only in their world (and where the words sit in it).
//   node tools/lab/mock/r66-pages.mjs
import { writeFileSync } from 'node:fs';

const L = 'var(--gutter)', R = 'calc(var(--gutter) + 120px)';
const LEFT = 'linear-gradient(90deg, rgb(9 8 13 / 0.62) 0%, rgb(9 8 13 / 0.3) 34%, rgb(9 8 13 / 0) 58%)';
const RIGHT = 'linear-gradient(270deg, rgb(9 8 13 / 0.62) 0%, rgb(9 8 13 / 0.3) 34%, rgb(9 8 13 / 0) 58%)';
const IDEAS = {
  overlap: {
    title: 'Overlap', shade: [LEFT, 'none', LEFT],
    hero: `left:${L};bottom:12vh`,
    dig: { head: `left:${L};bottom:12vh`, card: `right:${R};bottom:12vh`, index: `left:${L};top:15vh` },
    end: { head: `left:${L};top:17vh`, rest: `left:${L};bottom:12vh` },
  },
  fold: {
    title: 'Fold', shade: ['none', 'none', 'none'],
    hero: `right:${R};bottom:12vh;width:min(54vw,740px)`,
    dig: { head: `left:${L};top:14vh`, card: `right:${R};top:15vh`, index: `left:${L};bottom:12vh` },
    end: { head: `left:${L};top:14vh`, rest: `right:${R};top:16vh;width:min(30vw,400px)` },
  },
  weight: {
    title: 'Counterweight', shade: [LEFT, 'none', LEFT],
    hero: `left:${L};bottom:12vh`,
    dig: { head: `left:${L};top:14vh`, card: `right:${R};bottom:12vh`, index: `left:${L};bottom:12vh` },
    end: { head: `left:${L};top:17vh`, rest: `left:${L};bottom:12vh` },
  },
};

const ZONES = ['Home', 'About', 'Digital', 'Protected', 'Physical', 'Beyond', 'Contact'];
const RAIL = ['Ecosystem', 'The core', 'Digital systems', 'Protected systems', 'Physical systems', 'Beyond technology', 'Horizon'];

const page = (key, c) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Round 66 · ${c.title}</title>
<link rel="icon" href="data:," />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Space+Grotesk:wght@400;500&display=block" />
<link rel="stylesheet" href="r66.css" />
</head>
<body>
<div class="stage" aria-hidden="true">
${[1, 2, 3].map((n, i) => `  <img class="shot" data-i="${i}" src="/proof-out/lab/mock/eco66/${key}-${n}.jpg" alt="" />`).join('\n')}
</div>
<div class="grain" aria-hidden="true"></div>
<header class="nav">
  <a class="id" href="#top"><b>Bob Chung</b><span class="mono">Systems builder</span></a>
  <nav aria-label="Zones">${ZONES.map((z) => `<a href="#${z.toLowerCase()}">${z}</a>`).join('')}</nav>
</header>
<div class="rail mono" aria-hidden="true">${RAIL.map((r, i) => `<i><span>${r}</span>${String(i + 1).padStart(3, '0')}</i>`).join('')}</div>
<main id="top">
  <section class="frame" data-num="001" data-sec="Ecosystem" data-ch="0" data-shade="${c.shade[0]}">
    <div class="hero" style="${c.hero}">
      <p class="kicker mono in" style="margin:0 0 18px"><b>Ecosystem / 001</b> Initialization</p>
      <p class="role mono in" style="margin:0 0 20px">Systems builder <em>· Software Engineer · Cybersecurity Intern · Exploring Mechatronics</em></p>
      <h1 class="head in d1">Connected<br />by curiosity.</h1>
      <div class="row in d2"><p class="lede">Exploring systems, building ideas and connecting the digital with the physical.</p>
        <div class="ctas"><a class="btn go" href="#core">Explore ecosystem</a><a class="btn ghost" href="#digital">View my work</a></div></div>
    </div>
  </section>
  <section class="frame" id="digital" data-num="003" data-sec="Digital systems" data-ch="2" data-shade="${c.shade[1]}">
    <div class="in" style="${c.dig.head}">
      <p class="kicker mono" style="margin:0 0 18px"><b>Digital systems / 003</b> Software engineering</p>
      <h2 class="head mid">Building<br />the digital.</h2>
    </div>
    <article class="card in d2" style="${c.dig.card}">
      <span class="mono">01 · Website · 2026</span>
      <h3>Jontai Energy</h3>
      <p>Aruba sunlight, made useful. <span class="ph">[Problem, your role and what you learned go here.]</span></p>
      <p class="mono" style="color:var(--grey)">Stack <span class="ph">[technologies]</span></p>
      <a href="#digital">Open project</a>
    </article>
    <ol class="index in d3" style="${c.dig.index}">
      <li class="on mono">01<b>Jontai Energy</b></li>
      <li class="mono">02<b>Lumo</b></li>
      <li class="mono">03<b>Cookies Clicker</b></li>
    </ol>
  </section>
  <section class="frame" id="contact" data-num="007" data-sec="Horizon" data-ch="6" data-shade="${c.shade[2]}">
    <div class="in" style="${c.end.head}">
      <p class="kicker mono" style="margin:0 0 22px"><b>Horizon / 007</b> Contact</p>
      <h2 class="head">Still exploring.<br />Still building.</h2>
    </div>
    <div class="in d2" style="${c.end.rest}">
      <p class="lede" style="margin:0 0 20px">The best systems begin with curiosity.</p>
      <p class="links mono" style="margin:0"><a href="#contact">Email</a><a href="#contact">LinkedIn</a><a href="#contact">GitHub</a><a href="#contact">Résumé</a><a href="#top">Back to the core ↑</a></p>
    </div>
  </section>
</main>
<footer class="foot mono"><span class="sec"><b>001</b><span class="bar"></span><span class="sec-name">Ecosystem</span></span><span class="cue">Scroll</span></footer>
<script type="module" src="r66.js"></script>
</body>
</html>
`;

for (const [key, c] of Object.entries(IDEAS)) {
  writeFileSync(new URL(`r66-${key}.html`, import.meta.url), page(key, c));
  console.log(`r66-${key}.html`);
}
