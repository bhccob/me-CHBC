/* the menu (three jumps, so nobody has to scroll the whole way) and the sound button */
import { aboutTop } from "../timeline";
import { toggleSound, onSoundChange } from "../audio";
import { $ } from "../util";
import { glideTo } from "./steps";

export function initNav() {
  document.querySelector(".nav")!.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("button[data-go]"); if (!b) return;
    const go = b.dataset.go, vh = window.innerHeight, work = $("work");
    const top = go === "about" ? aboutTop(work.offsetTop, vh) : go === "work" ? work.offsetTop : document.documentElement.scrollHeight - vh;
    glideTo(top, false); // each of the three is a place the page can rest: the first about-me line, the top of the work list, the last page. a jump never holds
  });
  /* the name, top left, goes back to the top. if the message form is open it is closed first, since the page cannot move under it */
  $("home").addEventListener("click", (e) => {
    e.preventDefault();
    if (document.documentElement.classList.contains("formopen")) $("mClose").click();
    glideTo(0, false);
  });
  const snd = $("snd");
  snd.addEventListener("click", toggleSound);
  onSoundChange((on) => { snd.textContent = on ? "Sound on" : "Sound off"; snd.setAttribute("aria-pressed", String(on)); });
}
