/* boot: the loader shows at once, the 3D code is fetched behind it, and the page opens when the visitor chooses how */
import { createLoader } from "./loader";
import { initSound, setSound } from "./audio";
import { initWork } from "./ui/work";
import { initNav } from "./ui/nav";
import { initSteps } from "./ui/steps";

const loader = createLoader((withSound) => {
  /* without sound also turns off any set the visitor tried in the loader */
  try { if (withSound) initSound(); setSound(withSound); } catch { /* the page works without sound */ }
});
initWork();
initNav();
initSteps();

function canWebGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

if (!canWebGL()) loader.fail();
else {
  import("./scene/stage").then((m) => {
    loader.task("3D engine loaded");
    m.startStage({ task: loader.task, fonts: loader.fonts });
  }).catch((err) => { console.error(err); loader.fail(); });
}
