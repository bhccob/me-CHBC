/**
 * Keeps the site out of other sites' frames, so nobody can lay it under their own page and trick a click (clickjacking).
 * The proper guard is a response header (`X-Frame-Options: DENY`, or `frame-ancestors 'none'` in the policy), which GitHub
 * Pages cannot send and a <meta> policy cannot carry; this is the fallback until a proxy in front sends it (SECURITY.md,
 * section 5). In a frame, the page hides itself and asks to be the whole window instead.
 */
export function guardFrame(win: Pick<Window, 'self' | 'top' | 'location'>, root: { style: { visibility: string } }): boolean {
  let framed: boolean;
  try {
    framed = win.top !== win.self;
  } catch {
    // A frame of another origin may not even read `top`: framed all the same.
    framed = true;
  }
  if (!framed) return false;
  root.style.visibility = 'hidden';
  try {
    if (win.top) win.top.location.href = win.location.href;
  } catch {
    // The framing page refused: the page stays hidden in its frame.
  }
  return true;
}
