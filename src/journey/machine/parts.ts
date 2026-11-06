/** Every node of public/models/machine.glb that the pose drives (tools/blender/machine.py names them the same). */
export const PART_NAMES = [
  'board', 'pulse-0', 'pulse-1', 'pulse-2', 'pulse-3', 'pulse-4', 'pulse-5', 'pulse-6',
  'pulse-7', 'pulse-8', 'pulse-9', 'pulse-10', 'pulse-11', 'code', 'code-cover', 'game',
  'wall0', 'wall1', 'wall2', 'wall3', 'post-0', 'post-1', 'post-2', 'post-3',
  'lid', 'blade-pivot-0', 'blade-pivot-1', 'blade-pivot-2', 'blade-pivot-3', 'blade-pivot-4', 'blade-pivot-5', 'blade-pivot-6',
  'blade-pivot-7', 'blade-pivot-8', 'keycap', 'sleeve', 'turret', 'servo-0', 'servo-1', 'pinion-0',
  'pinion-1', 'leg0', 'leg0-base', 'leg0-upper', 'leg0-lower', 'leg0-foot', 'leg1', 'leg1-base',
  'leg1-upper', 'leg1-lower', 'leg1-foot', 'leg2', 'leg2-base', 'leg2-upper', 'leg2-lower', 'leg2-foot',
  'leg3', 'leg3-base', 'leg3-upper', 'leg3-lower', 'leg3-foot', 'floor', 'floor-cover',
] as const;

export type PartName = (typeof PART_NAMES)[number];
