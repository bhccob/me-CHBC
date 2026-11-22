/* the moment the visitor enters, shared by the loader (which starts the handoff) and the 3D scene (which brings the
   pieces in out of the fog at the same time). -1 until then. a performance.now() time, like requestAnimationFrame's.
   `spots`: until then, the scene keeps writing where each piece will hang in the first view, on screen, in CSS pixels
   (its centre and about how big it looks), so the loader's blurred colours can fly to the pieces they stand for */
export const handoff: { at: number; spots: { x: number; y: number; r: number }[] } = { at: -1, spots: [] };
