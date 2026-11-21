/* the moment the visitor enters, shared by the loader (which starts the handoff) and the 3D scene (which brings the
   pieces in out of the fog at the same time). -1 until then. a performance.now() time, like requestAnimationFrame's */
export const handoff = { at: -1 };
