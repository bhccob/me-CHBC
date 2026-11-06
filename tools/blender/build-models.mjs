// Builds the site's models in Blender, headless, and packs them into public/models.
//   npm run build:models                 (BLENDER names another Blender than the one on Bob's PC)
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BLENDER = process.env.BLENDER ?? 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe';
const temp = mkdtempSync(join(tmpdir(), 'models-'));

// The parts of the machine that hold a mesh and that the pose moves: see tools/blender/pack.mjs.
const DRIVEN_MESHES = String.raw`pulse-\d+|code-cover|floor|floor-cover|pinion-\d+`;

const machine = join(temp, 'machine.glb');
execFileSync(BLENDER, ['-b', '--factory-startup', '--python', 'tools/blender/machine.py', '--', machine, 'tests/fixtures/machine-pose.json', 'tests/fixtures/machine-anchors.json'], { stdio: 'ignore' });
execFileSync(process.execPath, ['tools/blender/pack.mjs', machine, 'public/models/machine.glb', DRIVEN_MESHES], { stdio: 'inherit' });

const gate = join(temp, 'gate.glb');
execFileSync(BLENDER, ['-b', '--factory-startup', '--python', 'tools/blender/gate.py', '--', gate], { stdio: 'inherit' });
execFileSync(process.execPath, ['tools/blender/pack.mjs', gate, 'public/models/gate.glb', String.raw`gear-\d|digit-\d`], { stdio: 'inherit' });
